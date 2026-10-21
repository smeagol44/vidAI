import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readdir} from 'node:fs/promises';
import {createInitialWorld} from '../world.ts';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot} from '../persistence.ts';
import {enableClosedEconomy, setWorldEnergy} from '../energyEconomy.ts';
import {totalAccountedEnergy} from '../persistence.ts';
import {mouthContactFixture} from '../mouthContactAudit.ts';
import {stepSimulation} from '../simulation.ts';

// Exercise the actual production-built Worker with real cross-thread cloning.
// Only the browser's message port is adapted to node:worker_threads.
const asset = (await readdir(new URL('../dist/assets/', import.meta.url)))
  .find(name => /^simulation\.worker-.*\.js$/.test(name));
assert.ok(asset, 'Run npm run build first');
const bundle = new URL(`../dist/assets/${asset}`, import.meta.url).href;
const boot = `import {parentPort} from 'node:worker_threads';
globalThis.self = {postMessage: value => parentPort.postMessage(value)};
parentPort.on('message', data => self.onmessage({data}));
await import(${JSON.stringify(bundle)}); parentPort.postMessage({type:'ready'});`;
const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(boot)}`));
let requests = 0;
const queued = [], waiting = [];
worker.on('message', value => {
  const index = waiting.findIndex(entry => entry.predicate(value));
  if (index >= 0) {const [entry] = waiting.splice(index, 1); clearTimeout(entry.timer); entry.resolve(value);}
  else queued.push(value);
});
const receive = predicate => {
  const index = queued.findIndex(predicate);
  if (index >= 0) return Promise.resolve(queued.splice(index, 1)[0]);
  return new Promise((resolve, reject) => {
    const entry = {predicate, resolve, timer: setTimeout(() => reject(new Error('Worker response timed out')), 10000)};
    waiting.push(entry);
  });
};
const send = message => worker.postMessage(message);
const request = async (type, extra = {}, epoch = 1) => {
  const id = ++requests; send({type, id, epoch, ...extra});
  const result = await receive(value => value.id === id);
  assert.notEqual(result.type, 'error', result.message);
  return result.value;
};
try {
  await receive(value => value.type === 'ready');
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 5, inflowRate: 0};
  const state = createInitialWorld({...settings, targetNutrients: 0}, 91, 'balanced', 'standard', 2);
  const source = createSnapshot(state, settings);
  send({type: 'reset', snapshot: source, epoch: 1});
  const frame = await receive(value => value.type === 'frame');
  assert.equal(frame.frame.epoch, 1);
  assert.deepEqual((await request('snapshot')).state, source.state);
  assert.equal(await request('action', {action: {kind: 'feed', count: 15, x: 800, y: 600}}), 5);
  const fed = await request('snapshot');
  assert.equal(fed.state.nutrients.length, 5);
  assert.equal(fed.state.ledger.externalInflow - source.state.ledger.externalInflow, 15000);
  send({type: 'ack', epoch: 1});
  send({type: 'control', epoch: 1, settings, speed: 1, selected: null, running: true});
  const end = performance.now() + 200;
  while (performance.now() < end) { /* main-thread stall must not stop the worker */ }
  send({type: 'control', epoch: 1, settings, speed: 1, selected: null, running: false});
  const paused = await request('snapshot');
  assert.ok(paused.state.simTime > .05, 'Simulation advanced independently during the main-thread stall');
  assert.deepEqual((await request('snapshot')).state, paused.state);
  assert.deepEqual(createSnapshot(restoreSnapshot(paused).state, settings), paused);
  send({type: 'reset', snapshot: source, epoch: 2});
  await receive(value => value.type === 'frame' && value.frame.epoch === 2);
  send({type: 'action', epoch: 1, id: -1, action: {kind: 'feed', count: 15, x: 800, y: 600}});
  assert.deepEqual((await request('snapshot', {}, 2)).state, source.state, 'Old-world commands cannot affect replacements');
  assert.equal(paused.settings.physicsRegime, 'paid-work-v2');
  const legacySource = structuredClone(source);
  legacySource.schemaVersion = '11.0.0'; delete legacySource.settings.physicsRegime;
  send({type: 'reset', snapshot: legacySource, epoch: 3});
  await receive(value => value.type === 'frame' && value.frame.epoch === 3);
  const oldSettings = {...settings}; delete oldSettings.physicsRegime;
  send({type: 'control', epoch: 3, settings: oldSettings, speed: 1, selected: null, running: false});
  assert.equal((await request('snapshot', {}, 3)).settings.physicsRegime, 'legacy-v0');
  send({type: 'control', epoch: 3, settings: oldSettings, speed: 1, selected: null, running: true});
  await new Promise(resolve => setTimeout(resolve, 100));
  send({type: 'control', epoch: 3, settings: oldSettings, speed: 1, selected: null, running: false});
  const oldPaused = await request('snapshot', {}, 3);
  assert.ok(oldPaused.state.simTime > .025);
  assert.ok(oldPaused.state.organisms.every(o => o.motorDiagnostics === undefined));
  send({type: 'control', epoch: 3, id: -77, settings, speed: 1, selected: null, running: true});
  const rejected = await receive(value => value.id === -77);
  assert.equal(rejected.type, 'error'); assert.match(rejected.message, /regime/);
  assert.equal((await request('snapshot', {}, 3)).settings.physicsRegime, 'legacy-v0');
  const closed = restoreSnapshot(fed).state;
  enableClosedEconomy(closed);
  const closedSettings = {...settings, ecologyRegime: 'closed-v1', nutrientLimit: null};
  const closedSource = createSnapshot(closed, closedSettings);
  send({type: 'reset', snapshot: closedSource, epoch: 4});
  await receive(value => value.type === 'frame' && value.frame.epoch === 4);
  assert.equal((await request('snapshot', {}, 4)).schemaVersion, '13.0.0');
  assert.equal(await request('action', {action: {kind: 'feed', count: 1, x: 800, y: 600}}, 4), 0);
  const raised = closed.energyPool.budget + 6000;
  await request('action', {action: {kind: 'energy-budget', joules: raised}}, 4);
  assert.equal(await request('action', {action: {kind: 'feed', count: 2, x: 800, y: 600}}, 4), 2);
  const ready = await request('snapshot', {}, 4);
  const direct = restoreSnapshot(ready).state;
  send({type: 'ack', epoch: 4});
  send({type: 'control', epoch: 4, settings: closedSettings, speed: 1, selected: null, running: true});
  await new Promise(resolve => setTimeout(resolve, 100));
  send({type: 'control', epoch: 4, settings: closedSettings, speed: 1, selected: null, running: false});
  const closedPaused = await request('snapshot', {}, 4);
  const ticks = Math.round((closedPaused.state.simTime - ready.state.simTime) * 60);
  assert.ok(ticks > 0);
  for (let i = 0; i < ticks; i++) stepSimulation(direct, closedSettings, 1 / 60);
  assert.deepEqual(closedPaused.state, createSnapshot(direct, closedSettings).state);
  await request('action', {action: {kind: 'energy-budget', joules: 0}}, 4);
  setWorldEnergy(direct, 0);
  assert.deepEqual((await request('snapshot', {}, 4)).state, createSnapshot(direct, closedSettings).state);
  assert.ok(Math.abs(totalAccountedEnergy(direct)) < 1e-5);
  send({type: 'control', epoch: 4, id: -78, settings, speed: 1, selected: null, running: false});
  assert.match((await receive(value => value.id === -78)).message, /Ecology regime/);
  let mouthEpoch = 10;
  for (const physicsRegime of ['legacy-v0', 'surface-work-v1', 'paid-work-v2']) for (const closed of [false, true]) {
    const probe = mouthContactFixture('capsule-v1'); probe.config.physicsRegime = physicsRegime;
    if (closed) {enableClosedEconomy(probe.state); probe.config.ecologyRegime = 'closed-v1'; probe.config.nutrientLimit = null;}
    const source = createSnapshot(probe.state, probe.config), epoch = mouthEpoch++;
    send({type: 'reset', epoch, snapshot: source});
    await receive(value => value.type === 'frame' && value.frame.epoch === epoch);
    const initial = await request('snapshot', {}, epoch);
    assert.equal(initial.schemaVersion, '14.0.0'); assert.deepEqual(initial, source);
    const direct = restoreSnapshot(initial).state;
    send({type: 'ack', epoch});
    send({type: 'control', epoch, settings: probe.config, speed: 1, selected: null, running: true});
    await new Promise(resolve => setTimeout(resolve, 80));
    send({type: 'control', epoch, settings: probe.config, speed: 1, selected: null, running: false});
    const after = await request('snapshot', {}, epoch);
    const ticks = Math.round(after.state.simTime * 60); assert.ok(ticks > 0);
    for (let i = 0; i < ticks; i++) stepSimulation(direct, probe.config, 1 / 60);
    assert.deepEqual(after.state, createSnapshot(direct, probe.config).state);
    assert.ok(after.state.organisms[0].recentFeedings.some(e => e.energyTransferred > 0));
    send({type: 'control', epoch, id: -100 - epoch, settings: {...probe.config, mouthContactModel: undefined}, speed: 1, running: false});
    assert.match((await receive(value => value.id === -100 - epoch)).message, /Mouth contact model/);
    assert.deepEqual((await request('snapshot', {}, epoch)).state, after.state);
  }
  console.log('Production Worker: open/closed exact exports, funded commands, independent stepping, debt, direct equivalence, all physics regimes, mouth contact in all six physics/ecology combinations, regime-switch and stale-world rejection passed.');
} finally { await worker.terminate(); }
