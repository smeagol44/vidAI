import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FOUNDER_BLUEPRINTS, createFounderBankItems, createFounderGenome} from '../founders';
import {LEGACY_SETTINGS, validateGenome, totalAccountedEnergy} from '../persistence';
import {createInitialWorld, addExternalOrganism} from '../world';
import {calculateOrganismCOM, morphologyProblems, surfacePlacementProblems, stepSimulation} from '../simulation';

const ids = ['FND-052', 'FND-053', 'FND-054', 'FND-055'];
const settings = {...LEGACY_SETTINGS, targetNutrients: 0, inflowRate: 0, mutationSeverity: 0};

test('55 founders have unique anatomy and valid organs in both brain modes; all five jellyfish appear in the bank', () => {
  assert.equal(FOUNDER_BLUEPRINTS.length, 55);
  const fingerprints = new Set<string>();
  for (const design of FOUNDER_BLUEPRINTS) {
    const fingerprint = JSON.stringify(design.morphology.parts.map(p => [p.parentIndex, p.attachmentPoint, p.dimN, p.dimM]));
    assert.ok(!fingerprints.has(fingerprint), `duplicate anatomy: ${design.id}`);
    fingerprints.add(fingerprint);
    for (const mode of ['balanced', 'unbiased'] as const) {
      const g = createFounderGenome(design.id, mode);
      assert.deepEqual(morphologyProblems(g.parts), [], design.id);
      assert.deepEqual(surfacePlacementProblems(g), [], design.id);
      validateGenome(g);
      const expectedParts = structuredClone(design.morphology.parts);
      if (design.id === 'FND-001') for (const p of expectedParts.slice(1)) p.cpgPhaseOffset *= -1;
      assert.deepEqual(g.parts, expectedParts);
      assert.deepEqual(g.eyes, design.morphology.eyes);
      assert.deepEqual(g.mouths, design.morphology.mouths);
    }
  }
  const bells = createFounderBankItems().filter(item => item.tags.includes('Bell swimmers'));
  assert.equal(bells.length, 5);
  for (const id of ids) assert.ok(bells.some(item => item.genome.id === id));
});

for (const id of ids) for (const mode of ['balanced', 'unbiased'] as const) {
  test(`${id} / ${mode}: short active stroke displaces COM; passive control stays still`, () => {
    for (const motors of [true, false]) {
      const g = createFounderGenome(id, mode);
      if (!motors) g.motorForce = 0;
      const s = createInitialWorld(settings, 7, mode, 'standard', 0);
      const org = addExternalOrganism(s, g, settings, 1200, 750, 0)!;
      const start = calculateOrganismCOM(org);
      // Only two simulated seconds: a bounded gait/geometry regression, not an ecosystem run.
      for (let tick = 0; tick < 120; tick++) stepSimulation(s, settings, 1 / 60);
      const end = calculateOrganismCOM(org);
      const displacement = Math.hypot(end.x - start.x, end.y - start.y);
      assert.ok(org.segments.every(p => Object.values(p).every(Number.isFinite)));
      assert.ok(org.energy > 0 && !org.dissolving);
      assert.ok(motors ? displacement > .25 : displacement < 1e-6, `${id}: ${displacement}px, motors=${motors}`);
      assert.ok(Math.abs(totalAccountedEnergy(s) - s.ledger.externalInflow) < 1e-5);
    }
  });
}
