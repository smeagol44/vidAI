import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {createSnapshot, restoreSnapshot, LEGACY_SETTINGS, totalAccountedEnergy} from '../persistence';

// Paired off-axis perception/action trials: controller receives only retinal
// RGB/distance and its existing internal senses. Target coordinates are used
// by the test for setup and metrics, NEVER by the creature or its motor kernel.
const settings = {...LEGACY_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
type Mode = 'calibrated' | 'legacy-visual' | 'retinal-blind';
type Stimulus = 'food' | 'body';
const ox = 1200, oy = 750, dt = 1 / 60;

/** Reconstruct the pre-calibration neural *alleles*, not an older code path.
 * This isolates exactly the genetic weight edit from anatomical or physics
 * changes. Mutation/save compatibility depends on weights, not a reflex flag.
 */
function legacyRetinalAlleles(g: sim.Genome): void {
  const spectrum = [-.5, 1, -.25]; // Herbivore RGB contrast; NOT a target-type oracle.
  g.eyes.forEach(eye => {
    for (let ray = 0; ray < sim.RAYS_PER_EYE; ray++) {
      const angle = sim.getCardinalBaseAngle(eye.direction)
        + (ray / (sim.RAYS_PER_EYE - 1) - .5) * eye.fov;
      for (let channel = 0; channel < 3; channel++) {
        const key = `eye:${eye.id}:ray:${ray}:${['red', 'green', 'blue'][channel]}`;
        const input = g.inputKeys!.indexOf(key);
        assert.ok(input >= 0);
        const delta = (.2 - 1.5) * Math.sin(angle) * spectrum[channel] / Math.sqrt(g.eyes.length);
        g.weightsIH[0][input] += delta;
        g.weightsIH[1][input] -= delta;
      }
    }
  });
  for (let j = 1; j < g.parts.length; j++) {
    const output = g.outputKeys!.indexOf(`joint:${g.parts[j].id}:Angle`);
    assert.ok(output >= 0);
    g.weightsHO[output][0] += .54; // 0.04 - (-0.5)
    g.weightsHO[output][1] -= .54; // -0.04 - (+0.5)
  }
}

function disconnectVision(g: sim.Genome): void {
  g.inputKeys!.forEach((key, input) => {
    if (!key.startsWith('eye:')) return;
    const darkWaterBaseline = key.endsWith(':distance') ? 1 : 0;
    g.weightsIH.forEach((row, h) => {
      g.biasesH[h] += row[input] * darkWaterBaseline;
      row[input] = 0;
    });
  });
}

function trial(side: -1 | 1, distance: number, mode: Mode, stimulus: Stimulus = 'food') {
  const g = createFounderGenome('FND-001', 'balanced');
  if (mode === 'legacy-visual') legacyRetinalAlleles(g);
  if (mode === 'retinal-blind') disconnectVision(g);
  const s = createInitialWorld(settings, 510, 'balanced', 'standard', 0);
  const org = addExternalOrganism(s, g, settings, ox, oy, 0)!;
  org.genome.maturityAge = 1000;
  const angle = side * .5, x = ox + Math.cos(angle) * distance, y = oy + Math.sin(angle) * distance;
  if (stimulus === 'food') {
    s.nutrients.push({id: 'food', x, y, vx: 0, vy: 0, energyValue: 3000,
      radius: sim.getNutrientRadius(3000), bottomTimer: 0, pulseTimer: 0});
    s.ledger.externalInflow += 3000;
  } else {
    const donor = createFounderGenome('FND-031', 'unbiased');
    donor.motorForce = 0;
    donor.maturityAge = 1000;
    addExternalOrganism(s, donor, settings, x, y, Math.PI);
  }
  const initialEnergy = totalAccountedEnergy(s);
  const initial = sim.calculateOrganismCOM(org);
  let hitCount = 0, motor = 0, closest = Infinity;
  for (let tick = 0; tick < 360; tick++) {
    sim.stepSimulation(s, settings, dt);
    if (tick === 0) {
      hitCount = org.rayHits.filter(r => r.hit
        && r.objectType === (stimulus === 'food' ? 'nutrient' : 'creature')).length;
      motor = org.neuralOutputs.find((_, i) => org.genome.outputKeys![i].endsWith(':Angle')) ?? 0;
      // The brain's sensory array is raw RGB and distance. It has no access
      // to the RayHit objectType diagnostics used here by the TEST.
      for (const [e, eye] of g.eyes.entries()) {
        for (let r = 0; r < sim.RAYS_PER_EYE; r++) {
          const hit = org.rayHits[e * sim.RAYS_PER_EYE + r];
          const start = g.inputKeys!.indexOf(`eye:${eye.id}:ray:${r}:red`);
          assert.deepEqual(org.neuralInputs.slice(start, start + 3), [hit.r, hit.g, hit.b]);
        }
      }
    }
    const p = sim.calculateOrganismCOM(org);
    closest = Math.min(closest, Math.hypot(p.x - x, p.y - y));
  }
  const final = sim.calculateOrganismCOM(org);
  assert.ok(Math.abs(totalAccountedEnergy(s) - initialEnergy) < .0001);
  const eaten = stimulus === 'food'
    ? 3000 - s.nutrients.reduce((sum, n) => sum + n.energyValue, 0) : 0;
  return {side, distance, mode, stimulus, hitCount,
    motor: +motor.toFixed(4), dx: +(final.x - initial.x).toFixed(1),
    dy: +(final.y - initial.y).toFixed(1), closest: +closest.toFixed(1), eaten};
}

test('balanced Darter visually approaches off-axis plant food; genetic prior, not target-coordinate steering', () => {
  const rows = [];
  let eatenWithEyes = 0, successes = 0;
  for (const side of [-1, 1] as const) for (const distance of [110, 135, 160, 190]) {
    const sight = trial(side, distance, 'calibrated');
    const previous = trial(side, distance, 'legacy-visual');
    const blind = trial(side, distance, 'retinal-blind');
    assert.ok(sight.hitCount > 0 && previous.hitCount > 0, 'food was visible on physical eye rays');
    assert.ok(sight.closest < blind.closest - 10, 'sight actually changes physical proximity');
    assert.equal(previous.eaten, 0, 'legacy weak neural weights did not contact off-axis food');
    assert.equal(blind.eaten, 0, 'corrected locomotion without visual input is insufficient');
    if (sight.eaten > 0) successes++;
    eatenWithEyes += sight.eaten;
    rows.push({side, distance, calibrated: sight, original: previous, blinded: blind});
  }
  assert.ok(successes >= 7, 'neural visual steering should allow physical contact in most target geometries');
  assert.ok(eatenWithEyes > 6500, 'feeding improvement should transfer real food energy');
  console.log('PHASE5C_REPRODUCIBLE_FORAGING ' + JSON.stringify({successes, trials: 8, eatenWithEyes, rows}));
});

test('seeing a colored creature is not equivalent to recognizing a predator or escaping', () => {
  const rows = [];
  for (const side of [-1, 1] as const) {
    const sight = trial(side, 160, 'calibrated', 'body');
    const blind = trial(side, 160, 'retinal-blind', 'body');
    assert.ok(sight.hitCount > 0);
    assert.ok(Number.isFinite(sight.closest) && Number.isFinite(blind.closest));
    rows.push({side, sight, blind});
  }
  // Deliberately NO assertion that the foreign body is dangerous. VIDA
  // currently exposes pigment RGB, not predator identity or intent.
  console.log('PHASE5C_BODY_COLOR_LIMIT '+JSON.stringify(rows));
});

test('new inherited retinal weights do not rewrite old saved animals or PRNG continuation', () => {
  const old = createFounderGenome('FND-001', 'balanced');
  legacyRetinalAlleles(old);
  const s = createInitialWorld(settings, 525, 'unbiased', 'standard', 0);
  const org = addExternalOrganism(s, old, settings, ox, oy, 0)!;
  for (let t = 0; t < 3; t++) sim.stepSimulation(s, settings, dt);
  const snapshot = createSnapshot(s, settings);
  const restored = restoreSnapshot(snapshot);
  assert.deepEqual(restored.state.organisms[0].genome, org.genome);
  assert.deepEqual(restored.state.prng.getState(), s.prng.getState());
  for (let t = 0; t < 6; t++) {
    sim.stepSimulation(s, settings, dt);
    sim.stepSimulation(restored.state, settings, dt);
  }
  assert.deepEqual(createSnapshot(s, settings), createSnapshot(restored.state, settings));
  const child = sim.mutateGenome(createFounderGenome('FND-001', 'balanced'), 0, new sim.XoshiroPRNG(8));
  assert.deepEqual(child.weightsIH, createFounderGenome('FND-001', 'balanced').weightsIH);
  assert.deepEqual(child.weightsHO, createFounderGenome('FND-001', 'balanced').weightsHO);
  assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < .0001);
});

test('non-Darter founders retain separate weak priors; unbiased Darter does not receive tuned prior', () => {
  const other = createFounderGenome('FND-031', 'balanced');
  const otherAgain = createFounderGenome('FND-031', 'balanced');
  assert.deepEqual(other, otherAgain);
  const unbiased = createFounderGenome('FND-001', 'unbiased');
  const balanced = createFounderGenome('FND-001', 'balanced');
  assert.notDeepEqual(unbiased.weightsIH, balanced.weightsIH);
  assert.notDeepEqual(unbiased.weightsHO, balanced.weightsHO);
  assert.deepEqual(createFounderGenome('FND-001', 'unbiased'), unbiased);
});
