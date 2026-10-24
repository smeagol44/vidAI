"""Sequential immutable checkpoint preservation; never rerun uncertain proposals."""
import pathlib,hashlib,json,zipfile,subprocess,sys,os
root=pathlib.Path.cwd(); data=root/'docs/experiments/uncapped-plasticity-v1'; dest=root.parent/'uncapped-plasticity-bundles';dest.mkdir(exist_ok=True)
def checkpoint(label,paths):
 zpath=dest/(label+'.zip');receipt=dest/(label+'-saved.json')
 if receipt.exists():
  r=json.loads(receipt.read_text());assert zpath.stat().st_size==r['bytes'] and hashlib.file_digest(zpath.open('rb'),'sha256').hexdigest()==r['sha256'];return
 assert not zpath.exists(),'uncertain previous upload, inspect before retry'
 entries=[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.file_digest(p.open('rb'),'sha256').hexdigest()} for p in sorted(set(paths))]
 with zipfile.ZipFile(zpath,'x',compression=zipfile.ZIP_STORED) as z:
  for p in sorted(set(paths)):z.write(p,p.relative_to(root))
  z.writestr('checkpoint-file-hashes.json',json.dumps(entries,indent=2))
 with zipfile.ZipFile(zpath) as z:assert z.testzip() is None
 size=zpath.stat().st_size;sha=hashlib.file_digest(zpath.open('rb'),'sha256').hexdigest()
 request={'uploads':[{'local_path':str(zpath),'purpose':'create_library_file','library_artifact_type':'other'}]}
 r=subprocess.run(['python3','/tmp/vida98-current-library/library_upload.py'],input=json.dumps(request),text=True,capture_output=True)
 (dest/(label+'-upload.json')).write_text(r.stdout)
 if r.returncode:print(r.stderr,file=sys.stderr);sys.exit(r.returncode)
 results=json.loads(r.stdout)['results'];assert len(results)==1 and results[0]['status']=='succeeded' and results[0]['local_metadata_applied'],results
 result={'label':label,'bytes':size,'sha256':sha,'file':zpath.name,'files':entries,'saved':results[0]}
 fd=os.open(receipt,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.write(fd,(json.dumps(result,indent=2)+'\n').encode());os.fsync(fd);os.close(fd)
 print(json.dumps({'durable':True,'label':label,'sha256':sha,'bytes':size,'library_file_id':results[0]['library_file_id']}),flush=True)
def run(args,label,paths_fn):
 receipt=dest/(label+'-saved.json')
 if receipt.exists():return
 log=dest/(label+'.log')
 assert not log.exists(),'prior unit may be uncertain; inspect raw packets and approve unknown gaps before resume'
 with log.open('x') as f:subprocess.run(['node','--import','tsx','scripts/run-uncapped-plasticity.mjs',*args],stdout=f,stderr=subprocess.STDOUT,check=True)
 print(log.read_text().splitlines()[-1],flush=True);checkpoint(label,paths_fn())
if sys.argv[1]=='frozen':
 checkpoint('vida98-frozen',[data/'frozen.json.gz',root/'docs/experiments/uncapped-plasticity-v1-protocol.md',root/'docs/experiments/uncapped-plasticity-v1-worker-check.json'])
else:
 assert (dest/'vida98-frozen-saved.json').exists()
 for c in ['off','mutable']:
  for s in [17,71,1901,4099,8191]:
   key=c+'-'+str(s)+'-initial'
   run(['initial',c,str(s)],'vida98-'+key,lambda c=c,s=s,key=key:[data/'initial'/f'{c}-{s}.json.gz',data/'packets'/(key+'.json.gz'),data/'requests'/(key+'.json.gz')])
  seeds=[17,71,1901,4099,8191]
  for g in range(1,16):
   order=[seeds[((g-1+k)%15)//3] for k in range(15) if ((g-1+k)%15)%3==1]
   for s in order:
    key=c+'-'+str(s)+'-g'+str(g).zfill(2)
    run(['generation',c,str(s),str(g)],'vida98-'+key,lambda key=key:[data/'inputs'/(key+'.json.gz'),data/'generations'/(key+'.json.gz')]+list((data/'packets').glob(key+'-*.json.gz'))+list((data/'requests').glob(key+'-*.json.gz')))
  run(['post',c],'vida98-'+c+'-post',lambda c=c:[data/(c+'-complete.json')]+list((data/'champions').glob(c+'-*.json.gz'))+list((data/'packets').glob(c+'-*-held-*.json.gz'))+list((data/'packets').glob(c+'-*-ablation-*.json.gz'))+list((data/'requests').glob(c+'-*-held-*.json.gz'))+list((data/'requests').glob(c+'-*-ablation-*.json.gz')))
 print('ALL2250_OFFSPRING_AND45_POST_TRAINING_COMPLETE',flush=True)

