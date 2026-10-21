import {applyStarterLocomotion} from './starterLocomotion';
import rawFounders from './data/founders.json' with {type: 'json'};
import {
  XoshiroPRNG, createXavierRecurrentNetwork, calculateBodyCost,
  calculateMaxEnergyCapacity, getBrainLayout, getCardinalBaseAngle,
  RAYS_PER_EYE, OUTPUTS_PER_JOINT, remapBrain, WATER_AMBIENT_RGB,
  type Genome, type PartDef, type SensoryEye, type SensoryMouth,
  type SpecimenBankItem, type MouthType, normalizeSurfaceOrgans,
} from './simulation';

export type FounderMode = 'balanced' | 'unbiased';
interface FounderBlueprint {
  id: string; name: string; family: string; diet: MouthType; seed: number;
  morphology: {parts: PartDef[]; eyes: SensoryEye[]; mouths: SensoryMouth[];
    hue: number; saturation: number; lightness: number};
  locomotion: {motorFrequency: number; motorForce: number};
  lifeHistory: {targetClutchSize: number; maturityAge: number; incubationTime: number;
    reproductionCooldown: number; maxLifespan: number; metabolicEfficiency: number;
    storageTraitMultiplier: number};
}

/** Founder catalogue: original calibrated bodies plus compact hinged bell swimmers. */
export const FOUNDER_BLUEPRINTS = rawFounders as FounderBlueprint[];
export const FOUNDER_FAMILIES = [...new Set(FOUNDER_BLUEPRINTS.map(f => f.family))];

/**
 * Nine curated, separately identified starters derived from nine distinct,
 * already physical-swimming legacy families. The original FND genomes remain
 * available unchanged. Each starter retains its donor's tested articulation,
 * physical mouth anchor, seed and energy economics. Inherited receptors and
 * optional genetic learning capacity are specialized. Selected featured motor
 * alleles are additionally calibrated by the bounded offline swim search.
 *
 * These are starting genotypes, not scripted ecological roles or proven
 * self-sustaining species. Children can mutate every inherited trait.
 */
export const FEATURED_STARTER_SPECS = [
  {id: 'CUR-001', source: 'FND-001', name: 'Darter Scout', sensitivity: [0.5, 1, 0.6], learning: 0.016},
  {id: 'CUR-002', source: 'FND-006', name: 'Twin Oar Grazer', sensitivity: [0.25, 1, 0.5], learning: 0},
  {id: 'CUR-003', source: 'FND-021', name: 'Tidewheel Browser', sensitivity: [0.6, 1, 0.8], learning: 0},
  {id: 'CUR-004', source: 'FND-052', name: 'Lantern Filterer', sensitivity: [0.15, 1, 0.35], learning: 0.008},
  {id: 'CUR-005', source: 'FND-019', name: 'Forktail Opportunist', sensitivity: [0.9, 1, 0.7], learning: 0.012},
  {id: 'CUR-006', source: 'FND-034', name: 'Broadwake Forager', sensitivity: [1, 0.8, 0.8], learning: 0.018},
  {id: 'CUR-007', source: 'FND-039', name: 'Hooktail Scavenger', sensitivity: [1, 0.75, 1], learning: 0.012},
  {id: 'CUR-008', source: 'FND-030', name: 'Hammerhead Pursuer', sensitivity: [1, 0.1, 0.9], learning: 0.018},
  {id: 'CUR-009', source: 'FND-050', name: 'Branchstalker', sensitivity: [1, 0, 1], learning: 0.012},
] as const;

export const FEATURED_BLUEPRINTS: FounderBlueprint[] = FEATURED_STARTER_SPECS.map(spec => {
  const donor = FOUNDER_BLUEPRINTS.find(f => f.id === spec.source);
  if (!donor) throw new Error(`Missing curated founder source: ${spec.source}`);
  const variant = structuredClone(donor);
  variant.id = spec.id;
  variant.name = spec.name;
  // Stable, new organ/segment identities, with no changes to geometry, slots,
  // motor phases or mouth placement.
  variant.morphology.parts.forEach(p => {p.id = p.id.replace(donor.id, spec.id);});
  variant.morphology.eyes.forEach(e => {e.id = e.id.replace(donor.id, spec.id);});
  variant.morphology.mouths.forEach(m => {m.id = m.id.replace(donor.id, spec.id);});
  return variant;
});

