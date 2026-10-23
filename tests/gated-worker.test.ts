import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {gatedBiteFixture} from '../experiments/gatedBiteFixture';
import {makeGatedGenome, installNewbornGatedHead} from '../experiments/gatedGenome';
import {measureWorkerTrial} from '../experiments/workerMetrics';
import {SimulationHost} from '../simulationHost';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, validateGenome, totalAccountedEnergy} from '../persistence';
import {stepSimulation, mutateGenome, XoshiroPRNG, remapBrain, plasticMotorEdges, type SimulationSettings} from '../simulation';
import {enableClosedEconomy} from '../energyEconomy';

export function gatedFixture(architecture: 'two-output'|'three-output' = 'two-output', width: 0|.06 = 0, id = 'CUR-001') {
  const config: SimulationSettings = {...DEFAULT_SETTINGS, physicsRegime: 'passive-work-v3',
    motorExperiment: 'gated-torque-v1', targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
  const parent = createFounderGenome(id), original = structuredClone(parent);
  const genome = makeGatedGenome(parent, architecture, width, 711);
  assert.deepEqual(parent, original);
  const state = createInitialWorld(config, 711, 'balanced', 'standard', 0);
  const org = addExternalOrganism(state, genome, config, 1200, 750, .37)!;
  return {state, config, org};
}
function fixed(f: ReturnType<typeof gatedFixture>, mode: number, command: number) {
  f.org.genome.weightsHO.forEach(row => row.fill(0));
  const n = f.org.genome.motorController!.architecture === 'two-output' ? 2 : 3;
  f.org.genome.biasesO = f.org.genome.biasesO.map((_, i) => Math.atanh(i % n === 0 ? mode : command));
}

test('all four explicit layouts preserve legacy parent genes; schemas reject missing/smuggled controller state', () => {
  for (const architecture of ['two-output', 'three-output'] as const) for (const width of [0, .06] as const) {
    const f = gatedFixture(architecture, width); validateGenome(f.org.genome);
    assert.equal(f.org.genome.outputKeys!.length, f.org.joints.length * (architecture === 'two-output' ? 2 : 3));
    const source = createSnapshot(f.state, f.config); assert.equal(source.schemaVersion, '16.0.0');
    assert.deepEqual(createSnapshot(restoreSnapshot(source).state, f.config), source);
    for (const alter of [
      (s: any) => {s.schemaVersion = '15.0.0'; delete s.settings.motorExperiment;},
      (s: any) => {delete s.state.organisms[0].joints[0].gateMode;},
      (s: any) => {s.state.organisms[0].genome.motorController.version = 'unknown';},
      (s: any) => {s.settings.physicsRegime = 'paid-work-v2';},
    ]) {const broken = structuredClone(source); alter(broken); assert.throws(() => restoreSnapshot(broken));}
    assert.throws(() => stepSimulation(f.state, {...f.config, motorExperiment: undefined}, 1/60), /explicit/);
  }
});

test('OFF is passive, direct reverses immediately, and joint commands remain independent', () => {
  for (const architecture of ['two-output', 'three-output'] as const) for (const width of [0, .06] as const) {
    const off = gatedFixture(architecture, width); fixed(off, -.99, .99);
    stepSimulation(off.state, off.config, 1/60);
    assert.ok(off.org.joints.every(j => j.gateMode === 'off' && j.appliedTorque === 0));
    assert.equal(off.state.ledger.mechanicalWorkHeat, 0);
    assert.ok(off.org.segments.every(p => Math.abs(p.vx) < 1e-8 && Math.abs(p.vy) < 1e-8));
    const forward = gatedFixture(architecture, width), reverse = gatedFixture(architecture, width);
    fixed(forward, 0, .001); fixed(reverse, 0, -.001);
    stepSimulation(forward.state, forward.config, 1/60); stepSimulation(reverse.state, reverse.config, 1/60);
    assert.ok(forward.org.joints.every(j => j.appliedTorque > 0));
    assert.ok(reverse.org.joints.every(j => j.appliedTorque < 0));
    const n = architecture === 'two-output' ? 2 : 3;
    forward.org.genome.biasesO[n] = Math.atanh(-.99);
    stepSimulation(forward.state, forward.config, 1/60);
    assert.equal(forward.org.joints[1].appliedTorque, 0);
    assert.ok(forward.org.joints[0].appliedTorque > 0);
    // OFF must not lock a moving hinge.
    fixed(forward, -.99, .99); const before = forward.org.segments[1].angle;
    stepSimulation(forward.state, forward.config, 1/60);
    assert.notEqual(forward.org.segments[1].angle, before);
    assert.ok(forward.org.joints.every(j => j.appliedTorque === 0));
  }
});

test('candidate work is prepaid at zero/tiny reserves and complete constraint batches stay passive', () => {
  for (const reserve of [0, 1e-12, .001, 10000]) {
    const f = gatedFixture(); fixed(f, 0, .99);
    f.state.ledger.externalInflow += reserve - f.org.energy; f.org.energy = reserve;
    stepSimulation(f.state, f.config, 1/60, undefined, (phase, a, b) => {
      if (phase === 'constraint-batch') assert.ok(b - a < 1e-12);
    });
    assert.ok(f.state.ledger.mechanicalWorkHeat <= reserve + 1e-10);
    assert.ok(Math.abs(totalAccountedEnergy(f.state) - f.state.ledger.externalInflow) < 1e-6);
    if (reserve === 0) assert.ok(f.org.joints.every(j => j.appliedTorque === 0));
  }
});

test('hysteresis state, learning and explicit layouts continue exactly through host snapshots in both economies', () => {
  for (const architecture of ['two-output', 'three-output'] as const) for (const closed of [false, true]) {
    const f = gatedFixture(architecture, .06);
    if (closed) {enableClosedEconomy(f.state); f.config.ecologyRegime = 'closed-v1'; f.config.nutrientLimit = null;}
    const g = f.org.genome; g.plasticityRate = .1; g.plasticMotorScope = 'all';
    assert.ok(plasticMotorEdges(g).length > 0);
    for (let i = 0; i < 12; i++) stepSimulation(f.state, f.config, 1/60);
    const host = new SimulationHost(); host.reset(createSnapshot(f.state, f.config), 1);
    measureWorkerTrial(host, 12);
    for (let i = 0; i < 12; i++) stepSimulation(f.state, f.config, 1/60);
    assert.deepEqual(host.snapshot(), createSnapshot(f.state, f.config));
    const child = mutateGenome(g, .25, new XoshiroPRNG(4), 'passive-work-v3');
    assert.deepEqual(child.motorController, g.motorController); validateGenome(child);
    // New body joints receive keyed channels; no six-channel fallback on remap.
    const old = structuredClone(g); g.parts = g.parts.slice(0, -1);
    g.eyes = []; g.mouths = []; remapBrain(g, old);
    assert.equal(g.outputKeys!.length, (g.parts.length - 1) * (architecture === 'two-output' ? 2 : 3));
  }
});

test('an actual bite can select OSCILLATOR from passive OFF on the very next sensory update', () => {
  for (const architecture of ['two-output', 'three-output'] as const) for (const width of [0, .06] as const) {
    const {state, config, victim, input} = gatedBiteFixture(architecture, width);
    stepSimulation(state, config, 1/60);
    assert.ok(victim.joints.every(j => j.gateMode === 'off'));
    assert.ok(victim.biteFeedbackJ! > 0, 'physical bite is required');
    stepSimulation(state, config, 1/60);
    assert.ok(victim.neuralInputs[input] > 0);
    assert.ok(victim.joints.every(j => j.gateMode === 'oscillator'));
    assert.ok(victim.joints.some(j => j.appliedTorque !== 0));
  }
});

test('actual force integration applies equal-and-opposite torques across unequal inertias', async () => {
  const sim = await import('../simulation');
  for (const childWidth of [2, 5]) {
    const base = sim.createReferenceNematodeGenome(new XoshiroPRNG(21));
    base.parts = base.parts.slice(0, 2); base.eyes = []; base.mouths = [];
    base.parts[1].dimN = childWidth; base.parts[1].width = childWidth * 7;
    remapBrain(base);
    const g = makeGatedGenome(base, 'three-output', .06, 1);
    g.weightsHO.forEach(row => row.fill(0)); g.biasesO = [0, Math.atanh(.001), 0];
    const config: SimulationSettings = {...DEFAULT_SETTINGS, motorExperiment:'gated-torque-v1',physicsRegime:'passive-work-v3',
      waterViscosity:0,gravity:0,targetNutrients:0,inflowRate:0};
    const state = createInitialWorld(config, 1, 'balanced', 'standard', 0);
    const o = addExternalOrganism(state, g, config, 1200, 750, 0)!;
    const inertia = o.genome.parts.map(p => Math.max(.35,p.dimN*p.dimM*sim.BASE_PART_DENSITY)*(p.width*p.width+p.height*p.height)/12);
    let forceSamples = 0, observed: number[] = [];
    stepSimulation(state,config,1/60,undefined, phase => {
      if (phase === 'forces-and-motors' && ++forceSamples === 2) observed = o.segments.map(p => p.angVel);
    });
    assert.equal(observed.length,2); assert.ok(observed[0]<0 && observed[1]>0);
    assert.ok(Math.abs(inertia[0]*observed[0]+inertia[1]*observed[1])<1e-10);
    assert.ok(Math.abs(Math.abs(observed[0]/observed[1])-inertia[1]/inertia[0])<1e-12);
  }
});

test('ecology head conversion retains initialized weights and rejects existing personal state', () => {
  for (const architecture of ['two-output', 'three-output'] as const) {
    const config = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0};
    const state = createInitialWorld(config, 17, 'balanced', 'showcase');
    const org = state.organisms[0], previous = structuredClone(org.genome);
    const expected = makeGatedGenome(previous, architecture, .06, 17);
    const recurrent = [...org.neuralHidden], reserve = org.energy;
    installNewbornGatedHead(org, architecture, .06, 17);
    assert.deepEqual(org.genome, expected);
    assert.ok(org.genome.weightsHO.some(row => row.some(x => x !== 0)));
    assert.deepEqual(org.neuralHidden, recurrent); assert.equal(org.energy, reserve);
    assert.equal(org.neuralOutputs.length, expected.outputKeys!.length);
    assert.ok(org.joints.every(j => j.gateMode === 'direct'));
    assert.throws(() => installNewbornGatedHead(org, architecture, 0, 17), /untouched/);
    state.organisms[1].age = .1;
    assert.throws(() => installNewbornGatedHead(state.organisms[1], architecture, 0, 17), /untouched/);
  }
});
