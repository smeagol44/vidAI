/** Repair ONLY a stale completed:false marker if it reproduces the ORIGINAL
 * runner manifest byte hash exactly. Never changes measurements or hashes. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root='docs/experiments/',hash=b=>createHash('sha256').update(b).digest('hex'),m=JSON.parse(readFileSync(root+'neural-selection-v1.json')),repairs=[];
assert.ok(m.completed);
for(const e of m.runs){const p=root+e.archive,b=readFileSync(p);if(hash(b)===e.sha256)continue;
 const d=JSON.parse(gunzipSync(b));assert.equal(d.completed,false);d.completed=true;
 const restored=gzipSync(JSON.stringify(d)+'\n',{level:9});assert.equal(hash(restored),e.sha256,'Anything besides completion marker differs; STOP');
 writeFileSync(p,restored);repairs.push({archive:e.archive,previousSha256:hash(b),restoredSha256:hash(restored),change:'completed:false -> true ONLY; original recorded runner SHA reproduced exactly'});
}
if(repairs.length)writeFileSync(root+'neural-selection-v1-finalization.json',JSON.stringify({measurementChanges:0,repairs},null,2)+'\n');
console.log(JSON.stringify({completionMarkersRestored:repairs.length,originalManifestHashesExact:true}));
