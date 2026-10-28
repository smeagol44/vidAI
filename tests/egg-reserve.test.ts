import assert from 'node:assert/strict';
import {test} from 'node:test';
import {eggReserveLossFraction as loss, drawEggReserveLoss, EGG_RESERVE_LOSS_COLOR} from '../eggReserve';
import {createSnapshot, restoreSnapshot, totalAccountedEnergy} from '../persistence';
import {fundIncubatingEggs, setWorldEnergy} from '../energyEconomy';
import * as sim from '../simulation';
import {addExternalOrganism} from '../world';
import {createFounderGenome} from '../founders';
import {SimulationHost, RenderReplica} from '../simulationHost';
import {eggReserveFixture} from './support/egg-reserve';
import {mouthContactFixture} from '../mouthContactAudit';

for (const [current, expected] of [[1000, 0], [750, .25], [500, .5], [0, 1], [1200, 0]] as const)
  test(`reserve ${current}/1000 displays ${expected * 100}% pink`, () => {
    assert.equal(loss({fundedReserve: current, initialFundedReserve: 1000}), expected);
  });

test('structural loss stays pink; actual existing uptake reverses loss without changing the reference', () => {
  const {state, config} = eggReserveFixture(true), e = state.eggs[4];
  const original = e.initialFundedReserve;
  e.fundedStructural -= 100;
  assert.equal(loss(e), 1);
  setWorldEnergy(state, state.energyPool!.budget + 10000);
  fundIncubatingEggs(state, 1); // repair structure first, as before
  assert.equal(loss(e), 1);
  const before = totalAccountedEnergy(state);
  fundIncubatingEggs(state, 100);
  assert.equal(e.fundedStructural, e.genome.bodyCost);
  assert.ok(e.fundedReserve > 0);
  assert.equal(loss(e), 1 - e.fundedReserve / original!);
  assert.equal(e.initialFundedReserve, original);
  assert.ok(Math.abs(totalAccountedEnergy(state) - before) < 1e-6);
  assert.ok(config.ecologyRegime);
});

test('zero, tiny, missing and exceptional references have finite deterministic displays', () => {
  for (const [current, initial, expected] of [[0, 0, 1], [1, 0, 0], [-1, 1, 1],
    [1, -1, 1], [NaN, 1, 1], [Infinity, 1, 1], [1, Infinity, 1], [1, NaN, 1],
    [Number.MIN_VALUE, Number.MIN_VALUE, 0], [Number.MAX_VALUE, Number.MIN_VALUE, 0]] as const)
    assert.equal(loss({fundedReserve: current, initialFundedReserve: initial}), expected);
  assert.equal(loss({fundedReserve: 200}), 0);
  assert.equal(loss({fundedReserve: 0}), 1);
});

test('pie starts at noon and grows counterclockwise inside the shell without touching state', () => {
  const calls: Array<[string, ...unknown[]]> = [];
  const ctx = {beginPath: () => calls.push(['begin']), moveTo: (...v: number[]) => calls.push(['move', ...v]),
    arc: (...v: unknown[]) => calls.push(['arc', ...v]), closePath: () => calls.push(['close']),
    fill: () => calls.push(['fill']), fillStyle: ''} as unknown as CanvasRenderingContext2D;
  for (const fraction of [0, .25, .5, 1]) {
    calls.length = 0;
    const e = {fundedReserve: 1000 * (1 - fraction), initialFundedReserve: 1000}, before = {...e};
    drawEggReserveLoss(ctx, e); assert.deepEqual(e, before);
    if (!fraction) {assert.deepEqual(calls, []); continue;}
    assert.deepEqual(calls.find(c => c[0] === 'arc'), ['arc', 0, 0, 16, -Math.PI / 2,
      -Math.PI / 2 - 2 * Math.PI * fraction, true]);
    assert.equal(calls.some(c => c[0] === 'move'), fraction < 1);
    assert.equal(ctx.fillStyle, EGG_RESERVE_LOSS_COLOR);
  }
});

