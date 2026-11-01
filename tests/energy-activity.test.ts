import assert from 'node:assert/strict';
import {test} from 'node:test';
import {performance} from 'node:perf_hooks';
import {EnergyActivityCollector, EnergyActivityPresentation, ENERGY_CYCLE_MS} from '../energyActivity';
import {mouthContactFixture} from '../mouthContactAudit';
import {createSnapshot, restoreSnapshot} from '../persistence';
import {SimulationHost} from '../simulationHost';
import {stepSimulation, createReferenceNematodeGenome, calculateBodyCost, calculateMaxEnergyCapacity,
  remapBrain, spawnOrganism, evaluateReproductionAffordability, XoshiroPRNG} from '../simulation';
import {createFounderGenome} from '../founders';
import {energyActivityFixture} from './support/energy-activity';
import {addExternalOrganism} from '../world';

const living = [{id: 'a', dissolving: false}];
const clockState = (simTime: number) => ({simTime, organisms: living});
const row = (gain: boolean, loss: boolean, parts = [1]) => [{id: 'a', gain, gainSeen: gain,
  loss, lossSeen: loss, parts: loss ? parts : [], seenParts: loss ? parts : []}];

test('relative window thresholds, hysteresis, independent directions and safe depleted stock', () => {
  const c = new EnergyActivityCollector();
  c.record('a', 1 / 60, 4, 1000, 1000, -1); c.advance(clockState(1 / 60));
  assert.equal(c.frame()[0].gain, false);
  c.record('a', 2 / 60, 1, 1000, 1000, -1); c.advance(clockState(2 / 60));
  assert.equal(c.frame()[0].gain, true);
  c.advance(clockState(16 / 60)); // first 4J expire, 1J cannot sustain signal
  assert.equal(c.frame()[0].gain, false);
  c.clear();
  c.record('a', 0, 5, 1000, 1000, -1); c.advance(clockState(0)); c.frame();
  c.record('a', .1, 4, 1000, 1000, -1); c.advance(clockState(.1));
  c.advance(clockState(.25)); assert.equal(c.frame()[0].gain, true, '0.4% sustains an existing signal');
  c.record('a', .25, .001, 0, 1000, 1); c.advance(clockState(.25));
  assert.equal(c.frame()[0].loss, false, 'capacity floor rejects insignificant depleted-stock noise');
  c.record('a', .25, .1, 0, 1000, 1); c.advance(clockState(.25));
  assert.equal(c.frame()[0].loss, true);
  const large = new EnergyActivityCollector();
  large.record('a', 0, 50, 100000, 100000, -1); large.advance(clockState(0));
  assert.equal(large.frame()[0].gain, false);
  const small = new EnergyActivityCollector();
  small.record('a', 0, 50, 1000, 1000, -1); small.advance(clockState(0));
  assert.equal(small.frame()[0].gain, true);
});

test('accelerated batches retain crossed intervals exactly once without queuing event pulses', () => {
  const c = new EnergyActivityCollector();
  c.record('a', 0, 6, 1000, 1000, -1); c.record('a', 0, 6, 1000, 1000, 2);
  c.advance(clockState(0)); c.advance(clockState(1));
  const f = c.frame()[0]; assert.equal(f.gain, false); assert.equal(f.gainSeen, true);
  assert.deepEqual(f.parts, []); assert.deepEqual(f.seenParts, [2]);
  assert.equal(c.frame()[0].gainSeen, false);
  const p = new EnergyActivityPresentation(); p.accept([f]); p.setPaused(false, 0);
  p.advance(0, false, living); p.advance(50, false, living);
  assert.ok(p.intensity('a', 2).some(x => x > 0));
  p.advance(101, false, living); assert.deepEqual(p.intensity('a', 2), [0, 0]);
  c.advance(clockState(2)); assert.deepEqual(c.frame(), []);
});

