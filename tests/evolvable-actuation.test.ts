import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createSnapshot, restoreSnapshot, validateGenome, totalAccountedEnergy, LEGACY_SETTINGS} from '../persistence';

const settings = {...LEGACY_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0, waterViscosity: .22};
const world = (seed = 451) => createInitialWorld(settings, seed, 'unbiased', 'standard', 0);
const rng = (seed: number) => new sim.XoshiroPRNG(seed);
function command(org: sim.Organism, name: string, value: number, joint = 0) {
  const p = org.genome.parts[joint + 1];
  const index = org.genome.outputKeys!.indexOf(`joint:${p.id}:${name}`);
  assert.ok(index >= 0);
  // Isolate commanded channels without relying on any scripted thrust.
  org.genome.weightsHO[index].fill(0);
  org.genome.biasesO[index] = Math.atanh(value);
}
function isolate(g: sim.Genome, seed = 451) {
  const s = world(seed);
  const org = addExternalOrganism(s, g, settings, 1200, 750, 0)!;
  org.genome.maturityAge = 1000;
  org.genome.weightsHO.forEach(row => row.fill(0));
  org.genome.biasesO.fill(0);
  return {s, org};
}
const tick = (s: sim.SimulationState, n = 1) => {
  for (let i = 0; i < n; i++) sim.stepSimulation(s, settings, 1 / 60);
};

test('old default sine formula remains mathematically identical for every founder', () => {
  for (const id of ['FND-001', 'FND-031', 'FND-051']) {
    const g = createFounderGenome(id);
    for (const p of g.parts.slice(1)) {
      assert.equal(p.oscillatorMix, undefined);
      assert.equal(p.waveHarmonics, undefined);
      for (const phase of [-3.7, -.8, 0, .4, 2.3, 6.2]) for (const amp of [0, .25, 1, 1.75]) for (const angle of [-.9, 0, .9]) {
        const wave = Math.sin(phase) * p.cpgAmp * amp;
        const oldTarget = sim.clampVal((wave + angle * .45) * p.maxAngle, -p.maxAngle, p.maxAngle);
        assert.equal(sim.calculateJointMotorTarget(p, phase, amp, angle), oldTarget);
      }
    }
    assert.deepEqual(validateGenome(g), g);
  }
});

test('inherited zero oscillator produces arbitrary full-range neural postures without a wave', () => {
  const p = {...createFounderGenome('FND-001').parts[1], oscillatorMix: 0, waveHarmonics: [1, -.3, .7, .1]};
  for (const phase of [-2, -.1, 0, 1.2, 3.7, 9.1]) {
    assert.equal(sim.calculateJointMotorTarget(p, phase, 1, .9), .9 * p.maxAngle);
    assert.equal(sim.calculateJointMotorTarget(p, phase, 0, -.9), -.9 * p.maxAngle);
    assert.equal(sim.calculateJointMotorTarget(p, phase, 1.75, 0), 0);
  }
  assert.equal(sim.calculateJointMotorTarget(p, 1, 1, 1), p.maxAngle);
  assert.equal(sim.calculateJointMotorTarget(p, 1, 1, -1), -p.maxAngle);
});

test('smooth evolved harmonics remain periodic and bounded without sawtooth discontinuities', () => {
  assert.equal(sim.evaluateMotorWave(.3), Math.sin(.3));
  assert.equal(sim.evaluateMotorWave(.3, [0,0,0,0]), Math.sin(.3));
  const coefficients = [-.5, 1 / 3, -.25, .2]; // Sawtooth-like Fourier combination.
  for (let i = -1500; i <= 1500; i++) {
    const p = i * .037, wave = sim.evaluateMotorWave(p, coefficients);
    assert.ok(Number.isFinite(wave) && Math.abs(wave) <= 1 + 1e-14);
    assert.ok(Math.abs(wave - sim.evaluateMotorWave(p + Math.PI * 2, coefficients)) < 1e-12);
  }
  assert.ok(Math.abs(sim.evaluateMotorWave(.6, coefficients) - Math.sin(.6)) > .02);
  const wrap = Math.PI * 2;
  assert.ok(Math.abs(sim.evaluateMotorWave(wrap - 1e-5, coefficients) -
    sim.evaluateMotorWave(wrap + 1e-5, coefficients)) < .0002);
});

test('evolvable mixed rhythm gives independent joint control and brain-adjustable suppression', () => {
  const g = createFounderGenome('FND-001');
  g.parts[1].oscillatorMix = 0;
  g.parts[1].waveHarmonics = [0, 0, 0, 0];
  g.parts[2].oscillatorMix = 1;
  const {s, org} = isolate(g);
  command(org, 'Angle', .8, 0);
  command(org, 'Angle', -.8, 1);
  tick(s, 4);
  const first = org.joints[0].targetAngle, second = org.joints[1].targetAngle;
  assert.ok(Math.abs(first - .8 * g.parts[1].maxAngle) < 1e-12);
  assert.ok(second !== -.8 * g.parts[2].maxAngle);
  tick(s, 40);
  assert.ok(Math.abs(org.joints[0].targetAngle - first) < 1e-12);
  assert.ok(Math.abs(org.joints[1].targetAngle - second) > 1e-3);
  assert.ok(org.joints.every(j => Number.isFinite(j.targetAngle)));
  assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-5);
});

