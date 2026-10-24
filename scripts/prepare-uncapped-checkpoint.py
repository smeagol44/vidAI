"""I/O adapter: reuse verified completed units; refuse unknown simulation requests."""
import pathlib,sys,subprocess,json,zipfile,hashlib
r=pathlib.Path.cwd()
if (r.parent/'pause98-before-next-unit').exists():raise SystemExit('SAFE_PAUSE_BEFORE_NEXT_UNIT; no simulation started')
d=r/'docs/experiments/uncapped-plasticity-v1';dest=r.parent/'uncapped-plasticity-bundles'
action,c,seed,g=sys.argv[1:5];label=sys.argv[5];paths=[]
if action=='frozen':paths=[d/'frozen.json.gz',r/'docs/experiments/uncapped-plasticity-v1-protocol.md',r/'docs/experiments/uncapped-plasticity-v1-worker-check.json']
else:
 key=c+'-'+seed+'-'+('initial' if action=='initial' else 'g'+g.zfill(2));complete=d/('initial/'+c+'-'+seed+'.json.gz' if action=='initial' else 'generations/'+key+'.json.gz' if action=='generation' else c+'-complete.json')
 if not complete.exists():
  log=dest/(label+'-git-driver.log')
  with log.open('x') as f:subprocess.run(['node','--import','tsx','scripts/run-uncapped-plasticity.mjs',action,c,seed,g],stdout=f,stderr=subprocess.STDOUT,check=True)
  print(log.read_text().splitlines()[-1],file=sys.stderr)
 if action=='initial':paths=[complete,d/'packets'/(key+'.json.gz'),d/'requests'/(key+'.json.gz')]
 elif action=='generation':paths=[complete,d/'inputs'/(key+'.json.gz')]+list((d/'packets').glob(key+'-*.json.gz'))+list((d/'requests').glob(key+'-*.json.gz'));assert len(paths)==32
 else:paths=[complete]+list((d/'champions').glob(c+'-*.json.gz'))+list((d/'packets').glob(c+'-*-held-*.json.gz'))+list((d/'packets').glob(c+'-*-ablation-*.json.gz'))+list((d/'requests').glob(c+'-*-held-*.json.gz'))+list((d/'requests').glob(c+'-*-ablation-*.json.gz'))
z=dest/(label+'.zip')
if not z.exists():
 entries=[{'path':str(p.relative_to(r)),'bytes':p.stat().st_size,'sha256':hashlib.file_digest(p.open('rb'),'sha256').hexdigest()} for p in sorted(set(paths))]
 with zipfile.ZipFile(z,'x',compression=zipfile.ZIP_STORED) as a:
  for p in sorted(set(paths)):a.write(p,p.relative_to(r))
  a.writestr('checkpoint-file-hashes.json',json.dumps(entries,indent=2))
with zipfile.ZipFile(z) as a:
 assert a.testzip() is None
 for e in json.loads(a.read('checkpoint-file-hashes.json')):
  b=(r/e['path']).read_bytes();assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256'];assert a.read(e['path'])==b
b=z.read_bytes();print(json.dumps({'path':str(z),'file':z.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gitSha':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),'label':label}))