for (const closed of [false, true]) test(`reserve references survive JSON, restore, Worker frames and forks (${closed ? 'closed' : 'open'})`, () => {
  const {state, config} = eggReserveFixture(closed);
  const snapshot = createSnapshot(state, config);
  const restored = restoreSnapshot(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(createSnapshot(restored.state, config), snapshot);
  const host = new SimulationHost(); host.reset(snapshot, 1);
  const frame = host.frame(), replica = new RenderReplica().apply(frame, state);
  assert.deepEqual(replica.eggs, restored.state.eggs);
  assert.deepEqual(host.snapshot(), snapshot);
  for (let i = 0; i < 60; i++) host.tick();
  assert.deepEqual(host.state.eggs.map(e => e.initialFundedReserve), [1000, 1000, 1000, 1000, 1000]);
  host.reset(host.snapshot(), 2);
  assert.equal(host.state.eggs[1].initialFundedReserve, 1000);
});

for (const schema of ['12.0.0', '13.0.0', '14.0.0', '15.0.0'])
  test(`old ${schema} eggs initialize only from known current reserve and retain migration provenance`, () => {
    const {state, config} = eggReserveFixture(schema === '13.0.0');
    config.physicsRegime = schema === '15.0.0' ? 'passive-work-v3' : 'paid-work-v2';
    if (schema === '12.0.0' || schema === '13.0.0') delete config.mouthContactModel;
    const snapshot = createSnapshot(state, config); snapshot.schemaVersion = schema;
    for (const egg of snapshot.state.eggs) {delete (egg as any).initialFundedReserve; delete (egg as any).initialReserveIsLegacy;}
    const before = JSON.stringify(snapshot), restored = restoreSnapshot(snapshot);
    assert.equal(JSON.stringify(snapshot), before, 'import must not mutate its input');
    assert.deepEqual(restored.state.eggs.map(e => e.initialFundedReserve), [1000, 750, 500, 250, 0]);
    assert.ok(restored.state.eggs.every(e => e.initialReserveIsLegacy));
    assert.deepEqual(restored.state.prng.getState(), snapshot.state.prngState);
    const saved = createSnapshot(restored.state, restored.settings);
    assert.deepEqual(createSnapshot(restoreSnapshot(saved).state, restored.settings), saved);
    sim.stepSimulation(restored.state, restored.settings, 1 / 60);
    assert.deepEqual(restored.state.eggs.map(e => e.initialFundedReserve), [1000, 750, 500, 250, 0]);
  });

test('invalid imported reference metadata is rejected before replacing a world', () => {
  const {state, config} = eggReserveFixture();
  for (const bad of [-1, NaN, Infinity, '1000', null]) {
    const snapshot = createSnapshot(state, config);
    (snapshot.state.eggs[0] as any).initialFundedReserve = bad;
    assert.throws(() => restoreSnapshot(snapshot), /initial egg reserve|non-finite/);
  }
  const snapshot = createSnapshot(state, config);
  (snapshot.state.eggs[0] as any).initialReserveIsLegacy = 'yes';
  assert.throws(() => restoreSnapshot(snapshot), /provenance/);
});

test('laying captures actual parent funding, independent of child genome and parent survival', () => {
  const {state, config} = eggReserveFixture(); state.eggs = [];
  const g = createFounderGenome('CUR-001');
  const parent = addExternalOrganism(state, g, config, 500, 400, 0)!;
  parent.age = 50; parent.energy = g.maxEnergyCapacity; state.simTime = 100;
  sim.stepSimulation(state, config, 1 / 60);
  assert.ok(state.eggs.length > 0);
  for (const e of state.eggs) {
    assert.equal(e.initialFundedReserve, sim.getEggReserveFunding(g));
    assert.equal(e.initialFundedReserve, e.fundedReserve);
    assert.equal(loss(e), 0); assert.equal(e.initialReserveIsLegacy, undefined);
  }
  state.organisms = [];
  const ref = state.eggs.map(e => e.initialFundedReserve);
  sim.stepSimulation(state, config, 1 / 60);
  assert.deepEqual(state.eggs.map(e => e.initialFundedReserve), ref);
});

test('different display references leave egg-white optics, neural inputs and deterministic ecology identical', () => {
  const {state, config} = eggReserveFixture();
  const g = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(21));
  g.parts = [g.parts[0]]; g.motorForce = 0; g.mouths = [];
  g.eyes = [{id: 'eye', partIndex: 0, direction: 'EAST', fov: .8, range: 500}];
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = sim.calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier); sim.remapBrain(g);
  addExternalOrganism(state, g, config, 100, 400, 0);
  const source = createSnapshot(state, config), a = restoreSnapshot(source).state, b = restoreSnapshot(source).state;
  b.eggs = b.eggs.map(e => ({...e, initialFundedReserve: 100000, initialReserveIsLegacy: true}));
  const omitDisplay = (s: sim.SimulationState) => {
    const snapshot = createSnapshot(s, config);
    for (const e of snapshot.state.eggs) {delete (e as any).initialFundedReserve; delete (e as any).initialReserveIsLegacy;}
    return snapshot;
  };
  for (let i = 0; i < 60; i++) {
    sim.stepSimulation(a, config, 1 / 60); sim.stepSimulation(b, config, 1 / 60);
    assert.deepEqual(omitDisplay(a), omitDisplay(b));
  }
  const hits = a.organisms[0].rayHits.filter(r => r.objectType === 'egg');
  assert.ok(hits.length > 0);
  for (const r of hits) {assert.equal(r.r, r.g); assert.equal(r.g, r.b); assert.ok(r.r > 0);}
  assert.deepEqual(sim.EGG_RGB, [1, 1, 1]);
});


