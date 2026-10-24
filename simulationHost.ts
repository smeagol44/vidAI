import type {LearningObserver} from './learningObservation';
import type {ActuationObserver} from './actuationObservation';
import type {MechanicalObserver} from './mechanicalObservation';
import {watchLineage} from './lineageChanges';
import {occupiedPopulation, setWorldEnergy} from './energyEconomy';
import {stepSimulation, addNutrients, nutrientSpawnSlots, createArchetypeGenome,
  clampVal, type Genome, type SimulationState, type SimulationSettings,
  type Organism, type Egg, type LineageRecord, type ArchetypeId, type OfflineMortalityProtection} from './simulation';
import {createSnapshot, restoreSnapshot, clearFreeNutrients, resizeWorld} from './persistence';
import {addExternalOrganism} from './world';

export type WorldSnapshot = ReturnType<typeof createSnapshot>;
export type WorldAction =
  | {kind: 'energy-budget'; joules: number}
  | {kind: 'feed'; x: number; y: number; count: number}
  | {kind: 'feed-all'} | {kind: 'clear-food'}
  | {kind: 'resize'; width: number; height: number}
  | {kind: 'spawn'; x: number; y: number; archetype: ArchetypeId; genome?: Genome};
type LiveOrganism = Omit<Organism, 'genome'> & {genomeKey: string};
type LiveEgg = Omit<Egg, 'genome'> & {genomeKey: string};
export interface RenderFrame {
  epoch: number; steps: number; events: string[];
  genomes: Array<[string, Genome]>;
  lineage: Array<[string, Omit<LineageRecord, 'genome'> & {genomeKey: string}]>;
  state: Omit<SimulationState, 'prng' | 'lineage' | 'organisms' | 'eggs'>
    & {organisms: LiveOrganism[]; eggs: LiveEgg[]};
}

/** Sole owner of authoritative state in the Worker. Shared by headless tests.
 * Commands execute between complete fixed ticks, including exact exports. */
export class SimulationHost {
  state!: SimulationState;
  settings!: SimulationSettings;
  epoch = 0; running = false; speed = 1; selected: string | null = null;
  private genomeIds = new WeakMap<Genome, string>();
  private nextGenome = 0;
  private lineageChanges?: ReturnType<typeof watchLineage>;
  private steps = 0;
  private events = new Set<string>();

  reset(snapshot: WorldSnapshot, epoch: number): void {
    const restored = restoreSnapshot(snapshot);
    this.lineageChanges?.dispose();
    this.state = restored.state; this.settings = restored.settings; this.epoch = epoch;
    this.running = false; this.steps = 0; this.events.clear();
    this.genomeIds = new WeakMap(); this.nextGenome = 0;
    this.lineageChanges = watchLineage(this.state.lineage);
  }
  tick(observe?: MechanicalObserver, actuation?: ActuationObserver, offlineMortality?: OfflineMortalityProtection,observeLearning?:LearningObserver): void {
    stepSimulation(this.state, this.settings, 1 / 60, event => this.events.add(event), observe, actuation, offlineMortality,observeLearning);
    this.steps++;
  }
  snapshot(metadata: Record<string, unknown> = {}): WorldSnapshot {
    return createSnapshot(this.state, this.settings, metadata);
  }
  action(action: WorldAction): string | number | null {
    const s = this.state, config = this.settings;
    if (action.kind === 'energy-budget') {setWorldEnergy(s, action.joules); return s.energyPool!.reserve;}
    if (action.kind === 'feed') return addNutrients(s, config, action.count,
      {x: action.x, y: action.y, spread: 80});
    if (action.kind === 'clear-food') return clearFreeNutrients(s);
    if (action.kind === 'resize') {
      resizeWorld(s, config, action.width, action.height);
      this.settings = {...config, worldWidth: action.width, worldHeight: action.height};
      return null;
    }
    if (action.kind === 'feed-all') {
      const living = s.organisms.filter(o => !o.dissolving);
      if (!living.length) return addNutrients(s, config, 35,
        {x: config.worldWidth / 2, y: config.worldHeight / 2, spread: 80});
      let added = 0;
      for (const org of living) {
        added += addNutrients(s, config, 2, {...org.segments[0], spread: 60});
        if (!nutrientSpawnSlots(s, config)) break;
      }
      return added;
    }
    if (occupiedPopulation(s) >= (config.maxOrganisms ?? 100)) return null;
    const x = clampVal(action.x + s.prng.range(-80, 80), 100, config.worldWidth - 100);
    const y = clampVal(action.y + s.prng.range(-80, 80), 100, config.worldHeight - 100);
    const g = action.genome ? structuredClone(action.genome)
      : createArchetypeGenome(action.archetype, 1, [], s.prng);
    return addExternalOrganism(s, g, config, x, y)?.id ?? null;
  }

