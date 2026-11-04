import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createScenarioWorld, PIPE_WORLD_PRESET} from '../environmentScenarios';
import {createInitialWorld} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot, clearFreeNutrients, totalAccountedEnergy} from '../persistence';
import {stepSimulation, NUTRIENT_ENERGY_VALUE} from '../simulation';
import {NEW_PHYSICS_REGIME} from '../foundationPhysics';
import {SimulationHost} from '../simulationHost';

const defaults = {...DEFAULT_SETTINGS, physicsRegime: NEW_PHYSICS_REGIME,
  ecologyRegime: 'closed-v1' as const, nutrientLimit: null, mouthContactModel: 'capsule-v1' as const};
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('Default preserves complete prior initialization, settings and deterministic continuation', () => {
  const before = createInitialWorld(defaults, 17);
  const {state, settings} = createScenarioWorld(defaults, 'default', 17);
  assert.deepEqual(settings, defaults);
  assert.deepEqual(createSnapshot(state, settings), createSnapshot(before, defaults));
  for (let i = 0; i < 60; i++) {
    stepSimulation(state, settings, 1 / 60); stepSimulation(before, defaults, 1 / 60);
  }
  assert.deepEqual(createSnapshot(state, settings), createSnapshot(before, defaults));
});

test('Harsh World applies only specified settings before time zero and banks the full Default food grant', () => {
  const original = structuredClone(defaults);
  const {state, settings} = createScenarioWorld(defaults, 'harsh-world', 17);
  assert.deepEqual(defaults, original);
  assert.deepEqual(settings, {...defaults, inflowRate: 1, nutrientLimit: 200,
    worldWidth: 4800, worldHeight: 3000, gravity: 20, maxOrganisms: 50, waterViscosity: .4});
  const manual = createInitialWorld(settings, 17);
  assert.equal(manual.nutrients.length, 200);
  clearFreeNutrients(manual);
  assert.deepEqual(createSnapshot(state, settings), createSnapshot(manual, settings));
  const normal = createInitialWorld(defaults, 17);
  assert.equal(state.simTime, 0); assert.equal(state.nutrients.length, 0);
  assert.equal(state.nutrientAccumulator, 0); assert.equal(state.organisms.length, 18);
  assert.equal(state.energyPool!.budget, normal.energyPool!.budget);
  assert.equal(state.ledger.externalInflow, normal.ledger.externalInflow);
  close(state.energyPool!.reserve, defaults.targetNutrients * NUTRIENT_ENERGY_VALUE);
  close(totalAccountedEnergy(state), state.energyPool!.budget);
});

test('both founder brain modes and existing population presets remain independent of the environment', () => {
  for (const mode of ['balanced', 'unbiased'] as const) {
    for (const [preset, count] of [['standard', 18], ['showcase', 9], ['megafauna', 12], ['predator_cove', 18]] as const) {
      const normal = createScenarioWorld(defaults, 'default', 73, mode, preset);
      const harsh = createScenarioWorld(defaults, 'harsh-world', 73, mode, preset);
      assert.equal(harsh.state.organisms.length, count);
      assert.deepEqual(harsh.state.organisms.map(o => o.genome), normal.state.organisms.map(o => o.genome));
      assert.deepEqual(harsh.state.prng.getState(), normal.state.prng.getState());
      assert.equal(harsh.state.energyPool!.budget, normal.state.energyPool!.budget);
    }
  }
});

test('Harsh recycling spends existing reserve at 1/s, stops at 200 and remains manually editable', () => {
  // An empty founder selection isolates recycling from real feeding and death.
  const {state, settings} = createScenarioWorld(defaults, 'harsh-world', 17, 'balanced', 'standard', 0);
  const grant = state.energyPool!.reserve;
  for (let i = 0; i < 59; i++) stepSimulation(state, settings, 1 / 60);
  assert.equal(state.nutrients.length, 0);
  stepSimulation(state, settings, 1 / 60);
  assert.equal(state.nutrients.length, 1); close(state.energyPool!.reserve, grant - NUTRIENT_ENERGY_VALUE);
  for (let i = 60; i < 201 * 60; i++) stepSimulation(state, settings, 1 / 60);
  assert.equal(state.nutrients.length, 200); assert.equal(state.nutrientAccumulator, 0);
  close(state.energyPool!.reserve, grant - 200 * NUTRIENT_ENERGY_VALUE);
  const edited = {...settings, nutrientLimit: 201, inflowRate: 60, gravity: 0, waterViscosity: .18};
  stepSimulation(state, edited, 1 / 60);
  assert.equal(state.nutrients.length, 201);
  close(totalAccountedEnergy(state), state.energyPool!.budget);
});

test('Harsh snapshots and Worker-host control edits continue exactly without reapplying a scenario', () => {
  const {state, settings} = createScenarioWorld(defaults, 'harsh-world', 73, 'unbiased', 'standard', 2);
  const host = new SimulationHost(); host.reset(createSnapshot(state, settings), 1);
  assert.equal(host.state.simTime, 0); assert.equal(host.state.nutrients.length, 0);
  const edited = {...settings, inflowRate: 2, nutrientLimit: 5, gravity: -10, waterViscosity: .12};
  host.settings = edited;
  for (let i = 0; i < 90; i++) host.tick();
  const saved = host.snapshot(), copy = restoreSnapshot(saved);
  assert.deepEqual(copy.settings, edited);
  host.reset(saved, 2);
  for (let i = 0; i < 60; i++) {host.tick(); stepSimulation(copy.state, copy.settings, 1 / 60);}
  assert.deepEqual(host.snapshot(), createSnapshot(copy.state, copy.settings));
  close(totalAccountedEnergy(host.state), state.energyPool!.budget);
});

