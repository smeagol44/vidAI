import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWindowDemo, demoHandDirection, suspendedDemoAgreements, windowDemoReducer as reduce,
  windowDemoState as state, type WindowDemo, type DemoSide, visibleWindowState, physicalSelfTubes} from '../windowDemo';

function connect(side: DemoSide = 'L') {
  let demo = reduce(createWindowDemo(), {type: 'name', name: 'Hernan'});
  demo = reduce(demo, {type: 'call', side});
  return reduce(demo, {type: 'answer', side: side === 'L' ? 'R' : 'L', accept: true});
}
function accept(demo: WindowDemo, index: number) {
  demo = reduce(demo, {type: 'window', side: 'L', index, count: 5});
  return reduce(demo, {type: 'window', side: 'R', index, count: 5});
}

test('local name is bounded, editable, session-only and availability starts only after explicit entry', () => {
  const initial = createWindowDemo();
  assert.deepEqual(initial.available, {L: false, R: false});
  assert.equal(reduce(initial, {type: 'call', side: 'L'}), initial);
  assert.equal(reduce(initial, {type: 'name', name: '  \n '}), initial);
  let demo = reduce(initial, {type: 'name', name: '  H<ernan>\n '});
  assert.equal(demo.name, 'H<ernan>'); assert.deepEqual(demo.available, {L: true, R: true});
  demo = reduce(demo, {type: 'availability', side: 'L'});
  assert.deepEqual(demo.available, {L: false, R: true});
  demo = reduce(demo, {type: 'name', name: 'New name'});
  assert.deepEqual(demo.available, {L: false, R: true});
  assert.equal(reduce(demo, {type: 'name', name: '🙂'.repeat(50)}).name.length, 64);
  assert.deepEqual(initial, createWindowDemo(), 'no mutation or implicit storage');
});

test('self-call routes to the opposite phone; only explicit receiver acceptance connects', () => {
  for (const from of ['L', 'R'] as const) {
    const to = from === 'L' ? 'R' : 'L';
    let demo = reduce(createWindowDemo(), {type: 'name', name: 'Local'});
    demo = reduce(demo, {type: 'call', side: from});
    assert.deepEqual(demo.call, {from, status: 'pending'});
    assert.equal(reduce(demo, {type: 'answer', side: from, accept: true}), demo);
    assert.equal(reduce(demo, {type: 'call', side: to}), demo, 'no overlapping call');
    assert.equal(reduce(demo, {type: 'window', side: from, index: 0, count: 5}), demo);
    demo = reduce(demo, {type: 'answer', side: to, accept: true});
    assert.equal(demo.call?.status, 'connected');
    assert.deepEqual(demo.windows, {L: {}, R: {}}, 'answering the phone opens no windows');
  }
});

test('pending calls can be declined/canceled; availability off clears a pending call and blocks new calls', () => {
  const named = reduce(createWindowDemo(), {type: 'name', name: 'Local'});
  const pending = reduce(named, {type: 'call', side: 'L'});
  assert.equal(reduce(pending, {type: 'cancel-call', side: 'R'}), pending);
  assert.equal(reduce(pending, {type: 'cancel-call', side: 'L'}).call, null);
  assert.equal(reduce(pending, {type: 'answer', side: 'R', accept: false}).call, null);
  const off = reduce(pending, {type: 'availability', side: 'R'});
  assert.equal(off.call, null); assert.equal(off.available.R, false);
  assert.equal(reduce(off, {type: 'call', side: 'L'}), off);
});

