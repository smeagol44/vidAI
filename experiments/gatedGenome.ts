/** Explicit OFFLINE construction of new experimental genomes. Original parents,
 * historical output rows, saved neural activations and starter catalogue stay intact. */
import {remapBrain, XoshiroPRNG, type Genome} from '../simulation';
import type {GateArchitecture} from './gatedMotor';

export function makeGatedGenome(parent: Genome, architecture: GateArchitecture, hysteresisWidth: 0 | .06, seed: number): Genome {
  const g = structuredClone(parent);
  g.motorController = {version: 'gated-torque-v1', architecture, hysteresisWidth};
  remapBrain(g, parent); // Identity mapping discards NO source genome; new channels start at zero.
  // Draw the SAME latent Mode/Direct/Strength rows for every architecture.
  // Two-output deliberately shares Direct as Command; only the independent
  // third row differs. Hysteresis pairs have byte-identical weights.
  const random = new XoshiroPRNG(seed), count = architecture === 'two-output' ? 2 : 3;
  for (let j = 0; j < g.parts.length - 1; j++) for (let channel = 0; channel < 3; channel++) {
    const weights = g.hiddenIds!.map(() => random.range(-.35, .35));
    const bias = random.range(-.5, .5);
    if (channel < count) {g.weightsHO[j * count + channel] = weights; g.biasesO[j * count + channel] = bias;}
  }
  return g;
}

/** Explicit t=0 comparison conversion only. Never use it to reinterpret an
 * existing animal's learned controller or saved continuation. */
export function installNewbornGatedHead(org: import('../simulation').Organism,
  architecture: GateArchitecture, hysteresisWidth: 0|.06, seed: number): void {
  if (org.age !== 0 || org.genome.motorController || org.learnedMotorWeights || org.learnedSensoryWeights
    || org.neuralHidden.some(x => x !== 0) || org.neuralOutputs.some(x => x !== 0))
    throw new Error('Only untouched legacy newborns can be explicitly converted for comparison');
  org.genome = makeGatedGenome(org.genome, architecture, hysteresisWidth, seed);
  // Preserve sensory/recurrent starting state. The newly initialized weights
  // must NOT be remapped again against old six-channel keys (which zeroes them).
  org.neuralOutputs = org.genome.outputKeys!.map(() => 0);
  for (const joint of org.joints) joint.gateMode = 'direct';
}