const pipeReference = {...defaults, nutrientCycle: 'decay-v2' as const,
  worldWidth: 4600, worldHeight: 2100, gravity: 20, waterViscosity: .4,
  inflowRate: 1, nutrientLimit: 200, maxOrganisms: 50};

test('Pipe owns explicit frozen settings independent of Harsh, caller defaults and other instances', () => {
  assert.deepEqual(PIPE_WORLD_PRESET, pipeReference);
  assert.ok(Object.isFrozen(PIPE_WORLD_PRESET));
  const first = createScenarioWorld(defaults, 'pipe-world', 17);
  const hostile = {...defaults, gravity: -20, waterViscosity: .02, targetNutrients: 5,
    inflowRate: 99, maxOrganisms: 3, mutationSeverity: .9, kinshipProtection: false};
  const harsh = createScenarioWorld(hostile, 'harsh-world', 17);
  harsh.settings.targetNutrients = 10;
  first.settings.gravity = 0;
  const second = createScenarioWorld(hostile, 'pipe-world', 17);
  assert.deepEqual(second.settings, pipeReference);
  assert.notEqual(first.settings, second.settings);
  second.settings.inflowRate = 4;
  assert.equal(createScenarioWorld(defaults, 'harsh-world', 17).settings.inflowRate, 1);
  assert.equal(PIPE_WORLD_PRESET.inflowRate, 1);
});

test('Pipe matches the frozen Harsh startup recipe except dimensions, with funded food and zero topology', () => {
  const pipe = createScenarioWorld(defaults, 'pipe-world', 73);
  const harsh = createScenarioWorld({...defaults, nutrientCycle: 'decay-v2'}, 'harsh-world', 73);
  assert.deepEqual(pipe.settings, {...harsh.settings, worldWidth: 4600, worldHeight: 2100});
  const manual = createInitialWorld(pipeReference, 73);
  clearFreeNutrients(manual);
  assert.deepEqual(createSnapshot(pipe.state, pipe.settings), createSnapshot(manual, pipeReference));
  assert.equal(pipe.state.organisms.length, 18);
  assert.equal(pipe.state.eggs.length, 0);
  assert.equal(pipe.state.nutrients.length, 0);
  assert.equal(pipe.state.simTime, 0);
  assert.equal(pipe.state.nutrientAccumulator, 0);
  assert.equal(pipe.state.selfTubes, undefined);
  assert.equal(pipe.state.energyPool!.reserve, 825000);
  assert.equal(pipe.state.energyPool!.budget, harsh.state.energyPool!.budget);
  assert.deepEqual(pipe.observerPreferences, {selectAddedCreature: false, trackSelectedCreature: false, showCaustics: false});
  close(totalAccountedEnergy(pipe.state), pipe.state.energyPool!.budget);
});

test('Pipe preserves all founder presets and both brain modes independently', () => {
  for (const mode of ['balanced', 'unbiased'] as const) {
    for (const [preset, count] of [['standard', 18], ['showcase', 9], ['megafauna', 12], ['predator_cove', 18]] as const) {
      const pipe = createScenarioWorld(defaults, 'pipe-world', 73, mode, preset);
      const harsh = createScenarioWorld(defaults, 'harsh-world', 73, mode, preset);
      assert.equal(pipe.state.organisms.length, count);
      assert.deepEqual(pipe.state.organisms.map(o => o.genome), harsh.state.organisms.map(o => o.genome));
      assert.deepEqual(pipe.state.prng.getState(), harsh.state.prng.getState());
      assert.equal(pipe.state.energyPool!.budget, harsh.state.energyPool!.budget);
      assert.equal(pipe.state.selfTubes, undefined);
    }
  }
});

test('Pipe exports within unchanged dimension limits and restores edited conditions and exact continuation', () => {
  const {state, settings} = createScenarioWorld(defaults, 'pipe-world', 73, 'unbiased', 'standard', 2);
  const host = new SimulationHost(); host.reset(createSnapshot(state, settings), 1);
  for (let i = 0; i < 60; i++) host.tick();
  assert.equal(host.state.nutrients.length, 1);
  host.settings = {...host.settings, gravity: -10, inflowRate: 2, nutrientLimit: 7, waterViscosity: .12};
  const saved = JSON.parse(JSON.stringify(host.snapshot()));
  const restored = restoreSnapshot(saved);
  assert.equal(saved.schemaVersion, '20.0.0');
  assert.deepEqual(createSnapshot(restored.state, restored.settings), saved);
  host.reset(saved, 2);
  for (let i = 0; i < 60; i++) {host.tick(); stepSimulation(restored.state, restored.settings, 1 / 60);}
  assert.deepEqual(host.snapshot(), createSnapshot(restored.state, restored.settings));
  assert.equal(host.state.selfTubes, undefined);
  close(totalAccountedEnergy(host.state), state.energyPool!.budget);
});
