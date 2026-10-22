import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root = resolve(import.meta.dirname, '..');
test('testing release is derived from pinned main ancestor and is reproducible', () => {
  const manifest = JSON.parse(readFileSync(resolve(root,'testing-baseline.json'),'utf8'));
  const stdout=execFileSync(process.execPath, ['scripts/testing-build-info.mjs'], {cwd:root,encoding:'utf8'});
  const info=JSON.parse(stdout);
  assert.equal(info.mainVersion,manifest.mainVersion);
  assert.equal(info.mainCommit,manifest.mainCommit);
  assert.equal(info.cycle,manifest.cycle);
  assert.ok(info.iteration>=1);
  assert.equal(info.version,'T'+info.cycle+'.'+info.iteration);
  assert.match(info.label,/TESTING · main v[0-9]+[.][0-9]+[.][0-9]+ @ [a-f0-9]{7} · cycle [0-9]+ · iteration [0-9]+/);
});