export const isFeaturedFounderId = (id: string): boolean =>
  FEATURED_STARTER_SPECS.some(spec => spec.id === id);

export function createFounderGenome(id: string, mode: FounderMode = 'balanced',
  options: {locomotion?: 'current' | 'catalogue'; foraging?: 'current' | 'catalogue'} = {}): Genome {
  const blueprint = FEATURED_BLUEPRINTS.find(f => f.id === id) ?? FOUNDER_BLUEPRINTS.find(f => f.id === id);
  if (!blueprint) throw new Error(`Unknown founder ${id}`);
  const d = structuredClone(blueprint);
  const featured = FEATURED_STARTER_SPECS.find(spec => spec.id === id);
  const sourceId = featured?.source ?? id;
  const {parts, eyes, mouths, hue, saturation, lightness} = d.morphology;
  // New Twin Oar genomes: align the paired paddles so the body travels toward
  // its forward mouth, then use the reviewed mutable grazer steering gains.
  // Catalogue fixtures and stored genomes retain their original alleles.
  const calibratedTwinOar = id === 'CUR-002' && options.foraging !== 'catalogue';
  if (calibratedTwinOar) parts[2].cpgPhaseOffset += Math.PI;
  // Physically verified head-first gait calibration (Phase 5): this axial
  // swimmer's original tail wave carried its mouth/eyes *backwards* relative
  // to food. Reversing the inherited joint phase progression, not adding a
  // thrust force or steering override, restores forward food access.
  // Do not apply to other founders (e.g. bell swimmers already move forward).
  // Older saved genotypes keep their exact original joint phases.
  if (sourceId === 'FND-001') {
    for (const part of parts.slice(1)) part.cpgPhaseOffset = -part.cpgPhaseOffset;
  }
  const layout = getBrainLayout({parts, eyes, mouths});
  // Preserve the brain used when these gaits were calibrated, then expand it by ID.
  const localPrng = new XoshiroPRNG(d.seed);
  const brain = createXavierRecurrentNetwork(localPrng);
  brain.weightsHO = brain.weightsHO.map(row => row.map(w => w * .1));
  brain.biasesO = brain.biasesO.map(b => b * .1);
  const g: Genome = {
    anatomyVersion: 1, id: d.id, name: d.name, archetype: d.family, generation: 1, parentIds: [],
    hue, saturation, lightness, parts, eyes, mouths, ...d.locomotion, ...d.lifeHistory,
    ...brain,
    founderMode: mode, eggReserveFraction: .35, reproductionThreshold: .6,
    bodyCost: calculateBodyCost(parts, eyes, mouths),
    maxEnergyCapacity: calculateMaxEnergyCapacity(parts, d.lifeHistory.storageTraitMultiplier),
  };
  normalizeSurfaceOrgans(g);
  remapBrain(g);
  // New channels start weak and neutral in empty water, while remaining functional.
  // Keep new injury synapses initially disconnected: the historical founder
  // PRNG sequence and old retinal/oral alleles must remain identical until a
  // descendant actually evolves a response to experienced predation.
  for (let h = 0; h < g.weightsIH.length; h++) for (let i = 0; i < layout.inputs.length; i++) {
    if (g.weightsIH[h][i] !== 0 || layout.inputs[i].startsWith('mouth:') || layout.inputs[i] === 'body:injury') continue;
    const w = localPrng.range(-.015, .015);
    g.weightsIH[h][i] = w;
    const channel = layout.inputs[i].split(':').at(-1);
    const baseline = channel === 'red' ? WATER_AMBIENT_RGB[0] : channel === 'green' ? WATER_AMBIENT_RGB[1]
      : channel === 'blue' ? WATER_AMBIENT_RGB[2] : channel === 'distance' ? 1 : 0;
    g.biasesH[h] -= baseline * w;
  }
  // Add oral feedback after the calibrated channel initialization so its PRNG
  // draws cannot shift the old controller's weak sensory connections.
  for (let h = 0; h < g.weightsIH.length; h++) for (let i = 0; i < layout.inputs.length; i++) {
    if (layout.inputs[i].startsWith('mouth:')) g.weightsIH[h][i] = localPrng.range(-.015, .015);
  }
  // The compact bell swimmer starts with a quiet controller around its phased gait.
  // All pathways remain evolvable; balanced mode adds the same retinal prior below.
  if (d.family === 'Bell swimmers') {
    g.weightsHO = g.weightsHO.map(row => row.map(w => w * .1));
    g.biasesO = g.biasesO.map(b => b * .1);
  }
  if (mode === 'balanced') addRetinalSteeringPrior(g, d.diet, sourceId === 'FND-001' || calibratedTwinOar);
  if (featured) {
    // RGB receptor gains and learning rates are ordinary mutable alleles.
    // They affect real retinal rays and paid synaptic changes, never add an
    // identity label, food-seeking script or extra locomotion force.
    const spectralSensitivity = [...featured.sensitivity] as [number, number, number];
    for (const eye of g.eyes) eye.spectralSensitivity = [...spectralSensitivity];
    if (featured.learning > 0) {
      g.plasticityRate = featured.learning;
      g.sensoryPlasticityRate = featured.learning;
      g.forgettingRate = 0.1;
    }
  }
  if (options.locomotion !== 'catalogue') applyStarterLocomotion(g);
  return g;
}

