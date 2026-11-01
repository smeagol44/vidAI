import type {createSnapshot} from '../../persistence';
import assert from 'node:assert/strict';

/** Compare historical complete-state goldens across the v0.38 mouth field split.
 * This is serialization only: never change live state or run physics with it.
 * Every non-mouth field, including PRNG, energy and learned memory, is retained.
 */
export function legacyMouthState(state: ReturnType<typeof createSnapshot>['state']) {
  const copy = structuredClone(state);
  const project = (genome: typeof copy.organisms[number]['genome']) => {
    for (const mouth of genome.mouths) {
      if (mouth.intakeLength !== undefined) {
        const diameter = mouth.mouthType === 'carnivore' ? 9 : mouth.mouthType === 'omnivore' ? 8 : 7;
        assert.equal(mouth.intakeWidth, diameter, 'projection must not hide a malformed current mouth diameter');
        assert.ok(Number.isFinite(mouth.intakeLength) && mouth.intakeLength >= diameter);
      }
      mouth.intakeWidth = mouth.intakeLength ?? mouth.intakeWidth;
      delete mouth.intakeLength;
    }
  };
  for (const organism of copy.organisms) project(organism.genome);
  for (const egg of copy.eggs) project(egg.genome);
  for (const [, record] of copy.lineage) project(record.genome);
  return copy;
}
