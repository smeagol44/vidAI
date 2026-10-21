import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createFounderGenome} from '../founders';
import {createInitialWorld, addExternalOrganism} from '../world';
import {LEGACY_SETTINGS, totalAccountedEnergy} from '../persistence';

// Four seeded, paired counterfactuals. Compare identical genomes/settings;
// blanking retinal synapses holds the no-target baseline, not the whole brain.
const settings = {...LEGACY_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};
const ox = 1200, oy = 750, seconds = 3, dt = 1 / 60;
function removeVisualWeights(g: sim.Genome) {
  for (let i = 0; i < g.inputKeys!.length; i++) {
    const key = g.inputKeys![i];
    if (!key.startsWith('eye:')) continue;
    const type = key.split(':').at(-1);
    const baseline = type === 'distance' ? 1 : 0;
    g.weightsIH.forEach((row, h) => {g.biasesH[h] += row[i] * baseline; row[i] = 0;});
  }
}
function makeTrial(side: -1 | 1, seen: boolean, threat: boolean, seed: number) {
  const s = createInitialWorld(settings, seed, 'balanced', 'standard', 0);
  const g = createFounderGenome('FND-001');
  if (!seen) removeVisualWeights(g);
  const org = addExternalOrganism(s, g, settings, ox, oy, 0)!;
  org.genome.maturityAge = 1000;
  // Eye rays are at +/-0.5 rad; aiming a target at their bearings
  // makes a visible stimulus instead of an accidental retinal miss.
  const angle = side * .5, distance = 175;
  const targetX = ox + Math.cos(angle) * distance, targetY = oy + Math.sin(angle) * distance;
  if (threat) {
    const predator = createFounderGenome('FND-031');
    predator.motorForce = 0; predator.maturityAge = 1000;
    const other = addExternalOrganism(s, predator, settings, targetX, targetY, Math.PI)!;
    other.genome.motorForce = 0;
  } else {
    s.nutrients.push({id: 'single-visible-nutrient', x: targetX, y: targetY, vx: 0, vy: 0,
      kind: 'nutrient', energyValue: 3000, radius: sim.getNutrientRadius(3000), bottomTimer: 0, pulseTimer: 0});
    s.ledger.externalInflow += 3000;
  }
  const initial = totalAccountedEnergy(s);
  const before = sim.calculateOrganismCOM(org);
  sim.stepSimulation(s, settings, dt);
  const hits = org.rayHits.filter(r => r.hit && (threat ? r.objectType === 'creature' : r.objectType === 'nutrient'));
  const angleOutput = org.neuralOutputs.find((_, i) => org.genome.outputKeys![i].endsWith(':Angle')) ?? 0;
  for (let t = 1; t < seconds * 60; t++) sim.stepSimulation(s, settings, dt);
  const after = sim.calculateOrganismCOM(org);
  const endDistance = Math.hypot(after.x - targetX, after.y - targetY);
  const startDistance = Math.hypot(before.x - targetX, before.y - targetY);
  const consumed = s.nutrients.length ? 3000 - s.nutrients[0].energyValue : threat ? 0 : 3000;
  const energyError = totalAccountedEnergy(s) - initial;
  return {seed, side, vision: seen, threat, hits: hits.length, angleOutput,
    startDistance, endDistance, progressPx: startDistance - endDistance,
    eatenJ: consumed, deltaX: after.x - before.x, deltaY: after.y - before.y, energyError};
}
test('controlled seeded retina on/off microtrials report seeing, motor response and actual displacement separately', () => {
  const pairs = [];
  for (const threat of [false, true]) for (const side of [-1, 1] as const) {
    const seed = threat ? 503 : 502;
    const sight = makeTrial(side, true, threat, seed);
    const blind = makeTrial(side, false, threat, seed);
    assert.ok(sight.hits > 0, 'stimulus must be physically visible before comparing behavior');
    assert.ok(Math.abs(sight.energyError) < 1e-5 && Math.abs(blind.energyError) < 1e-5);
    assert.equal(sight.startDistance, blind.startDistance);
    pairs.push({scenario: threat ? 'creature threat' : 'food', side,
      visualHitCount: sight.hits,
      turnOutputDifference: sight.angleOutput - blind.angleOutput,
      sightedProgressPx: sight.progressPx, blindProgressPx: blind.progressPx,
      sightedConsumedJ: sight.eatenJ, blindConsumedJ: blind.eatenJ,
      sightedDx: sight.deltaX, blindDx: blind.deltaX,
      sightedDy: sight.deltaY, blindDy: blind.deltaY});
  }
  console.log('VIDA_PHASE5_BASELINE '+JSON.stringify(pairs));
});

