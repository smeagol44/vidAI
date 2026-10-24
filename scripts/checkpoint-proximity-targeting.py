"""I/O only: immutable full-unit ZIP; refuse ambiguous execution history."""
from pathlib import Path
import sys,subprocess,zipfile,json,hashlib,os
r=Path.cwd();d=r/'docs/experiments/proximity-targeting-v1';dest=r.parent/'proximity-targeting-bundles';dest.mkdir(exist_ok=True)
a,c,s,g,label=sys.argv[1:6]
if a=='frozen':paths=[d/'frozen.json.gz',r/'docs/experiments/proximity-targeting-v1-protocol.md',r/'docs/experiments/proximity-targeting-v1-owner-request.md',r/'docs/experiments/proximity-targeting-v1-worker-check.json']
else:
 key=c+'-'+s+'-'+('initial'if a=='initial'else'g'+g.zfill(2));complete=d/('initial/'+c+'-'+s+'.json.gz'if a=='initial'else'generations/'+key+'.json.gz'if a=='generation'else'complete.json')
 if not complete.exists():
  with (dest/(label+'-run.log')).open('x')as log:subprocess.run(['node','--import','tsx','scripts/run-proximity-targeting.mjs',a,c,s,g],stdout=log,stderr=subprocess.STDOUT,check=True)
  print((dest/(label+'-run.log')).read_text().splitlines()[-1],file=sys.stderr)
 if a=='initial':paths=[complete,d/'packets'/(key+'.json.gz'),d/'requests'/(key+'.json.gz')]
 elif a=='generation':paths=[complete,d/'inputs'/(key+'.json.gz')]+list((d/'packets').glob(key+'-*.gz'))+list((d/'requests').glob(key+'-*.gz'));assert len(paths)==22
 else:paths=[complete]+list((d/'champions').glob('*.gz'))+list((d/'packets').glob('*-held-*.gz'))+list((d/'requests').glob('*-held-*.gz'));assert len(paths)==36
z=dest/(label+'.zip')
if not z.exists():
 entries=[{'path':str(p.relative_to(r)),'bytes':p.stat().st_size,'sha256':hashlib.file_digest(p.open('rb'),'sha256').hexdigest()}for p in sorted(set(paths))]
 with zipfile.ZipFile(z,'x',compression=zipfile.ZIP_STORED)as out:
  for p in sorted(set(paths)):out.write(p,p.relative_to(r))
  out.writestr('checkpoint-file-hashes.json',json.dumps(entries,indent=2))
 with z.open('rb')as f:os.fsync(f.fileno())
with zipfile.ZipFile(z)as saved:
 assert saved.testzip()is None
 for e in json.loads(saved.read('checkpoint-file-hashes.json')):
  b=(r/e['path']).read_bytes();assert len(b)==e['bytes']and hashlib.sha256(b).hexdigest()==e['sha256'];assert saved.read(e['path'])==b
b=z.read_bytes();print(json.dumps({'path':str(z),'file':z.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gitSha':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),'label':label}))
