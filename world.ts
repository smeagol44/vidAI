import {markLineageChanged} from './lineageChanges';
import {enableClosedEconomy, occupiedPopulation} from './energyEconomy';
import {
  XoshiroPRNG, spawnOrganism, createArchetypeGenome, getDietClassification,
  addNutrients, type ArchetypeId, type Genome,
  type SimulationSettings, type SimulationState,
} from './simulation';
import {FEATURED_BLUEPRINTS, createFounderGenome, sampleFounderGenomes, type FounderMode} from './founders';

export function addExternalOrganism(s: SimulationState, g: Genome, settings: SimulationSettings, x: number, y: number, heading?: number) {
  if (occupiedPopulation(s) >= (settings.maxOrganisms ?? 100)) return null;
  const genome = structuredClone(g);
  const org = spawnOrganism(genome, x, y, heading ?? s.prng.range(0, Math.PI * 2), undefined, undefined, s.prng);
  if (s.energyPool && s.energyPool.reserve < org.energy + org.structuralBiomass) return null;
  s.organisms.push(org); s.totalBirths++;
  if (s.energyPool) s.energyPool.reserve -= org.energy + org.structuralBiomass;
  else s.ledger.externalInflow += org.energy + org.structuralBiomass;
  s.lineage.set(org.id, {id: org.id, name: genome.name, parentIds: [], generation: genome.generation,
    birthTime: s.simTime, offspringCount: 0, archetype: genome.archetype ?? 'Custom',
    hue: genome.hue, diet: getDietClassification(genome.mouths).label, genome});
  markLineageChanged(s.lineage, org.id);
  return org;
}

export function createInitialWorld(settings: SimulationSettings, seed = 4242, mode: FounderMode = 'balanced', preset = 'standard', requestedCount = 18): SimulationState {
  const prng = new XoshiroPRNG(seed);
  const s: SimulationState = {initialSeed: seed, simTime: 0, organisms: [], eggs: [], nutrients: [], bubbles: [], caustics: [],
    ledger: {externalInflow: 0, metabolicDissipation: 0, mechanicalWorkHeat: 0, recordedLosses: 0},
    nutrientAccumulator: 0, totalBirths: 0, totalDeaths: 0, prng, lineage: new Map(), recentDeaths: []};
  const count = Math.min(settings.maxOrganisms ?? 100, preset === 'showcase' ? FEATURED_BLUEPRINTS.length : preset === 'megafauna' ? 12 : requestedCount);
  const oldPresets: Record<string, ArchetypeId> = {eel_swarm: 'eel', manta_colony: 'flapper', tadpole_school: 'tadpole', glider_fleet: 'glider', predator_cove: 'predator'};
  const genomes = oldPresets[preset] ? Array.from({length: count}, () => createArchetypeGenome(oldPresets[preset], 1, [], prng))
    : preset === 'showcase' ? FEATURED_BLUEPRINTS.slice(0, count).map(d => createFounderGenome(d.id, mode))
    : sampleFounderGenomes(prng, count, mode);
  for (let i = 0; i < genomes.length; i++) {
    const columns = 10, rows = Math.ceil(count / columns);
    const x = preset === 'showcase' ? (i % columns + .5) * settings.worldWidth / columns : prng.range(250, settings.worldWidth - 250);
    const y = preset === 'showcase' ? (Math.floor(i / columns) + .5) * settings.worldHeight / rows : prng.range(200, settings.worldHeight - 200);
    addExternalOrganism(s, genomes[i], settings, x, y);
  }
  addNutrients(s, settings, settings.targetNutrients);
  for (let i = 0; i < 28; i++) s.caustics.push({x: prng.range(0, settings.worldWidth), y: prng.range(0, settings.worldHeight),
    radius: prng.range(140, 320), speed: prng.range(.2, .55), alpha: prng.range(.04, .1), angle: prng.range(0, Math.PI * 2)});
  if (settings.ecologyRegime === 'closed-v1') {
    enableClosedEconomy(s);
    // The count cap changes distribution, never the initial total grant.
    while (s.nutrients.length > (settings.nutrientLimit ?? Infinity))
      s.energyPool!.reserve += s.nutrients.pop()!.energyValue;
  }
  return s;
}

export function collectWorldStats(s: SimulationState, target: number) {
  const living = s.organisms.filter(o => !o.dissolving);
  const generations = living.map(o => o.genome.generation);
  const counts = {herbivoreCount: 0, carnivoreCount: 0, omnivoreCount: 0};
  for (const o of living) {
    const category = getDietClassification(o.genome.mouths).category;
    if (category === 'Herbivore') counts.herbivoreCount++;
    if (category === 'Carnivore') counts.carnivoreCount++;
    if (category === 'Omnivore') counts.omnivoreCount++;
  }
  return {simTime: Math.round(s.simTime * 10) / 10, livingCount: living.length, eggCount: s.eggs.length,
    maxGeneration: Math.max(1, ...generations), avgGeneration: generations.length ? Math.round(generations.reduce((a, b) => a + b, 0) / generations.length * 10) / 10 : 1,
    totalBirths: s.totalBirths, totalDeaths: s.totalDeaths,
    fastestSpeed: Math.round(Math.max(0, ...living.map(o => o.speed)) * 10) / 10,
    nutrientCount: s.nutrients.filter(n => n.kind !== 'carrion').length,
    carrionCount: s.nutrients.filter(n => n.kind === 'carrion').length, targetNutrients: target,
    totalStoredBiomass: Math.round(s.organisms.reduce((sum, o) => sum + o.structuralBiomass, 0)),
    totalStoredReserves: Math.round(s.organisms.reduce((sum, o) => sum + o.energy, 0)),
    totalEggEnergy: Math.round(s.eggs.reduce((sum, e) => sum + e.fundedReserve + e.fundedStructural, 0)),
    totalFoodEnergy: Math.round(s.nutrients.reduce((sum, n) => sum + n.energyValue, 0)),
    totalExternalInflow: Math.round(s.ledger.externalInflow), totalMetabolicHeat: Math.round(s.ledger.metabolicDissipation),
    totalMechanicalHeat: Math.round(s.ledger.mechanicalWorkHeat), totalRecordedLosses: Math.round(s.ledger.recordedLosses), ...counts};
}