/** Heritable retinal-to-joint steering using only attenuated RGB ray inputs.
 * Stronger grazer gains are used by the reviewed Darter and featured Twin Oar
 * calibrations, measured with paired physical feeding trials. No target
 * position, object type or danger flag is fed to the controller.
 */
function addRetinalSteeringPrior(g: Genome, diet: MouthType, calibratedGrazer = false): void {
  // Green contrast for grazers, red/blue contrast for predators. Omnivores blend both.
  const color = diet === 'herbivore' ? [-.5, 1, -.25]
    : diet === 'carnivore' ? [.7, -.7, .5] : [.3, .5, .2];
  g.eyes.forEach((eye, e) => {
    for (let r = 0; r < RAYS_PER_EYE; r++) {
      const angle = getCardinalBaseAngle(eye.direction) + (r / (RAYS_PER_EYE - 1) - .5) * eye.fov;
      for (let c = 0; c < 3; c++) {
        const i = (e * RAYS_PER_EYE + r) * 4 + c;
        const sensitivity = (calibratedGrazer ? 1.5 : .2) * Math.sin(angle) * color[c] / Math.sqrt(g.eyes.length);
        g.weightsIH[0][i] += sensitivity;
        g.weightsIH[1][i] -= sensitivity;
        g.biasesH[0] -= sensitivity * WATER_AMBIENT_RGB[c];
        g.biasesH[1] += sensitivity * WATER_AMBIENT_RGB[c];
      }
    }
  });
  for (let j = 0; j < g.parts.length - 1; j++) {
    g.weightsHO[j * OUTPUTS_PER_JOINT][0] += calibratedGrazer ? -.5 : .04;
    g.weightsHO[j * OUTPUTS_PER_JOINT][1] += calibratedGrazer ? .5 : -.04;
  }
}

export function createFounderBankItems(mode: FounderMode = 'balanced'): SpecimenBankItem[] {
  return [
    ...FEATURED_BLUEPRINTS.map(d => ({id: `FOUNDER-${d.id}`, name: d.name,
      savedAt: 'Featured starter', genome: createFounderGenome(d.id, mode),
      tags: ['Featured', `${d.family} design`, d.diet]})),
    ...FOUNDER_BLUEPRINTS.map(d => ({id: `FOUNDER-${d.id}`, name: d.name,
      savedAt: 'Legacy catalogue', genome: createFounderGenome(d.id, mode),
      tags: ['Legacy', d.family, d.diet]})),
  ];
}

/** Up to five distinct designs, sampled without replacement; clones get independent brains.
 */
export function sampleFounderGenomes(prng: XoshiroPRNG, count = 18, mode: FounderMode = 'balanced'): Genome[] {
  if (count <= 0) return [];
  const available = [...FEATURED_BLUEPRINTS];
  const designs: FounderBlueprint[] = [];
  const number = Math.min(5, count, available.length);
  for (let i = 0; i < number; i++) {
    const d = available[prng.rangeInt(0, available.length - 1)];
    designs.push(d); available.splice(available.indexOf(d), 1);
  }
  // Selection order randomizes which designs receive the extra individuals.
  return Array.from({length: count}, (_, i) => createFounderGenome(designs[i % number].id, mode));
}