test('continuous cadence, concurrent nonoverlapping half-cycle phases, localization, pause and resume', () => {
  const p = new EnergyActivityPresentation(); p.setPaused(false, 0); p.accept(row(true, true));
  p.advance(0, false, living);
  assert.deepEqual(p.intensity('a', 1), [.025, .28]);
  assert.deepEqual(p.intensity('a', 0), [.025, 0]);
  p.advance(200, false, living); assert.deepEqual(p.intensity('a', 0), [.24, 0]);
  const before = p.intensity('a', 1), phase = p.phaseMs;
  p.setPaused(true, 200); p.advance(10000, true, living);
  assert.deepEqual(p.intensity('a', 1), before); assert.equal(p.phaseMs, phase);
  p.accept(row(false, false)); p.advance(11000, true, living);
  assert.deepEqual(p.intensity('a', 1), before, 'decay is frozen too');
  p.setPaused(false, 11000); p.advance(11050, false, living);
  assert.ok(p.intensity('a', 0)[0] > 0); p.advance(11100, false, living);
  assert.deepEqual(p.intensity('a', 0), [0, 0]);
  for (const speed of [1, 2, 5, 10, 20, 'max']) {
    p.clear(); p.setPaused(false, 0);
    for (let t = 0; t <= 800; t += 20) {
      // Event frequency and playback speed cannot reset the shared phase.
      p.accept(row(true, true)); p.advance(t, false, living);
      assert.equal(p.phaseMs, t % ENERGY_CYCLE_MS, String(speed));
      const [g, r] = p.intensity('a', 1); assert.ok(Math.min(g, r) <= .025);
    }
  }
  p.advance(820, false, []); assert.deepEqual(p.intensity('a', 1), [0, 0]);
  p.clear(); assert.equal(p.phaseMs, 0);
});

test('actual feeding receipts cover nutrient, carrion, egg and prey; ordinary costs never emit red', () => {
  for (const source of ['nutrient', 'carrion', 'egg', 'prey'] as const) {
    const {state, config, hunter, prey} = mouthContactFixture('capsule-v1', 'head-on');
    hunter.genome.mouths[0].mouthType = 'omnivore'; hunter.genome.mouths[0].intakeWidth = 8;
    if (source !== 'prey') state.organisms = [hunter];
    const anchor = {x: 1220, y: 750};
    if (source === 'egg') state.eggs.push({id: 'egg', clutchId: 'c', parentOrgId: 'foreign', ...anchor,
      vx: 0, vy: 0, genome: structuredClone(prey.genome), fundedReserve: 3000, fundedStructural: 100,
      incubationProgress: 0, totalIncubationTime: 100, pulseTimer: 0, colorHue: 40, readyToHatch: false});
    else if (source !== 'prey') state.nutrients.push({id: 'meal', ...anchor, vx: 0, vy: 0,
      energyValue: 3000, radius: 18, bottomTimer: 0, pulseTimer: 0, kind: source,
      ...(source === 'carrion' ? {decayTimeRemaining: 100} : {})});
    const receipts: Array<{id: string; amount: number; part: number}> = [];
    stepSimulation(state, config, 1 / 60, undefined, undefined,
      (id, _time, amount, _stock, _capacity, part) => receipts.push({id, amount, part}));
    assert.ok(receipts.some(r => r.id === hunter.id && r.part === -1 && r.amount > 0), source);
    assert.equal(receipts.some(r => r.part >= 0), source === 'prey', source);
    assert.equal(receipts.filter(r => r.part < 0).reduce((sum, r) => sum + r.amount, 0),
      hunter.recentFeedings!.reduce((sum, r) => sum + r.energyTransferred, 0));
    if (source === 'prey') assert.equal(receipts.find(r => r.part >= 0)!.part, 0);
  }
  const {state, config, hunter} = mouthContactFixture('capsule-v1', 'head-on');
  state.organisms = [hunter]; hunter.genome.mouths = [];
  hunter.age = 100; hunter.energy = hunter.genome.maxEnergyCapacity;
  const c = new EnergyActivityCollector();
  for (let i = 0; i < 30; i++) {
    stepSimulation(state, config, 1 / 60, undefined, undefined, c.record); c.advance(state);
  }
  assert.deepEqual(c.frame(), [], 'metabolism, sensing, movement and any funded reproduction emit no red');
});

