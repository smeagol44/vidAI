import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FEATURED_BLUEPRINTS, FEATURED_STARTER_SPECS, FOUNDER_BLUEPRINTS,
  createFounderBankItems, createFounderGenome, sampleFounderGenomes} from '../founders';
import * as sim from '../simulation';
import {DEFAULT_SETTINGS, totalAccountedEnergy, validateGenome} from '../persistence';
import {addExternalOrganism, createInitialWorld} from '../world';

const settings = {...DEFAULT_SETTINGS, worldWidth: 2400, worldHeight: 1500,
  targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};

test('nine distinct, mutable featured designs coexist with 55 original legacy identities', () => {
  const bank = createFounderBankItems();
  assert.equal(FEATURED_BLUEPRINTS.length, 9);
  assert.equal(FOUNDER_BLUEPRINTS.length, 55);
  assert.equal(bank.length, 64);
  assert.deepEqual(FEATURED_BLUEPRINTS.map(x => x.diet).sort(),
    ['herbivore', 'herbivore', 'herbivore', 'herbivore',
      'omnivore', 'omnivore', 'omnivore', 'carnivore', 'carnivore'].sort());
  assert.equal(new Set(FEATURED_BLUEPRINTS.map(x => x.family)).size, 9);
  assert.equal(bank.filter(x => x.tags.includes('Featured')).length, 9);
  assert.equal(bank.filter(x => x.tags.includes('Legacy')).length, 55);
  for (const spec of FEATURED_STARTER_SPECS) {
    const legacy = createFounderGenome(spec.source);
    const featured = createFounderGenome(spec.id);
    assert.notEqual(featured.id, legacy.id);
    assert.equal(featured.mouths[0].mouthType, legacy.mouths[0].mouthType);
    assert.deepEqual(featured.parts.map(p => [p.parentIndex, p.attachmentPoint, p.dimN, p.dimM]),
      legacy.parts.map(p => [p.parentIndex, p.attachmentPoint, p.dimN, p.dimM]));
    assert.ok(featured.parts.every(p => p.id.startsWith(spec.id)));
    assert.ok(featured.eyes.every(e => e.id.startsWith(spec.id)
      && e.spectralSensitivity?.every(v => v >= 0 && v <= 1)));
    assert.deepEqual(featured.eyes[0].spectralSensitivity, [...spec.sensitivity]);
    assert.deepEqual(sim.morphologyProblems(featured.parts), []);
    assert.deepEqual(sim.surfacePlacementProblems(featured), []);
    validateGenome(featured);
    // Legacy identity, missing receptor alleles, and locomotion are immutable here.
    assert.ok(legacy.eyes.every(e => e.spectralSensitivity === undefined));
    const copy = structuredClone(featured);
    sim.mutateGenome(copy, 0, new sim.XoshiroPRNG(71));
    assert.equal(copy.id, featured.id);
  }
});

test('ordinary world samples up to five distinct featured designs, not every featured organism', () => {
  const sampled = sampleFounderGenomes(new sim.XoshiroPRNG(42), 18);
  assert.equal(sampled.length, 18);
  assert.equal(new Set(sampled.map(g => g.id)).size, 5);
  assert.ok(sampled.every(g => FEATURED_BLUEPRINTS.some(f => f.id === g.id)));
  assert.notEqual(sampled[0], sampled[5]);
  const world = createInitialWorld({...settings, maxOrganisms: 30}, 42, 'balanced', 'standard', 18);
  assert.equal(world.organisms.length, 18);
  assert.ok(world.organisms.every(o => o.genome.id.startsWith('CUR-')));
  const showcase = createInitialWorld({...settings, maxOrganisms: 30}, 42, 'balanced', 'showcase');
  assert.equal(showcase.organisms.length, 9);
  assert.equal(new Set(showcase.organisms.map(o => o.genome.id)).size, 9);
});

for (const d of FEATURED_BLUEPRINTS) {
  test(`${d.id}: finite swimming, funded reserves and conserved physics`, () => {
    const g = createFounderGenome(d.id);
    const world = createInitialWorld(settings, 9, 'balanced', 'standard', 0);
    const org = addExternalOrganism(world, g, settings, 1200, 750, 0)!;
    const before = sim.calculateOrganismCOM(org);
    for (let t = 0; t < 120; t++) sim.stepSimulation(world, settings, 1 / 60);
    const after = sim.calculateOrganismCOM(org);
    const distance = Math.hypot(after.x - before.x, after.y - before.y);
    assert.ok(distance > 0.1, `${d.id}: no displacement (${distance}px)`);
    assert.ok(org.energy > 0 && !org.dissolving);
    assert.ok(org.segments.every(p => Object.values(p).every(Number.isFinite)));
    assert.ok(Math.abs(totalAccountedEnergy(world) - world.ledger.externalInflow) < 1e-5);
  });
}

test('featured physical mouth permissions and finite intake remain biological', () => {
  for (const d of FEATURED_BLUEPRINTS) {
    const g = createFounderGenome(d.id);
    g.motorForce = 0; // Stationary physical contact control; no scripted feeding.
    const world = createInitialWorld(settings, 25, 'balanced', 'standard', 0);
    const org = addExternalOrganism(world, g, settings, 1200, 750, 0)!;
    const mouth = g.mouths[0];
    const part = org.segments[mouth.partIndex], body = g.parts[mouth.partIndex];
    const anchor = sim.getOrganAnchor(mouth, body.width, body.height);
    const x = part.x + Math.cos(part.angle) * anchor.x - Math.sin(part.angle) * anchor.y;
    const y = part.y + Math.sin(part.angle) * anchor.x + Math.cos(part.angle) * anchor.y;
    world.nutrients.push({id: 'test-food', x, y, vx: 0, vy: 0,
      energyValue: 3000, radius: sim.getNutrientRadius(3000), bottomTimer: 0, pulseTimer: 0});
    world.ledger.externalInflow += 3000;
    sim.stepSimulation(world, settings, 1 / 60);
    const removed = 3000 - world.nutrients.reduce((sum, food) => sum + food.energyValue, 0);
    assert.equal(removed > 0, d.diet !== 'carnivore', `${d.id}: mouth diet permission`);
    assert.ok(Math.abs(totalAccountedEnergy(world) - world.ledger.externalInflow) < 1e-5);
  }
});