  /** Genomes travel once; growing lineage sends only changed records.
   * Unselected animals omit heavy inspector-only acquired synapses/activations.
   * This is a render replica, NEVER a source for exports or commands. */
  frame(): RenderFrame {
    const genomes: RenderFrame['genomes'] = [];
    const key = (g: Genome) => {
      let id = this.genomeIds.get(g);
      if (!id) {id = `g${this.nextGenome++}`; this.genomeIds.set(g, id); genomes.push([id, g]);}
      return id;
    };
    const {prng: _prng, lineage: sourceLineage, organisms, eggs, ...rest} = this.state;
    const live = organisms.map(org => {
      const {genome, learnedMotorWeights, learnedSensoryWeights,
        neuralHidden, neuralInputs, neuralOutputs, ...body} = org;
      return {...body, genomeKey: key(genome),
        neuralHidden: org.id === this.selected ? neuralHidden : [],
        neuralInputs: org.id === this.selected ? neuralInputs : [],
        neuralOutputs: org.id === this.selected ? neuralOutputs : [],
        ...(org.id === this.selected ? {learnedMotorWeights, learnedSensoryWeights} : {})};
    });
    const liveEggs = eggs.map(({genome, ...egg}) => ({...egg, genomeKey: key(genome)}));
    const lineage: RenderFrame['lineage'] = [];
    for (const id of this.lineageChanges!.pending) {
      const record = sourceLineage.get(id)!;
      const {genome, ...entry} = record;
      lineage.push([id, {...entry, genomeKey: key(genome)}]);
    }
    this.lineageChanges!.pending.clear();
    const result = {epoch: this.epoch, steps: this.steps, events: [...this.events], genomes, lineage,
      state: {...rest, organisms: live, eggs: liveEggs}};
    this.steps = 0; this.events.clear();
    return result;
  }
}

export class RenderReplica {
  private genomes = new Map<string, Genome>();
  private lineage = new Map<string, LineageRecord>();
  private epoch = -1;
  apply(frame: RenderFrame, previous: SimulationState): SimulationState {
    if (frame.epoch !== this.epoch) {
      this.epoch = frame.epoch; this.genomes.clear(); this.lineage.clear();
    }
    for (const [id, genome] of frame.genomes) this.genomes.set(id, genome);
    const getGenome = (id: string) => {
      const g = this.genomes.get(id);
      if (!g) throw new Error(`Missing render genome ${id}`);
      return g;
    };
    for (const [id, {genomeKey, ...record}] of frame.lineage)
      this.lineage.set(id, {...record, genome: getGenome(genomeKey)});
    return {...frame.state, prng: previous.prng, lineage: this.lineage,
      organisms: frame.state.organisms.map(({genomeKey, ...org}) => ({...org, genome: getGenome(genomeKey)})),
      eggs: frame.state.eggs.map(({genomeKey, ...egg}) => ({...egg, genome: getGenome(genomeKey)}))};
  }
}
