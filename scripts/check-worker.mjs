import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readdir} from 'node:fs/promises';
import {createInitialWorld} from '../world.ts';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot} from '../persistence.ts';

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
  assert.equal(paused.settings.physicsRegime, 'surface-work-v1');
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
  console.log('Production Worker: exact export, capped commands, independent stepping, pause, both physics regimes, regime-switch rejection and stale-world rejection passed.');
} finally { await worker.terminate(); }
