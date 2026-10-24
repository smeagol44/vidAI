import assert from 'node:assert/strict';
import {readFileSync,openSync,writeFileSync,fsyncSync,closeSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
export {hash,geneHash,median} from './intake-archive.mjs';import {hash} from './intake-archive.mjs';
export const root='docs/experiments/uncapped-plasticity-v1/';
export const read=p=>JSON.parse(p.endsWith('.gz')?gunzipSync(readFileSync(p)):readFileSync(p));
export function save(path,value){mkdirSync(path.slice(0,path.lastIndexOf('/')),{recursive:true});assert.ok(!existsSync(path),'refuse overwrite '+path);const bytes=path.endsWith('.gz')?gzipSync(JSON.stringify(value)+'\n',{level:9}):Buffer.from(JSON.stringify(value,null,2)+'\n'),tmp=path+'.tmp',fd=openSync(tmp,'wx');try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,path);const d=openSync(path.slice(0,path.lastIndexOf('/')),'r');fsyncSync(d);closeSync(d);assert.ok(readFileSync(path).equals(bytes));return{path,bytes:bytes.length,sha256:hash(bytes)};}
/** Lossless column-major IEEE754 binary packing; no float rounding or sampling. */
function packRows(rows,width){const bytes=Buffer.allocUnsafe(rows.length*width*8);for(let c=0;c<width;c++)for(let r=0;r<rows.length;r++)bytes.writeDoubleLE(rows[r][c],(c*rows.length+r)*8);return{encoding:'float64-le-columns-v1',rows:rows.length,width,data:bytes.toString('base64')};}
function unpackRows(p){const b=Buffer.from(p.data,'base64');if(b.length!==p.rows*p.width*8)throw Error('Corrupt packed receipt');return Array.from({length:p.rows},(_,r)=>Array.from({length:p.width},(_,c)=>b.readDoubleLE((c*p.rows+r)*8)));}
export function packPacket(p){const u=p.uncappedAudit;return{...p,uncappedAudit:{...u,learning:packRows(u.learning,5),ticks:packRows(u.ticks,u.tickColumns.length)}};}
export function unpackPacket(p){const u=p.uncappedAudit;return{...p,uncappedAudit:{...u,learning:unpackRows(u.learning),ticks:unpackRows(u.ticks)}};}