test('neural amplitude zero silences an evolved rhythmic joint yet preserves full direct positioning', () => {
  const g = createFounderGenome('FND-001');
  g.parts[1].oscillatorMix = .7;
  g.parts[1].waveHarmonics = [.4, -.3, .1, 0];
  const {s, org} = isolate(g);
  command(org, 'Angle', .8);
  command(org, 'Amp', -.9);
  tick(s, 130);
  assert.equal(org.joints[0].amplitude, 0);
  assert.ok(Math.abs(org.joints[0].targetAngle - .8 * g.parts[1].maxAngle) < 1e-10);
  assert.ok(org.joints[0].engagement! > .99, 'a silenced oscillator does not disengage the physical muscle');
  assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-5);
});

test('physical joints cannot move or create thrust without applied motor forces', () => {
  const g = createFounderGenome('FND-001');
  for (const p of g.parts.slice(1)) {
    p.oscillatorMix = 0;
    p.waveHarmonics = [.3, -.4, .2, -.1];
  }
  g.motorForce = 0;
  const {s, org} = isolate(g);
  command(org, 'Angle', .9);
  const start = sim.calculateOrganismCOM(org);
  tick(s, 30);
  const end = sim.calculateOrganismCOM(org);
  assert.ok(Math.hypot(end.x - start.x, end.y - start.y) < 1e-8);
  assert.equal(s.ledger.mechanicalWorkHeat, 0);
  assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-5);
});

test('genetic waveform and rhythm mutations are inherited, deterministic and parent-isolated', () => {
  const g = createFounderGenome('FND-001'), unchanged = structuredClone(g);
  const identical = sim.mutateGenome(g, 0, rng(11));
  assert.deepEqual(identical.parts, g.parts);
  let firstSeed = 0;
  let evolved: sim.Genome | null = null;
  for (let seed = 1; seed <= 140; seed++) {
    const candidate = sim.mutateGenome(g, 1, rng(seed));
    if (candidate.parts.some(p => p.oscillatorMix !== undefined && p.oscillatorMix < 1)
      && candidate.parts.some(p => p.waveHarmonics?.some(x => x !== 0))) {
      firstSeed = seed; evolved = candidate; break;
    }
  }
  assert.ok(evolved, 'bounded seed sweep must find a fully evolved mixed rhythmic genome');
  assert.deepEqual(sim.mutateGenome(g, 1, rng(firstSeed)), evolved);
  assert.deepEqual(g, unchanged);
  assert.deepEqual(validateGenome(evolved), evolved);
  const inherited = sim.mutateGenome(evolved, 0, rng(201));
  assert.deepEqual(inherited.parts, evolved.parts);
});

test('current save continuation preserves optional motor genes, phases and energy exactly', () => {
  const g = createFounderGenome('FND-001');
  g.parts[1].oscillatorMix = .35;
  g.parts[1].waveHarmonics = [-.5, .33, -.25, .2];
  g.parts[2].oscillatorMix = 0;
  const {s, org} = isolate(g);
  command(org, 'Angle', .7);
  command(org, 'Amp', -.8);
  tick(s, 11);
  const saved = createSnapshot(s, settings), restored = restoreSnapshot(saved);
  assert.equal(saved.schemaVersion, '16.0.0', 'motor alleles coexist with the current save schema');
  assert.deepEqual(createSnapshot(restored.state, settings), saved);
  tick(s, 9); tick(restored.state, 9);
  assert.deepEqual(createSnapshot(restored.state, settings), createSnapshot(s, settings));
  assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-5);
});

test('v10 legacy genotypes stay byte-stable through import with exact original motion', () => {
  const s = world();
  addExternalOrganism(s, createFounderGenome('FND-051'), settings, 1200, 750, 0);
  tick(s, 3);
  const original = createSnapshot(s, settings), restored = restoreSnapshot(original);
  assert.deepEqual(createSnapshot(restored.state, settings), original);
  tick(s, 4); tick(restored.state, 4);
  assert.deepEqual(createSnapshot(restored.state, settings), createSnapshot(s, settings));
});

test('invalid motor coefficients and blend ranges are rejected at snapshot validation', () => {
  const g = createFounderGenome('FND-001');
  const invalid = (mutate: (p: sim.PartDef) => void) => {
    const copy = structuredClone(g); mutate(copy.parts[1]);
    assert.throws(() => validateGenome(copy), /Invalid snapshot/);
  };
  invalid(p => {p.oscillatorMix = -0.1;});
  invalid(p => {p.oscillatorMix = 1.1;});
  invalid(p => {p.oscillatorMix = NaN;});
  invalid(p => {p.oscillatorMix = '0' as unknown as number;});
  invalid(p => {p.waveHarmonics = [0,0,0];});
  invalid(p => {p.waveHarmonics = [0,0,0,0,0];});
  invalid(p => {p.waveHarmonics = [0,0,1.01,0];});
  invalid(p => {p.waveHarmonics = [0,0,NaN,0];});
});