test('primitive receipts localize multiple mouths without changing optical, neural, physics, save or PRNG state', () => {
  const {state, config, hunter, prey} = mouthContactFixture('capsule-v1', 'head-on');
  const g = createReferenceNematodeGenome(new XoshiroPRNG(31));
  g.motorForce = 0;
  const witness = addExternalOrganism(state, g, config, 1160, 750, 0)!;
  // A second articulated prey segment is contacted by a second mouth; no new contact search.
  Object.assign(prey.genome.parts[0], {height: 21, dimM: 3});
  prey.genome.parts.push({...prey.genome.parts[0], id: 'second', parentIndex: 0, attachmentPoint: 'SOUTH'});
  prey.segments.push({...prey.segments[0], y: 771});
  // Forward mouths keep their existing reach and diet's fixed diameter.
  // The second mouth is separated by its anatomical anchor, not a width gene.
  hunter.genome.mouths[0].intakeWidth = 9;
  hunter.genome.parts.push({...hunter.genome.parts[0], id: 'second', parentIndex: 0, attachmentPoint: 'SOUTH'});
  hunter.segments.push({...hunter.segments[0], y: 771});
  hunter.genome.mouths.push({...hunter.genome.mouths[0], id: 'second-mouth', partIndex: 1});
  for (const org of [hunter, prey]) {
    org.genome.bodyCost = calculateBodyCost(org.genome.parts, org.genome.eyes, org.genome.mouths);
    org.genome.maxEnergyCapacity = calculateMaxEnergyCapacity(org.genome.parts, org.genome.storageTraitMultiplier);
    remapBrain(org.genome);
    const fresh = spawnOrganism(org.genome, org.segments[0].x, org.segments[0].y, 0, undefined, undefined, new XoshiroPRNG(3));
    Object.assign(org, fresh, {id: org.id});
  }
  const source = createSnapshot(state, config), direct = restoreSnapshot(source).state;
  const host = new SimulationHost(); host.reset(source, 4);
  const presentation = new EnergyActivityPresentation(); presentation.setPaused(false, 0);
  const parts = new Set<number>(); let active = false;
  for (let i = 0; i < 15; i++) {
    host.tick(); stepSimulation(direct, config, 1 / 60);
    const frame = host.frame(); presentation.accept(frame.energyActivity);
    presentation.advance(i * 17, false, host.state.organisms);
    for (const row of frame.energyActivity) if (row.id === prey.id) {
      row.parts.forEach(p => parts.add(p)); active ||= row.loss;
    }
    assert.deepEqual(host.snapshot().state, createSnapshot(direct, config).state,
      'exact full optical RGB/rays/brain/learning/physics/energy/genetics/PRNG continuation');
  }
  assert.ok(host.state.organisms.find(o => o.id === witness.id)!.rayHits.length > 0);
  assert.ok(active); assert.deepEqual([...parts].sort(), [0, 1]);
  const snapshot = host.snapshot();
  assert.ok(!JSON.stringify(snapshot).includes('gainSeen'));
  const roundTrip = restoreSnapshot(snapshot);
  assert.deepEqual(createSnapshot(roundTrip.state, roundTrip.settings).state, snapshot.state);
  host.reset(source, 5); assert.deepEqual(host.frame().energyActivity, []);
});