test('window offers need the opposite consent; outgoing clicks cancel, incoming clicks accept, rejection is explicit', () => {
  const initial = connect();
  let demo = reduce(initial, {type: 'window', side: 'L', index: 2, count: 5});
  assert.equal(state(demo, 'L', 2), 'outgoing'); assert.equal(state(demo, 'R', 2), 'incoming');
  assert.equal(state(reduce(demo, {type: 'window', side: 'L', index: 2, count: 5}), 'L', 2), 'closed');
  assert.equal(reduce(demo, {type: 'reject', side: 'L', index: 2}), demo);
  demo = reduce(demo, {type: 'reject', side: 'R', index: 2});
  assert.equal(state(demo, 'L', 2), 'rejected'); assert.equal(state(demo, 'R', 2), 'rejected');
  demo = reduce(demo, {type: 'window', side: 'R', index: 2, count: 5});
  demo = reduce(demo, {type: 'window', side: 'L', index: 2, count: 5});
  assert.equal(state(demo, 'L', 2), 'accepted'); assert.equal(state(demo, 'R', 2), 'accepted');
  demo = reduce(demo, {type: 'window', side: 'L', index: 2, count: 5});
  assert.equal(state(demo, 'R', 2), 'closed'); assert.deepEqual(initial.windows, {L: {}, R: {}});
  assert.equal(reduce(demo, {type: 'window', side: 'L', index: 6, count: 5}), demo);
});

test('extended/rejecting hands point outward; incoming hands point inward', () => {
  assert.equal(demoHandDirection('L', 'outgoing'), 'left'); assert.equal(demoHandDirection('R', 'outgoing'), 'right');
  assert.equal(demoHandDirection('L', 'incoming'), 'right'); assert.equal(demoHandDirection('R', 'incoming'), 'left');
  assert.equal(demoHandDirection('L', 'rejected'), 'left'); assert.equal(demoHandDirection('R', 'rejected'), 'right');
});

test('height loss and disconnection suspend agreements; availability and renaming never cancel them', () => {
  let demo = accept(connect(), 4);
  assert.deepEqual(suspendedDemoAgreements(demo, 'L', 5), []);
  assert.deepEqual(suspendedDemoAgreements(demo, 'L', 2), [4]);
  assert.deepEqual(suspendedDemoAgreements(demo, 'L', 5), []);
  demo = reduce(demo, {type: 'availability', side: 'L'});
  demo = reduce(demo, {type: 'name', name: 'Renamed'});
  assert.equal(demo.call?.status, 'connected'); assert.equal(state(demo, 'L', 4), 'accepted');
  demo = reduce(demo, {type: 'disconnect', side: 'L'});
  assert.deepEqual(suspendedDemoAgreements(demo, 'L', 5), [4]);
  demo = reduce(demo, {type: 'availability', side: 'L'});
  demo = reduce(demo, {type: 'call', side: 'R'});
  demo = reduce(demo, {type: 'answer', side: 'L', accept: true});
  assert.deepEqual(suspendedDemoAgreements(demo, 'L', 5), []);
  demo = reduce(demo, {type: 'clear', side: 'L', index: 4});
  assert.equal(state(demo, 'L', 4), 'closed'); assert.equal(state(demo, 'R', 4), 'closed');
  assert.deepEqual(reduce(demo, {type: 'reset'}), createWindowDemo());
});


test('lost signal replaces visible handshakes; retained agreements remain authoritative and hydratable', () => {
  let demo = accept(connect(), 0);
  assert.equal(visibleWindowState(demo, 'L', 0), 'accepted');
  demo = reduce(demo, {type: 'disconnect', side: 'R'});
  assert.equal(visibleWindowState(demo, 'L', 0), 'suspended');
  assert.equal(visibleWindowState(demo, 'R', 0), 'suspended');
  assert.deepEqual(physicalSelfTubes(demo), {version: 1, connected: false, accepted: [0]});
  const restored = reduce(createWindowDemo(), {type: 'hydrate', topology: {version: 1, connected: true, accepted: [0, 4]}});
  assert.equal(visibleWindowState(restored, 'L', 0), 'accepted');
  assert.deepEqual(physicalSelfTubes(restored).accepted, [0, 4]);
  assert.equal(reduce(restored, {type: 'hydrate'}).call, null);
});
