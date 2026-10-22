import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {FEATURED_BLUEPRINTS} from '../founders';
import {observeSolver, jointErrors} from '../solverPassivityAudit';
import {mechanicalFixture, mechanicalRecorder, placeChildBeyondLimit} from '../mechanicalAudit';
import {stepSimulation, type SimulationSettings} from '../simulation';
import {createInitialWorld, collectWorldStats} from '../world';
import {DEFAULT_SETTINGS, totalAccountedEnergy} from '../persistence';
import {EcologyIntakeObserver} from '../ecologyAudit';

const controls = [];
for (const kind of ['anchor', 'limit']) for (const physicsRegime of ['paid-work-v2', 'passive-work-v3'] as const) {
  const f = mechanicalFixture(); f.config.physicsRegime = physicsRegime;
  if (kind === 'anchor') f.org.segments[1].x += 1; else placeChildBeyondLimit(f.org);
  const recorder = mechanicalRecorder();
  for (let i = 0; i < 6; i++) stepSimulation(f.state, f.config, 1 / 60, undefined, recorder.observe);
  controls.push({kind, physicsRegime, ...jointErrors(f.org), phases: recorder.phases});
}
const swimming: ReturnType<typeof observeSolver>[] = [];
for (const design of FEATURED_BLUEPRINTS) for (const [heading, viscosity] of [[.37, .18], [.8, .15], [-1, .22]]) {
  for (const physicsRegime of ['paid-work-v2', 'passive-work-v3'] as const) {
    const row = observeSolver(design.id, physicsRegime, 5, heading, viscosity);
    assert.ok(row.maxConstraintGainJ < 1e-12); assert.ok(Math.abs(row.chemicalErrorJ) < 1e-6);
    swimming.push(row);
  }
}
for (let i = 0; i < swimming.length; i += 2) {
  const old = swimming[i], fixed = swimming[i + 1];
  assert.ok(fixed.displacementPx >= .9 * old.displacementPx && fixed.displacementPx <= 1.1 * old.displacementPx, old.id + ': travel');
  assert.ok(fixed.reserveSpentJ >= .9 * old.reserveSpentJ && fixed.reserveSpentJ <= 1.1 * old.reserveSpentJ, old.id + ': expenditure');
  assert.ok(fixed.guards <= old.guards, old.id + ': added guards');
  assert.ok(fixed.maxAnchorErrorPx < .5, old.id + ': hinge drift');
}
const ecology = [];
for (const seed of [17, 73]) for (const physicsRegime of ['paid-work-v2', 'passive-work-v3'] as const) {
  const config: SimulationSettings = {...DEFAULT_SETTINGS, physicsRegime, mouthContactModel: 'capsule-v1', ecologyRegime: 'closed-v1', nutrientLimit: null};
  const state = createInitialWorld(config, seed, 'balanced', 'showcase'), intake = new EcologyIntakeObserver();
  const started = performance.now(); let maxErrorJ = 0, guards = 0, limitedBatches = 0;
  for (let i = 0; i < 3600; i++) {
    stepSimulation(state, config, 1 / 60); intake.sample(state);
    maxErrorJ = Math.max(maxErrorJ, Math.abs(totalAccountedEnergy(state) - state.energyPool!.budget));
    for (const org of state.organisms) {guards += org.motorDiagnostics?.numericalGuardEvents ?? 0; limitedBatches += org.motorDiagnostics?.constraintLimitedBatches ?? 0;}
  }
  const row = {seed, physicsRegime, seconds: 60, ...collectWorldStats(state, config.targetNutrients),
    absorbedJ: intake.totals(), reserveJ: state.energyPool!.reserve, maxErrorJ, guards, limitedBatches, runtimeMs: Math.round(performance.now() - started)};
  ecology.push(row); console.log(JSON.stringify(row)); assert.ok(maxErrorJ < 1e-6);
}
const rejectedPrototypes = [
  {method: 'Zero velocity bias, unilateral limit response and unconditional pose projection',
    lanternPx: 20.757173984062494, broadwakePx: 27.31097465923608, reason: 'Lantern -54%, Broadwake +32%; blocked.'},
  {method: 'Limit every individual constraint impulse and project pose on a limited impulse',
    lanternPx: 20.33005483747289, broadwakePx: 29.26830182175761, reason: 'Lantern -55%, Broadwake +41%; blocked.'},
  {method: 'Passive complete batch, but project after every partial limitation',
    lanternPx: 43.109146055046295, lanternGuards: 355, reason: 'Three additional guard events; rejected.'},
];
writeFileSync(process.argv[2] ?? 'docs/experiments/solver-passivity-v3.json', JSON.stringify({protocol: 'passive-joint-batch-v3',
  seed: 711, controls, swimming, ecology, rejectedPrototypes,
  notes: ['The accepted full joint solve is passive; provisional internal iterations are not separately physical steps.',
    'Retain the historical batch exactly if dissipative. Otherwise scale its aggregate velocity increment using its quadratic work.',
    'When no non-energizing velocity correction is available (within floating-point zero), repair pose without changing velocity before advancement.',
    'Drag, muscles, paid motor work, genes and diet are unchanged. Historical regimes keep exact equations and saves.',
    'This bounds joint-batch kinetic gain, not wall/fluid potential, all contact fidelity, angular momentum error or speed-clamp dependence.',
    'Short paired ecology and headless timing are observations, not proof of sustainable populations or browser FPS.']}, null, 2) + '\n');
