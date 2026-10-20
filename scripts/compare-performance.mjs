import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [before, after] = await Promise.all(process.argv.slice(2, 4).map(async path =>
  JSON.parse(await readFile(path, 'utf8'))));
assert.equal(before.length, after.length);
for (let i = 0; i < before.length; i++) {
  assert.equal(after[i].scenario, before[i].scenario);
  assert.equal(after[i].stateHash, before[i].stateHash, 'Complete continuation must match the baseline');
  console.log(JSON.stringify({scenario: after[i].scenario, baselineMs: before[i].milliseconds,
    candidateMs: after[i].milliseconds, throughputRatio: +(before[i].milliseconds / after[i].milliseconds).toFixed(2),
    exactStateMatch: true}));
}