test('calibrated founder movement is measured against actual eye/mouth orientation', () => {
  const results = [];
  for (const id of ['FND-001', 'FND-006', 'FND-021', 'FND-031', 'FND-051']) {
    const g = createFounderGenome(id);
    const s = createInitialWorld(settings, 210, 'balanced', 'standard', 0);
    const org = addExternalOrganism(s, g, settings, ox, oy, 0)!;
    org.genome.maturityAge = 1000;
    const before = sim.calculateOrganismCOM(org), energy = totalAccountedEnergy(s);
    for (let i = 0; i < seconds * 60; i++) sim.stepSimulation(s, settings, dt);
    const after = sim.calculateOrganismCOM(org);
    assert.ok(Math.abs(totalAccountedEnergy(s) - energy) < 1e-5);
    if (id === 'FND-001') assert.ok(after.x > before.x + 30, 'head-first founder gait');
    if (id === 'FND-051') assert.ok(after.x > before.x + 25, 'do not reverse forward bell swimmers');
    results.push({id, name: g.name, diet: g.mouths.map(m => m.mouthType),
      eyes: g.eyes.map(e => e.direction), mouths: g.mouths.map(m => m.direction),
      displacementX: after.x - before.x, displacementY: after.y - before.y,
      heading: org.segments[0].angle});
  }
  console.log('VIDA_PHASE5_LOCOMOTION '+JSON.stringify(results));
});

test('phase-corrected head-first swimming is evaluated against physically reachable food', () => {
  const results = [];
  for (const mode of ['legacy-backward', 'head-first', 'head-first-blind'] as const) {
    // Isolate the physics-only head-first gait experiment from later
    // founder-specific balanced retinal-weight calibration.
    const g = createFounderGenome('FND-001', 'unbiased');
    if (mode === 'legacy-backward') for (const p of g.parts.slice(1)) p.cpgPhaseOffset *= -1;
    if (mode === 'head-first-blind') removeVisualWeights(g);
    const s = createInitialWorld(settings, 210, 'balanced', 'standard', 0);
    const org = addExternalOrganism(s, g, settings, ox, oy, 0)!;
    org.genome.maturityAge = 1000;
    const targetX = ox + 110, targetY = oy;
    s.nutrients.push({id: 'front-food', x: targetX, y: targetY, vx: 0, vy: 0,
      kind: 'nutrient', energyValue: 3000, radius: sim.getNutrientRadius(3000), bottomTimer: 0, pulseTimer: 0});
    s.ledger.externalInflow += 3000;
    const before = sim.calculateOrganismCOM(org), originalEnergy = totalAccountedEnergy(s);
    for (let i = 0; i < 6 * 60; i++) sim.stepSimulation(s, settings, dt);
    const after = sim.calculateOrganismCOM(org);
    assert.ok(Math.abs(totalAccountedEnergy(s) - originalEnergy) < 1e-5);
    results.push({mode, dx: Number((after.x - before.x).toFixed(1)),
      eatenJ: 3000 - s.nutrients.reduce((total, n) => total + n.energyValue, 0),
      feedEvents: org.recentFeedings?.length ?? 0, endDistance: Math.hypot(after.x - targetX, after.y - targetY)});
  }
  const legacy = results.find(v => v.mode === 'legacy-backward')!;
  const forward = results.find(v => v.mode === 'head-first')!;
  const blind = results.find(v => v.mode === 'head-first-blind')!;
  assert.ok(legacy.dx < -100 && legacy.eatenJ === 0);
  assert.ok(forward.dx > 160 && forward.eatenJ > 2000 && forward.feedEvents > 0);
  assert.ok(blind.dx > 160 && blind.eatenJ > 2000);
  // The improvement in this centered, directly reachable geometry is
  // primarily physical access. Unbiased retina noise can move the contact
  // event by one or two ticks, so do not assert identical bite timestamps.
  assert.ok(Math.abs(forward.eatenJ - blind.eatenJ) <= 120);
  console.log('VIDA_PHASE5_FEEDING_ALIGNMENT '+JSON.stringify(results));
});

test('existing snapshots preserve legacy FND-001 gait phases and deterministic continuation', async () => {
  const {createSnapshot, restoreSnapshot} = await import('../persistence');
  const current = createFounderGenome('FND-001');
  const old = structuredClone(current);
  for (const p of old.parts.slice(1)) p.cpgPhaseOffset *= -1;
  const w = createInitialWorld(settings, 901, 'unbiased', 'standard', 0);
  addExternalOrganism(w, old, settings, ox, oy, 0);
  const saved = createSnapshot(w, settings), restored = restoreSnapshot(saved);
  assert.deepEqual(restored.state.organisms[0].genome.parts.map(p=>p.cpgPhaseOffset),
    old.parts.map(p=>p.cpgPhaseOffset));
  assert.notDeepEqual(current.parts.map(p=>p.cpgPhaseOffset),old.parts.map(p=>p.cpgPhaseOffset));
  for(let i=0;i<4;i++) {
    sim.stepSimulation(w,settings,dt);
    sim.stepSimulation(restored.state,settings,dt);
  }
  assert.deepEqual(createSnapshot(restored.state,settings),createSnapshot(w,settings));
});
