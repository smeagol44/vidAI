import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {mouthContactFixture} from '../mouthContactAudit';
import {capsuleContactsPart, mouthDimensions} from '../mouthGeometry';
import {createFounderGenome} from '../founders';
import {DEFAULT_SETTINGS, BUILD_VERSION, createSnapshot, restoreSnapshot, totalAccountedEnergy} from '../persistence';
import {enableClosedEconomy} from '../energyEconomy';
import {stepSimulation, mouthApertureContactsPart} from '../simulation';
import {SimulationHost} from '../simulationHost';

test('rounded mouth aperture covers endpoints and rotated prey, without square-corner false positives', () => {
  for (const angle of [0, .37, Math.PI / 2, -1.3]) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const rotate = (x: number, y: number) => ({x: 1200 + c * x - s * y, y: 750 + s * x + c * y});
    const a = rotate(-10, 0), b = rotate(10, 0), centre = rotate(0, 0);
    for (const [x, y, expected] of [[14.5, 6, true], [18 - 1e-6, 0, true], [18 + 1e-6, 0, false],
      [17, 7, false], [0, 0, true], [0, 8 + 1e-6, false]] as const) {
      const p = {...rotate(x, y), angle, vx: 0, vy: 0, angVel: 0};
      assert.equal(capsuleContactsPart(a.x, a.y, b.x, b.y, 4.5, p, {width: 7, height: 7}), expected);
      if (x === 14.5) assert.equal(mouthApertureContactsPart(centre.x, centre.y,
        a.x, a.y, b.x, b.y, 4.5, p, {...createFounderGenome('FND-001').parts[0], width: 7, height: 7}), false, 'historical endpoint miss is retained');
    }
  }
  for (const angle of [.2, -.7, 1.4]) for (const [dx, dy, expected] of [[1, 2.5, true], [4, 4, false]] as const) {
    const c = Math.cos(angle), sn = Math.sin(angle);
    const p = {x: c * (3.5 + dx) - sn * (3.5 + dy), y: sn * (3.5 + dx) + c * (3.5 + dy),
      angle, vx: 0, vy: 0, angVel: 0};
    assert.equal(capsuleContactsPart(0, 0, 0, 0, 4.5, p, {width: 7, height: 7}), expected,
      'independent prey rotation preserves rounded-corner distance');
  }
  const p = {x: 0, y: 0, angle: 0, vx: 0, vy: 0, angVel: 0}, def = {width: 7, height: 7};
  assert.equal(capsuleContactsPart(-100, 0, 100, 0, 0, p, def), true, 'long crossing');
  assert.equal(capsuleContactsPart(-10, 3.5, 10, 3.5, 0, p, def), true, 'collinear tangent');
  assert.equal(capsuleContactsPart(8, 0, 8, 0, 4.5, p, def), true, 'degenerate capsule is a disk');
  assert.equal(capsuleContactsPart(8 + 1e-6, 0, 8 + 1e-6, 0, 4.5, p, def), false);
});

test('real endpoint feeding transfers funded energy; head-on contact and clear misses are unchanged', () => {
  for (const encounter of ['endpoint', 'head-on', 'overlap', 'far']) for (const closed of [false, true]) {
    for (const model of [undefined, 'capsule-v1'] as const) {
      const {state, config, hunter} = mouthContactFixture(model, encounter);
      if (closed) {enableClosedEconomy(state); config.ecologyRegime = 'closed-v1'; config.nutrientLimit = null;}
      const before = totalAccountedEnergy(state);
      stepSimulation(state, config, 1 / 60);
      const intake = hunter.recentFeedings?.reduce((sum, e) => sum + e.energyTransferred, 0) ?? 0;
      assert.equal(intake, encounter === 'head-on' || encounter === 'overlap' || (encounter === 'endpoint' && model) ? 48 : 0);
      assert.ok(Math.abs(totalAccountedEnergy(state) - before) < 1e-8);
    }
  }
});

test('new contact snapshots preserve each physics/ecology mode and Worker-host continuation', () => {
  for (const physicsRegime of ['legacy-v0', 'surface-work-v1', 'paid-work-v2'] as const) for (const closed of [false, true]) {
    const {state, config} = mouthContactFixture('capsule-v1'); config.physicsRegime = physicsRegime;
    if (closed) {enableClosedEconomy(state); config.ecologyRegime = 'closed-v1'; config.nutrientLimit = null;}
    const snapshot = createSnapshot(state, config), restored = restoreSnapshot(snapshot);
    assert.equal(snapshot.schemaVersion, '14.0.0'); assert.deepEqual(createSnapshot(restored.state, restored.settings), snapshot);
    const host = new SimulationHost(); host.reset(snapshot, 91);
    for (let i = 0; i < 6; i++) {host.tick(); stepSimulation(restored.state, restored.settings, 1 / 60);}
    assert.deepEqual(host.snapshot().state, createSnapshot(restored.state, restored.settings).state);
  }
});

test('old saves keep original contact and schema; malformed contact models cannot be smuggled in', () => {
  for (const closed of [false, true]) {
    const {state, config} = mouthContactFixture();
    if (closed) {enableClosedEconomy(state); config.ecologyRegime = 'closed-v1'; config.nutrientLimit = null;}
    const old = createSnapshot(state, config);
    assert.equal(old.schemaVersion, closed ? '13.0.0' : '12.0.0');
    const restored = restoreSnapshot(old); assert.equal(restored.settings.mouthContactModel, undefined);
    for (const model of ['capsule-v1', 'unknown', null]) {
      const invalid = structuredClone(old); Object.assign(invalid.settings, {mouthContactModel: model});
      assert.throws(() => restoreSnapshot(invalid), /mouth contact model/);
    }
    const invalid = structuredClone(old); invalid.schemaVersion = '14.0.0';
    assert.throws(() => restoreSnapshot(invalid), /mouth contact model/);
  }
});

test('mouth width stays inherited and the visible build version matches the package release', () => {
  assert.deepEqual(mouthDimensions({mouthType: 'carnivore', intakeWidth: 20}), {radius: 4.5, halfSpan: 10});
  assert.equal(BUILD_VERSION, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
});