test('actual egg predation consumes reserve then structure without changing the original reference', () => {
  const {state, config, hunter, prey} = mouthContactFixture('capsule-v1', 'head-on');
  state.organisms = [hunter];
  hunter.genome.mouths[0].mouthType = 'omnivore';
  state.eggs.push({id: 'bitten', clutchId: 'foreign', parentOrgId: 'foreign', x: 1220, y: 750,
    vx: 0, vy: 0, genome: structuredClone(prey.genome), fundedReserve: 60,
    initialFundedReserve: 60, fundedStructural: 1000, incubationProgress: 0,
    totalIncubationTime: 100, pulseTimer: 0, colorHue: 0, readyToHatch: false});
  const e = state.eggs[0];
  sim.stepSimulation(state, config, 1 / 60);
  assert.equal(e.fundedReserve, 30); assert.equal(loss(e), .5);
  sim.stepSimulation(state, config, 1 / 60);
  assert.equal(e.fundedReserve, 0); assert.equal(loss(e), 1);
  sim.stepSimulation(state, config, 1 / 60);
  assert.ok(e.fundedStructural < 1000); assert.equal(loss(e), 1);
  assert.equal(e.initialFundedReserve, 60);
});

test('all actual reserve loss levels remain exactly white to the same eye', () => {
  const {state, config} = eggReserveFixture();
  const g = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(21));
  g.parts = [g.parts[0]]; g.motorForce = 0; g.mouths = [];
  g.eyes = [{id: 'eye', partIndex: 0, direction: 'EAST', fov: .8, range: 500}];
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = sim.calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier); sim.remapBrain(g);
  addExternalOrganism(state, g, config, 100, 400, 0);
  const source = createSnapshot(state, config);
  let reference: unknown;
  for (const reserve of [1000, 750, 500, 0, 1200]) {
    const s = restoreSnapshot(source).state; s.eggs[0].fundedReserve = reserve;
    sim.stepSimulation(s, config, 1 / 60);
    const observed = {rays: s.organisms[0].rayHits, inputs: s.organisms[0].neuralInputs,
      hidden: s.organisms[0].neuralHidden, outputs: s.organisms[0].neuralOutputs};
    if (reference) assert.deepEqual(observed, reference); else reference = observed;
    assert.ok(observed.rays.some(r => r.objectType === 'egg'));
  }
});
