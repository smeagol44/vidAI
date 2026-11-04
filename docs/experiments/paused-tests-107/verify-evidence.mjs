import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {legacyMouthState} from '../../../tests/support/legacy-mouth-state';

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const archive = (name) => JSON.parse(gunzipSync(readFileSync(new URL(name, import.meta.url))));
const current = archive('current-snapshots.json.gz');
const reference = archive('reference-snapshots.json.gz');
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hashes = {};
for (const name of Object.keys(reference)) {
  const projected = legacyMouthState(current[name].state);
  assert.deepEqual(projected, reference[name].state, `${name}: every non-mouth state field must be exact`);
  assert.equal(hash(projected), hash(reference[name].state), `${name}: property order must also retain the historical hash`);
  hashes[name] = hash(projected);
}
for (const scenario of ['hunter', 'learning']) {
  assert.deepEqual(read(`control-${scenario}.json`), read(`reference-${scenario}.json`), `${scenario}: geometry-only reversal must recover the reference exactly`);
}
const foraging = read('current-foraging.json');
const control = read('control-foraging.json');
assert.equal(foraging.length, 8);
for (const [i, rows] of foraging.entries()) {
  for (const row of rows) {
    assert.ok(row.valid && row.visibleTicks > 0);
    assert.equal(row.capTicks, 0);
    assert.ok(Math.abs(row.energyErrorJ) < 1e-5);
    assert.equal(row.absorbedJ, row.mouthContactTicks * 48, 'actual specialist assimilation per contact tick');
  }
  assert.equal(rows[0].absorbedJ, i === 7 ? 1440 : 2400);
  assert.ok(rows.slice(1).every(row => row.absorbedJ === 0));
  assert.equal(control[i][0].absorbedJ, 2400);
  assert.ok(control[i].slice(1).every(row => row.absorbedJ === 0));
}
const expanded = read('expanded-learning.json');
assert.equal(expanded.length, 8);
assert.deepEqual(expanded.map(row => row.netIntakeDifferenceJ), [720, 0, 0, 60, 540, 0, 0, 240]);
console.log(JSON.stringify({historicalStateHashes: hashes, nonMouthDifferences: 0,
  geometryControlExactlyRecovers: ['hunter', 'learning'], expandedLearning: {beneficial: 4, harmful: 0, tied: 4}}, null, 2));
