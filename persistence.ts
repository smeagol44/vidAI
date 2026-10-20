import {
  XoshiroPRNG, migrateOrganismBrain, ensureBrainLayout, calculateBodyCost,
  calculateMaxEnergyCapacity, clampVal, getPartCornerVertices,
  getBrainLayout, getDietClassification, brainEdgeKey, CARRION_DECAY_SECONDS, MAX_OUTPUTS, MAX_SURFACE_ORGANS, MAX_NEURAL_INPUTS, MAX_HIDDEN, MAX_ENABLED_BRAIN_EDGES, MAX_BRAIN_MEMORY_SECONDS, MAX_PLASTIC_MOTOR_SYNAPSES, MAX_PLASTIC_SENSORY_SYNAPSES, MAX_LEARNED_MOTOR_DELTA, plasticMotorEdges, plasticSensoryEdges, surfacePlacementProblems, morphologyProblems, type Genome, type SimulationSettings, type SimulationState, type Organism,
} from './simulation';

export const BUILD_VERSION = '0.27.0';
export const DEFAULT_SETTINGS: SimulationSettings = {
  worldWidth: 2400, worldHeight: 1500, waterViscosity: .18,
  targetNutrients: 400, inflowRate: 15, nutrientPattern: 'uniform', kinshipProtection: true,
  mutationSeverity: .25, gravity: 0, maxOrganisms: 100,
};
export const CREDITS = 'By Hernán Garro & Federico Regueira';

export function totalAccountedEnergy(s: SimulationState): number {
  return s.organisms.reduce((sum, o) => sum + o.energy + o.structuralBiomass, 0)
    + s.eggs.reduce((sum, e) => sum + e.fundedReserve + e.fundedStructural, 0)
    + s.nutrients.reduce((sum, n) => sum + n.energyValue, 0)
    + s.ledger.metabolicDissipation + s.ledger.mechanicalWorkHeat + s.ledger.recordedLosses;
}

export function clearFreeNutrients(s: SimulationState): number {
  const removed = s.nutrients.filter(n => n.kind !== 'carrion').reduce((sum, n) => sum + n.energyValue, 0);
  s.ledger.recordedLosses += removed;
  s.nutrients = s.nutrients.filter(n => n.kind === 'carrion');
  s.nutrientAccumulator = 0;
  return removed;
}

/** Translate each articulated body as one unit; never clamp its parts separately. */
export function resizeWorld(s: SimulationState, old: SimulationSettings, width: number, height: number): void {
  const dx = (width - old.worldWidth) / 2, dy = (height - old.worldHeight) / 2;
  for (const org of s.organisms) {
    const corners = org.segments.flatMap((p, i) => getPartCornerVertices(p, org.genome.parts[i]));
    const left = Math.min(...corners.map(p => p.x)) + dx;
    const right = Math.max(...corners.map(p => p.x)) + dx;
    const top = Math.min(...corners.map(p => p.y)) + dy;
    const bottom = Math.max(...corners.map(p => p.y)) + dy;
    const tx = dx + (left < 5 ? 5 - left : right > width - 5 ? width - 5 - right : 0);
    const ty = dy + (top < 5 ? 5 - top : bottom > height - 5 ? height - 5 - bottom : 0);
    for (const p of org.segments) { p.x += tx; p.y += ty; }
    for (const p of org.traceHistory ?? []) { p.x += tx; p.y += ty; }
  }
  for (const p of [...s.eggs, ...s.nutrients]) {
    p.x = clampVal(p.x + dx, 35, width - 35);
    p.y = clampVal(p.y + dy, 35, height - 35);
  }
  for (const p of [...s.caustics, ...s.bubbles]) {
    p.x = clampVal(p.x + dx, 0, width);
    p.y = clampVal(p.y + dy, 0, height);
  }
}