test('dead/replaced organisms clear transient activity; production host overhead is bounded observation', () => {
  const c = new EnergyActivityCollector(); c.record('a', 0, 10, 1000, 1000, -1);
  c.advance({simTime: 0, organisms: [{id: 'a', dissolving: true}]}); assert.deepEqual(c.frame(), []);
  const begin = performance.now();
  for (let tick = 1; tick <= 6000; tick++) {
    const time = tick / 60; c.record('a', time, 1, 1000, 1000, -1); c.advance(clockState(time));
    if (tick % 2 === 0) c.frame();
  }
  console.log(`Activity microcheck: 6000 single-organism ticks and 3000 frames: ${(performance.now() - begin).toFixed(2)} ms (not gameplay FPS)`);
  c.clear(); assert.deepEqual(c.frame(), []);
});


test('simultaneous actual gain/loss stays independent and funded egg laying emits no signal', () => {
  const {state, config, prey} = energyActivityFixture();
  const host = new SimulationHost(); host.reset(createSnapshot(state, config), 10);
  for (let i = 0; i < 10; i++) host.tick();
  const activity = host.frame().energyActivity.find(row => row.id === prey.id)!;
  assert.ok(activity.gain && activity.loss); assert.deepEqual(activity.parts, [0]);
  const g = createFounderGenome('FND-001', 'unbiased');
  g.eggReserveFraction = .35; g.targetClutchSize = 1; g.motorForce = 0;
  state.organisms = []; state.nutrients = []; state.simTime = 50;
  const parent = addExternalOrganism(state, g, config, 1200, 750, 0)!;
  parent.age = 40; parent.energy = evaluateReproductionAffordability(parent, 50, 1, 0).requiredForOneEgg + 100;
  const c = new EnergyActivityCollector();
  stepSimulation(state, config, 1 / 60, undefined, undefined, c.record); c.advance(state);
  assert.equal(state.eggs.length, 1); assert.deepEqual(c.frame(), []);
});


test('structural extraction is observed from real bites, while unsuccessful contact emits no loss', () => {
  const fixture = mouthContactFixture('capsule-v1', 'head-on');
  fixture.prey.energy = 0;
  // Existing reverse feeding order lets the real bite occur before starvation marking.
  fixture.state.organisms.reverse();
  const before = fixture.prey.structuralBiomass;
  const receipts: number[] = [];
  stepSimulation(fixture.state, fixture.config, 1 / 60, undefined, undefined,
    (id, _time, joules, _stock, _capacity, part) => {if (id === fixture.prey.id && part >= 0) receipts.push(joules);});
  assert.ok(receipts.length > 0);
  assert.equal(before - fixture.prey.structuralBiomass, receipts.reduce((a, b) => a + b, 0));
  const miss = mouthContactFixture('capsule-v1', 'head-on');
  miss.prey.segments[0].x += 100;
  const c = new EnergyActivityCollector();
  stepSimulation(miss.state, miss.config, 1 / 60, undefined, undefined, c.record); c.advance(miss.state);
  assert.deepEqual(c.frame(), []);
});

test('late in-flight metadata cannot start a new animation during pause', () => {
  const p = new EnergyActivityPresentation(); p.setPaused(true, 0);
  p.accept(row(true, true)); p.advance(300, true, living);
  assert.deepEqual(p.intensity('a', 1), [0, 0]); assert.equal(p.phaseMs, 0);
  p.setPaused(false, 300); p.advance(350, false, living);
  assert.ok(p.intensity('a', 1)[1] > 0);
});


test('green-only crossed intervals remain visible between peaks without a full-cycle hold', () => {
  const p = new EnergyActivityPresentation(); p.setPaused(false, 0);
  p.accept([{id: 'a', gain: false, gainSeen: true, loss: false, lossSeen: false, parts: [], seenParts: []}]);
  p.advance(1, false, living); assert.ok(p.intensity('a', 0)[0] > 0);
  p.advance(80, false, living); assert.ok(p.intensity('a', 0)[0] > 0);
  p.advance(101, false, living); assert.deepEqual(p.intensity('a', 0), [0, 0]);
});
