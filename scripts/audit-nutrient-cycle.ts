/** Bounded issue #125 comparison, registered before execution; no selection/tuning. */
import assert from 'node:assert/strict';
import {writeFileSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInitialWorld, collectWorldStats, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, totalAccountedEnergy} from '../persistence';
import {stepSimulation, type SimulationSettings} from '../simulation';
import {EcologyIntakeObserver} from '../ecologyAudit';
import {createScenarioWorld} from '../environmentScenarios';
import {FEATURED_BLUEPRINTS, createFounderGenome} from '../founders';
import {enableClosedEconomy} from '../energyEconomy';

const output = 'docs/experiments/nutrient-cycle-v1.json';
const resume = process.argv.includes('--food-free-only') ? JSON.parse(readFileSync(output, 'utf8')) : undefined;
const ecology = resume?.ecology ?? [];
for (const seed of resume ? [] : [17, 73]) for (const nutrientCycle of [undefined, 'decay-v1'] as const) {
  const settings: SimulationSettings = {...DEFAULT_SETTINGS, physicsRegime: 'passive-work-v3',
    mouthContactModel: 'capsule-v1', ecologyRegime: 'closed-v1', nutrientLimit: null, nutrientCycle};
  const state = createInitialWorld(settings, seed, 'balanced', 'showcase'), intake = new EcologyIntakeObserver();
  const initial = createSnapshot(state, settings), began = performance.now(); let maxErrorJ = 0;
  for (let i = 0; i < 3600; i++) {
    stepSimulation(state, settings, 1 / 60); intake.sample(state);
    maxErrorJ = Math.max(maxErrorJ, Math.abs(totalAccountedEnergy(state) - state.energyPool!.budget));
  }
  const row = {seed, nutrientCycle: nutrientCycle ?? 'historical', seconds: 60,
    initialStateSHA256: createHash('sha256').update(JSON.stringify(initial.state)).digest('hex'),
    ...collectWorldStats(state, settings.targetNutrients), absorbedJ: intake.totals(), reserveJ: state.energyPool!.reserve,
    maxErrorJ, kernelAndObservationMs: performance.now() - began};
  ecology.push(row); console.log(JSON.stringify(row)); assert.ok(maxErrorJ < 1e-6);
}
const extinct = resume?.extinct ?? [];
for (const scenario of (resume ? [] : ['default', 'harsh-world']) as ('default' | 'harsh-world')[]) for (const nutrientCycle of [undefined, 'decay-v1'] as const) {
  const defaults: SimulationSettings = {...DEFAULT_SETTINGS, physicsRegime: 'passive-work-v3',
    ecologyRegime: 'closed-v1', nutrientLimit: null, nutrientCycle};
  const f = createScenarioWorld(defaults, scenario, 17, 'balanced', 'standard', 0);
  let generated = 0, maxErrorJ = 0;
  for (let i = 0; i < 7200; i++) {
    const ids = new Set(f.state.nutrients.map(n => n.id)); stepSimulation(f.state, f.settings, 1 / 60);
    generated += f.state.nutrients.filter(n => !ids.has(n.id)).length;
    maxErrorJ = Math.max(maxErrorJ, Math.abs(totalAccountedEnergy(f.state) - f.state.energyPool!.budget));
  }
  const row = {scenario, nutrientCycle: nutrientCycle ?? 'historical', seconds: 120, generated,
    ...collectWorldStats(f.state, f.settings.targetNutrients), reserveJ: f.state.energyPool!.reserve, maxErrorJ};
  extinct.push(row); console.log(JSON.stringify(row)); assert.ok(maxErrorJ < 1e-6);
}
// Frozen designs: one five-second food-free equality control per design.
const foodFree = [];
for (const design of FEATURED_BLUEPRINTS) {
  const cfg: SimulationSettings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0,
    ecologyRegime: 'closed-v1', nutrientLimit: null, physicsRegime: 'passive-work-v3', mouthContactModel: 'capsule-v1'};
  const open = {...cfg, ecologyRegime: undefined};
  const all = createInitialWorld(open, 711, 'balanced', 'standard', 0);
  addExternalOrganism(all, createFounderGenome(design.id), open, 1200, 750, .37);
  enableClosedEconomy(all);
  const before = createSnapshot(all, cfg);
  const {restoreSnapshot} = await import('../persistence');
  const a = restoreSnapshot(before), b = restoreSnapshot(before); b.settings.nutrientCycle = 'decay-v1';
  for (let i = 0; i < 300; i++) {stepSimulation(a.state, a.settings, 1 / 60); stepSimulation(b.state, b.settings, 1 / 60);}
  assert.deepEqual(createSnapshot(a.state, a.settings).state, createSnapshot(b.state, b.settings).state);
  foodFree.push({id: design.id, seconds: 5, exactFullState: true});
}
writeFileSync(output, JSON.stringify({protocol: 'issue-125-nutrient-cycle-v1',
  base: 'c6306a39776b738e28cf99a40328dcdc045a3a6e', ecology, extinct, foodFree,
  ...(resume ? {executionNote: resume.executionNote} : {}),
  limits: ['One pair per seed, no reruns or evolutionary selection. Short trajectories do not establish sustainable ecology.',
    'Timing includes read-only census/intake and is a single sequential sample, not a browser FPS or controlled throughput claim.',
    'Historical ecological reference files remain unchanged. Physical food radius/lifetime deliberately changes new trajectories.']}, null, 2) + '\n');
