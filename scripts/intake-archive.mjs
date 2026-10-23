import {createHash} from 'node:crypto';import {openSync,writeFileSync,fsyncSync,closeSync,readFileSync} from 'node:fs';import {gzipSync,gunzipSync} from 'node:zlib';
export const root='docs/experiments/',prefix='nutrient-intake-v1';
export const hash=b=>createHash('sha256').update(b).digest('hex'),geneHash=g=>hash(JSON.stringify(g));
export const median=a=>{if(!a.length)return null;const s=[...a].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
/** Append-only paths, fsync, immediate receipt. No rewritten in-flight checkpoint. */
export function writeArchive(name,data){const path=root+name,bytes=name.endsWith('.gz')?gzipSync(JSON.stringify(data)+'\n',{level:9}):Buffer.from(JSON.stringify(data,null,2)+'\n'),fd=openSync(path,'wx');try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}const actual=readFileSync(path);if(!bytes.equals(actual))throw Error('Archive readback mismatch '+path);return{archive:name,bytes:bytes.length,sha256:hash(bytes)};}
export function readArchive(name){const b=readFileSync(root+name);return JSON.parse(name.endsWith('.gz')?gunzipSync(b):b);}
