import calibration from './data/starter-locomotion.json' with {type: 'json'};
import type {Genome} from './simulation';

/** Selected offline motor alleles for NEW featured genomes only. Never called
 * from imports or mutation; all inherited genes remain ordinarily mutable. */
export function applyStarterLocomotion(g: Genome): void {
  const variant = calibration.variants.find(v => v.id === g.id);
  if (!variant) return;
  if (variant.parts.length !== g.parts.length - 1) throw new Error(`Stale starter calibration: ${g.id}`);
  g.motorFrequency = variant.motorFrequency; g.motorForce = variant.motorForce;
  variant.parts.forEach((genes, i) => {
    const part = g.parts[i + 1];
    if (part.id !== genes.id) throw new Error(`Stale starter part: ${genes.id}`);
    part.cpgPhaseOffset = genes.cpgPhaseOffset;
    part.cpgAmp = genes.cpgAmp;
    part.cpgFreqMult = genes.cpgFreqMult;
    // Current selected candidates use only these existing alleles. Future
    // additions must be explicit here, never copy arbitrary genome fields.
  });
}