export function createSnapshot(s: SimulationState, settings: SimulationSettings, metadata: Record<string, unknown> = {}) {
  const {prng, lineage, ...data} = s;
  const snapshot = {schemaVersion: '11.0.0', build: BUILD_VERSION, metadata, settings,
    state: {...data, prngState: prng.getState(), lineage: [...lineage]}};
  // Canonical JSON representation also drops optional undefined fields in memory.
  return JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid snapshot: ${message}`);
}
function finiteTree(value: unknown, depth = 0): void {
  assert(depth < 40, 'excessive nesting');
  if (typeof value === 'number') assert(Number.isFinite(value), 'non-finite number');
  if (value && typeof value === 'object') for (const v of Object.values(value)) finiteTree(v, depth + 1);
}

export function validateGenome(raw: unknown): Genome {
  assert(raw && typeof raw === 'object', 'genome');
  const g = structuredClone(raw) as Genome;
  finiteTree(g);
  assert(typeof g.id === 'string', 'genome ID');
  assert(Array.isArray(g.parts) && g.parts.length >= 1 && g.parts.length <= 7, 'body part count');
  assert(Array.isArray(g.eyes) && Array.isArray(g.mouths)
    && g.eyes.length + g.mouths.length <= MAX_SURFACE_ORGANS, 'organ count');
  assert(g.anatomyVersion === undefined || g.anatomyVersion === 1, 'anatomy version');
  assert(new Set(g.eyes.map(e => e.id)).size === g.eyes.length
    && new Set(g.mouths.map(m => m.id)).size === g.mouths.length, 'duplicate organ IDs');
  assert(g.brainVersion === undefined || g.brainVersion === 2 || g.brainVersion === 3 || g.brainVersion === 4 || g.brainVersion === 5 || g.brainVersion === 6 || g.brainVersion === 7, 'brain version');
  const dirs = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
  const ids = new Set<string>();
  for (const [i, p] of g.parts.entries()) {
    assert(p && typeof p.id === 'string' && !ids.has(p.id), 'part ID'); ids.add(p.id);
    assert(Number.isInteger(p.parentIndex) && (i === 0 ? p.parentIndex === -1 : p.parentIndex >= 0 && p.parentIndex < i), 'body tree');
    assert([p.dimN, p.dimM].every(n => Number.isInteger(n) && n >= 1 && n <= 10), 'part dimensions');
    assert(p.width === p.dimN * 7 && p.height === p.dimM * 7 && dirs.includes(p.attachmentPoint), 'part geometry');
    assert(Number.isFinite(p.maxAngle) && Number.isFinite(p.baseAngleOffset) && Number.isFinite(p.cpgPhaseOffset)
      && Number.isFinite(p.cpgAmp) && Number.isFinite(p.cpgFreqMult), 'joint parameters');
    assert(p.oscillatorMix === undefined ||
      (typeof p.oscillatorMix === 'number' && Number.isFinite(p.oscillatorMix)
        && p.oscillatorMix >= 0 && p.oscillatorMix <= 1), 'oscillator blend');
    assert(p.waveHarmonics === undefined || (Array.isArray(p.waveHarmonics)
      && p.waveHarmonics.length === 4
      && p.waveHarmonics.every((x: unknown) => typeof x === 'number' && Number.isFinite(x)
        && x >= -1 && x <= 1)), 'wave harmonics');
  }
  for (const organ of [...g.eyes, ...g.mouths]) {
    assert(typeof organ.id === 'string' && Number.isInteger(organ.partIndex) && organ.partIndex >= 0 && organ.partIndex < g.parts.length
      && dirs.includes(organ.direction), 'organ placement');
  }
  for (const o of [...g.eyes, ...g.mouths]) assert(o.slot === undefined || [0, 1, 2].includes(o.slot), 'organ slot');
  if (g.anatomyVersion === 1) {
    assert(morphologyProblems(g.parts).length === 0, 'body geometry');
    assert(surfacePlacementProblems(g).length === 0, 'exclusive face occupancy');
  }
  assert(g.eyes.every(e => e.fov > 0 && e.fov <= Math.PI * 2 && e.range > 0 && e.range <= 5000), 'eye parameters');
  assert(g.eyes.every(e => e.spectralSensitivity === undefined
    || (Array.isArray(e.spectralSensitivity) && e.spectralSensitivity.length === 3
      && e.spectralSensitivity.every((v: unknown) => typeof v === 'number'
        && Number.isFinite(v) && v >= 0 && v <= 1))), 'eye spectral sensitivity');
  assert(g.mouths.every(m => ['herbivore', 'omnivore', 'carnivore'].includes(m.mouthType) && m.intakeWidth > 0), 'mouth parameters');
  for (const matrix of [g.weightsIH, g.weightsHH, g.weightsHO]) {
    assert(Array.isArray(matrix) && matrix.length <= MAX_HIDDEN && matrix.every(row =>
      Array.isArray(row) && row.length <= MAX_NEURAL_INPUTS && row.every(Number.isFinite)), 'neural weights');
  }
  assert(Array.isArray(g.biasesH) && g.biasesH.every(Number.isFinite)
    && Array.isArray(g.biasesO) && g.biasesO.length <= MAX_OUTPUTS && g.biasesO.every(Number.isFinite), 'neural biases');
  const hiddenCount = g.biasesH.length;
  assert(hiddenCount >= 1 && hiddenCount <= MAX_HIDDEN && g.weightsIH.length === hiddenCount
    && g.weightsHH.length === hiddenCount && g.weightsHH.every(row => row.length === hiddenCount), 'hidden layer');
  if (g.brainVersion === 5 || g.brainVersion === 6 || g.brainVersion === 7) {
    assert(Array.isArray(g.hiddenIds) && g.hiddenIds.length === hiddenCount
      && g.hiddenIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 128)
      && new Set(g.hiddenIds).size === hiddenCount, 'hidden neuron IDs');
    assert(Array.isArray(g.disabledConnections) && g.disabledConnections.length <= MAX_ENABLED_BRAIN_EDGES
      && new Set(g.disabledConnections).size === g.disabledConnections.length, 'disabled neural edges');
    const inputs = new Set(g.inputKeys), outputs = new Set(g.outputKeys), hidden = new Set(g.hiddenIds);
    for (const key of g.disabledConnections) {
      let parsed: unknown;
      try { parsed = JSON.parse(key); } catch { assert(false, 'neural edge key'); }
      assert(Array.isArray(parsed) && parsed.length === 3 && parsed.every(v => typeof v === 'string'), 'neural edge key');
      const [kind, target, source] = parsed as string[];
      assert((kind === 'ih' && hidden.has(target) && inputs.has(source)
        || kind === 'hh' && hidden.has(target) && hidden.has(source)
        || kind === 'ho' && outputs.has(target) && hidden.has(source))
        && key === brainEdgeKey(kind as 'ih' | 'hh' | 'ho', target, source), 'neural edge reference');
    }
  }
  if (g.brainVersion === 6 || g.brainVersion === 7) {
    assert(Array.isArray(g.hiddenTimeConstants) && g.hiddenTimeConstants.length === hiddenCount
      && g.hiddenTimeConstants.every(tau => typeof tau === 'number' && Number.isFinite(tau)
        && tau >= 0 && tau <= MAX_BRAIN_MEMORY_SECONDS), 'hidden memory time constants');
  }
  assert([g.motorForce, g.motorFrequency, g.maturityAge, g.incubationTime, g.maxLifespan, g.metabolicEfficiency,
    g.eggReserveFraction, g.reproductionThreshold, g.reproductionCooldown, g.hue, g.saturation, g.lightness].every(Number.isFinite), 'life-history parameters');
  assert(g.motorForce >= 0 && g.motorForce <= 100 && g.motorFrequency >= 0 && g.motorFrequency <= 20
    && g.maturityAge >= 0 && g.maxLifespan > 0 && g.incubationTime > 0 && g.metabolicEfficiency > 0
    && Number.isInteger(g.targetClutchSize) && g.targetClutchSize >= 1 && g.targetClutchSize <= 8, 'trait bounds');
  assert(g.plasticityRate === undefined ||
    (typeof g.plasticityRate === 'number' && Number.isFinite(g.plasticityRate)
      && g.plasticityRate >= 0 && g.plasticityRate <= 0.8), 'plastic learning rate');
  assert(g.forgettingRate === undefined ||
    (typeof g.forgettingRate === 'number' && Number.isFinite(g.forgettingRate)
      && g.forgettingRate >= 0 && g.forgettingRate <= 1), 'learned forgetting rate');
  assert(g.plasticMotorScope === undefined || g.plasticMotorScope === 'angle'
    || g.plasticMotorScope === 'all', 'plastic motor scope');
  assert(g.injuryAversionRate === undefined ||
    (typeof g.injuryAversionRate === 'number' && Number.isFinite(g.injuryAversionRate)
      && g.injuryAversionRate >= 0 && g.injuryAversionRate <= 1), 'injury aversion rate');
  assert(g.sensoryPlasticityRate === undefined ||
    (typeof g.sensoryPlasticityRate === 'number' && Number.isFinite(g.sensoryPlasticityRate)
      && g.sensoryPlasticityRate >= 0 && g.sensoryPlasticityRate <= .8), 'sensory plasticity rate');
  assert(g.memoryConsolidationRate === undefined ||
    (typeof g.memoryConsolidationRate === 'number' && Number.isFinite(g.memoryConsolidationRate)
      && g.memoryConsolidationRate >= 0 && g.memoryConsolidationRate <= 2
      && ((g.plasticityRate ?? 0) > 0 || (g.sensoryPlasticityRate ?? 0) > 0)),
    'memory consolidation rate');
  assert(g.colorMutationRate === undefined || (Number.isFinite(g.colorMutationRate) && g.colorMutationRate >= 0 && g.colorMutationRate <= 1), 'pigment variability');
  assert(Array.isArray(g.parentIds) && g.parentIds.every(id => typeof id === 'string'), 'parent IDs');
  g.bodyCost = calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier ?? 1);
  if (g.brainVersion === 3 || g.brainVersion === 4 || g.brainVersion === 5 || g.brainVersion === 6 || g.brainVersion === 7) {
    const expected = getBrainLayout(g, g.brainVersion !== 3, g.brainVersion === 7);
    assert(JSON.stringify(g.inputKeys) === JSON.stringify(expected.inputs)
      && JSON.stringify(g.outputKeys) === JSON.stringify(expected.outputs), 'current neural channel identities');
  }
  ensureBrainLayout(g);
  const layout = getBrainLayout(g);
  assert(JSON.stringify(g.inputKeys) === JSON.stringify(layout.inputs) && JSON.stringify(g.outputKeys) === JSON.stringify(layout.outputs), 'neural channel identities');
  assert(g.weightsIH.every(row => row.length === layout.inputs.length) && g.weightsHO.length === layout.outputs.length
    && g.weightsHO.every(row => row.length === hiddenCount) && g.biasesO.length === layout.outputs.length, 'neural dimensions');
  const enabledEdges = hiddenCount * (layout.inputs.length + hiddenCount + layout.outputs.length) - g.disabledConnections!.length;
  assert(enabledEdges <= MAX_ENABLED_BRAIN_EDGES && enabledEdges >= 0, 'enabled neural edge budget');
  return g;
}

export function restoreSnapshot(input: unknown): {state: SimulationState; settings: SimulationSettings; metadata: Record<string, unknown>} {
  const raw = typeof input === 'string' ? (() => {
    assert(input.length <= 25_000_000, 'file exceeds 25 MB'); return JSON.parse(input);
  })() : structuredClone(input);
  assert(raw && typeof raw === 'object', 'document');
  assert(['11.0.0', '10.0.0', '9.0.0', '8.0.0', '7.0.0', '6.0.0', '5.0.0', '4.0.0', '3.0.0'].includes(raw.schemaVersion), 'unsupported schema');
  const legacy = raw.schemaVersion === '3.0.0';
  const data = legacy ? raw : raw.state;
  assert(data && typeof data === 'object', 'state');
  finiteTree(data);
  const settings: SimulationSettings = {...DEFAULT_SETTINGS, ...raw.settings};
  for (const [key, min, max] of [['worldWidth', 800, 4800], ['worldHeight', 600, 3000], ['waterViscosity', 0, .8],
    ['targetNutrients', 0, 800], ['inflowRate', 0, 150], ['gravity', -200, 200], ['maxOrganisms', 1, 150], ['mutationSeverity', 0, 1]] as const) {
    assert(typeof settings[key] === 'number' && Number.isFinite(settings[key]) && settings[key]! >= min && settings[key]! <= max, `setting ${key}`);
  }
  assert(Number.isInteger(settings.targetNutrients) && Number.isInteger(settings.maxOrganisms), 'integer settings');
  assert(settings.nutrientPattern === 'uniform' || settings.nutrientPattern === 'blooms', 'nutrient distribution');
  assert(typeof settings.kinshipProtection === 'boolean', 'kinship setting');
  for (const [key, limit] of [['organisms', 500], ['eggs', 300], ['nutrients', 2200], ['lineage', 20000]] as const) {
    assert(Array.isArray(data[key]) && data[key].length <= limit, key);
  }
  assert(Array.isArray(data.prngState) && data.prngState.length === 4 && data.prngState.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 0xffffffff)
    && data.prngState.some((n: number) => n !== 0), 'PRNG state');
  const prng = new XoshiroPRNG(); prng.setState(data.prngState);
  const organisms: Organism[] = data.organisms.map((o: Organism) => {
    if (raw.schemaVersion === '11.0.0') {
      assert(o.genome.brainVersion === 7, 'current brain version');
    } else {
      if (raw.schemaVersion === '10.0.0') assert(o.genome.brainVersion === 6, 'previous brain version');
      if (raw.schemaVersion === '9.0.0') assert(o.genome.brainVersion === 5, 'previous brain version');
      if (raw.schemaVersion === '8.0.0') assert(o.genome.brainVersion === 4, 'previous brain version');
      migrateOrganismBrain(o); // Keep original activations and PRNG; tau=0 preserves earlier dynamics.
    }
    o.genome = validateGenome(o.genome);
    assert(typeof o.id === 'string' && Array.isArray(o.segments) && o.segments.length === o.genome.parts.length
      && Array.isArray(o.joints) && o.joints.length === o.segments.length - 1, 'organism articulation');
    assert(o.segments.every(p => [p.x, p.y, p.vx, p.vy, p.angle, p.angVel].every(Number.isFinite)), 'physical state');
    assert(o.joints.every(j => [j.phase, j.targetAngle, j.currentRelAngle, j.currentRelAngVel, j.appliedTorque, j.stiffness].every(Number.isFinite)), 'joint state');
    assert(o.joints.every(j => Number.isFinite(j.amplitude) && j.amplitude! >= 0 && j.amplitude! <= 1.75
      && Number.isFinite(j.engagement) && j.engagement! >= 0 && j.engagement! <= 1), 'motor control state');
    assert(o.plasticityEnergyRate === undefined ||
      (typeof o.plasticityEnergyRate === 'number' && Number.isFinite(o.plasticityEnergyRate)
      && o.plasticityEnergyRate >= 0 && o.plasticityEnergyRate <= 1e6),
      'plasticity energy meter');
    assert(o.mouthFeedback && typeof o.mouthFeedback === 'object' && !Array.isArray(o.mouthFeedback), 'oral feedback');
    assert(typeof o.biteFeedbackJ === 'number' && Number.isFinite(o.biteFeedbackJ)
      && o.biteFeedbackJ >= 0 && o.biteFeedbackJ <= 1e9, 'bite sensory feedback');
    for (const [id, feedback] of Object.entries(o.mouthFeedback)) assert(o.genome.mouths.some(m => m.id === id)
      && feedback && (feedback.contact === 0 || feedback.contact === 1)
      && Number.isFinite(feedback.intake) && feedback.intake >= 0 && feedback.intake <= 1, 'oral feedback value');
    assert(o.energy >= 0 && Number.isFinite(o.energy) && o.structuralBiomass >= 0 && Number.isFinite(o.structuralBiomass)
      && Number.isFinite(o.age) && Number.isFinite(o.maxLifespan) && typeof o.dissolving === 'boolean', 'organism state');
    assert(Array.isArray(o.neuralInputs) && o.neuralInputs.length <= MAX_NEURAL_INPUTS && o.neuralInputs.every(Number.isFinite)
      && Array.isArray(o.neuralHidden) && o.neuralHidden.length === o.genome.hiddenIds!.length && o.neuralHidden.every(Number.isFinite)
      && Array.isArray(o.neuralOutputs) && o.neuralOutputs.length <= MAX_OUTPUTS && o.neuralOutputs.every(Number.isFinite), 'activations');
    if (o.learnedMotorWeights !== undefined) {
      assert((o.genome.plasticityRate ?? 0) > 0 && Array.isArray(o.learnedMotorWeights)
        && o.learnedMotorWeights.length <= MAX_PLASTIC_MOTOR_SYNAPSES,
        'somatic learned motor state');
      const hidden = new Set(o.genome.hiddenIds), output = new Set(o.genome.outputKeys);
      const inactive = new Set(o.genome.disabledConnections);
      const allowed = new Set(plasticMotorEdges(o.genome).map(s => s.edge));
      const seen = new Set<string>();
      for (const record of o.learnedMotorWeights) {
        assert(record && typeof record.edge === 'string'
          && record.edge.length <= 320 && !seen.has(record.edge), 'unique plastic synapse ID');
        seen.add(record.edge);
        let edge: unknown;
        try { edge = JSON.parse(record.edge); } catch { assert(false, 'plastic synapse ID'); }
        assert(Array.isArray(edge) && edge.length === 3
          && edge[0] === 'ho' && typeof edge[1] === 'string' && output.has(edge[1])
          && (o.genome.plasticMotorScope === 'all' || edge[1].endsWith(':Angle'))
          && typeof edge[2] === 'string' && hidden.has(edge[2])
          && record.edge === brainEdgeKey('ho', edge[1], edge[2])
          && !inactive.has(record.edge) && allowed.has(record.edge), 'plastic edge identity');
        assert(typeof record.delta === 'number' && Number.isFinite(record.delta)
          && Math.abs(record.delta) <= MAX_LEARNED_MOTOR_DELTA
          && typeof record.eligibility === 'number' && Number.isFinite(record.eligibility)
          && Math.abs(record.eligibility) <= 1, 'plastic state bounds');
        assert(record.consolidation === undefined ||
          ((o.genome.memoryConsolidationRate ?? 0) > 0
          && typeof record.consolidation === 'number'
          && Number.isFinite(record.consolidation)
          && record.consolidation >= 0 && record.consolidation <= 1),
          'somatic motor consolidation bounds');
      }
    }
    if (o.learnedSensoryWeights !== undefined) {
      assert((o.genome.sensoryPlasticityRate ?? 0) > 0
        && Array.isArray(o.learnedSensoryWeights)
        && o.learnedSensoryWeights.length <= MAX_PLASTIC_SENSORY_SYNAPSES,
        'somatic sensory learning state');
      const allowed = new Set(plasticSensoryEdges(o.genome).map(s => s.edge));
      const seen = new Set<string>();
      for (const record of o.learnedSensoryWeights) {
        assert(record && typeof record.edge === 'string'
          && record.edge.length <= 320 && allowed.has(record.edge) && !seen.has(record.edge),
          'learned retina edge identity');
        seen.add(record.edge);
        assert(typeof record.delta === 'number' && Number.isFinite(record.delta)
          && Math.abs(record.delta) <= MAX_LEARNED_MOTOR_DELTA
          && typeof record.eligibility === 'number' && Number.isFinite(record.eligibility)
          && Math.abs(record.eligibility) <= 1, 'learned retina state bounds');
        assert(record.consolidation === undefined ||
          ((o.genome.memoryConsolidationRate ?? 0) > 0
          && typeof record.consolidation === 'number'
          && Number.isFinite(record.consolidation)
          && record.consolidation >= 0 && record.consolidation <= 1),
          'somatic retinal consolidation bounds');
      }
    }
    // Preserve exact activations for current saves; migrate only legacy buffers.
    assert(o.neuralInputs.length === o.genome.inputKeys!.length && o.neuralOutputs.length === o.genome.outputKeys!.length, 'activation buffer sizes');
    return o;
  });
  assert(new Set(organisms.map(o => o.id)).size === organisms.length, 'duplicate organism IDs');
  for (const egg of data.eggs) {
    egg.genome = validateGenome(egg.genome);
    assert([egg.x, egg.y, egg.vx, egg.vy, egg.fundedReserve, egg.fundedStructural, egg.incubationProgress, egg.totalIncubationTime].every(Number.isFinite)
      && (egg.hatchHeading === undefined || Number.isFinite(egg.hatchHeading))
      && egg.fundedReserve >= 0 && egg.fundedStructural >= 0 && egg.totalIncubationTime > 0, 'egg state');
  }
  for (const n of data.nutrients) {
    assert([n.x, n.y, n.vx, n.vy, n.energyValue, n.radius].every(Number.isFinite) && n.energyValue >= 0 && n.radius > 0, 'nutrient state');
    assert(n.kind === undefined || n.kind === 'nutrient' || n.kind === 'carrion', 'food type');
    assert(n.decayTimeRemaining === undefined || (Number.isFinite(n.decayTimeRemaining) && n.decayTimeRemaining >= 0 && n.decayTimeRemaining <= CARRION_DECAY_SECONDS), 'food decay timer');
    assert(n.kind !== 'carrion' || n.decayTimeRemaining !== undefined, 'carrion decay timer');
  }
  const ledger = data.ledger;
  assert(ledger && ['externalInflow', 'metabolicDissipation', 'mechanicalWorkHeat', 'recordedLosses'].every(k => Number.isFinite(ledger[k]) && ledger[k] >= 0), 'energy ledger');
  assert(Number.isFinite(data.simTime) && data.simTime >= 0, 'simulation time');
  if (!legacy) {
    assert(Number.isFinite(data.nutrientAccumulator) && data.nutrientAccumulator >= 0, 'fractional inflow');
    assert([data.totalBirths, data.totalDeaths].every(n => Number.isInteger(n) && n >= 0), 'counters');
    assert(Array.isArray(data.recentDeaths) && data.recentDeaths.length <= 2000, 'death history');
  }
  assert((data.bubbles ?? []).length <= 1000 && (data.caustics ?? []).length <= 1000, 'effects count');
  const state: SimulationState = {
    ...data, organisms, prng, lineage: new Map(data.lineage), ledger,
    bubbles: data.bubbles ?? [], caustics: data.caustics ?? [],
    nutrientAccumulator: data.nutrientAccumulator ?? 0,
    totalBirths: data.totalBirths ?? organisms.length, totalDeaths: data.totalDeaths ?? 0,
    recentDeaths: data.recentDeaths ?? [],
  };
  delete (state as unknown as Record<string, unknown>).prngState;
  for (const rec of state.lineage.values()) rec.genome = validateGenome(rec.genome);
  return {state, settings, metadata: raw.metadata ?? {legacyImport: true}};
}

export function diagnosticReport(s: SimulationState, settings: SimulationSettings, selectedId?: string | null, metadata = {}) {
  const living = s.organisms.filter(o => !o.dissolving);
  const selected = living.find(o => o.id === selectedId);
  return {build: BUILD_VERSION, ...metadata, simTime: s.simTime, prngState: s.prng.getState(), settings,
    population: {living: living.length, decomposing: s.organisms.length - living.length, eggs: s.eggs.length,
      nutrients: s.nutrients.filter(n => n.kind !== 'carrion').length,
      carrion: s.nutrients.filter(n => n.kind === 'carrion').length, births: s.totalBirths, deaths: s.totalDeaths,
      families: [...new Set(living.map(o => o.genome.archetype))],
      diets: living.reduce<Record<string, number>>((counts, o) => {
        const diet = getDietClassification(o.genome.mouths).category;
        counts[diet] = (counts[diet] ?? 0) + 1; return counts;
      }, {})},
    energy: {...s.ledger, accounted: totalAccountedEnergy(s), errorJ: totalAccountedEnergy(s) - s.ledger.externalInflow},
    recentDeaths: s.recentDeaths,
    selected: selected ? {id: selected.id, name: selected.genome.name, generation: selected.genome.generation,
      age: selected.age, lifespan: selected.maxLifespan, energy: selected.energy, capacity: selected.genome.maxEnergyCapacity,
      bodyParts: selected.genome.parts.length, eyes: selected.genome.eyes.length, neuralInputs: selected.neuralInputs.length,
      speed: selected.speed, clutches: selected.clutchesLaid, offspring: selected.offspringCount,
      expenditureJPerSecond: {basal: selected.basalEnergyRate, sensory: selected.sensoryEnergyRate, motor: selected.motorEnergyRate},
      oralFeedback: selected.mouthFeedback, biteFeedbackJ: selected.biteFeedbackJ, motors: selected.joints.map((j, i) => ({partId: selected.genome.parts[i + 1].id,
        amplitude: j.amplitude, engagement: j.engagement, torque: j.appliedTorque})),
      feedings: selected.recentFeedings,
      lifetimeLearning: {inheritedRate: selected.genome.plasticityRate ?? 0,
        inheritedForgetRate: selected.genome.forgettingRate ?? 0.1,
        plasticMotorScope: selected.genome.plasticMotorScope ?? 'angle',
        inheritedAversionRate: selected.genome.injuryAversionRate ?? 0,
        inheritedSensoryLearningRate: selected.genome.sensoryPlasticityRate ?? 0,
        inheritedConsolidationRate: selected.genome.memoryConsolidationRate ?? 0,
        consolidatedMotorEdges: (selected.learnedMotorWeights ?? [])
          .filter(edge => (edge.consolidation ?? 0) > .01).length,
        consolidatedRetinalEdges: (selected.learnedSensoryWeights ?? [])
          .filter(edge => (edge.consolidation ?? 0) > .01).length,
        adaptedRetinalSynapses: (selected.learnedSensoryWeights ?? []).filter(edge => Math.abs(edge.delta) > 1e-8).length,
        adaptedMotorSynapses: (selected.learnedMotorWeights ?? []).filter(edge => Math.abs(edge.delta) > 1e-8).length,
        plasticityEnergyRate: selected.plasticityEnergyRate ?? 0}} : null};
}
