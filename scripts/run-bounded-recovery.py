"""I/O orchestrator only; each frozen Worker trial lives in the JS driver."""
import subprocess, pathlib, zipfile, hashlib, json, sys
root=pathlib.Path.cwd(); dest=root.parent/'recovery-bundles'; dest.mkdir(exist_ok=True)
seeds=[17,71,1901,4099,8191]
for g in range(13,16):
 for k in range(5):
  seed=seeds[(g-1+k)%5]
  log=dest/f'run-{seed}-g{g}.log'
  with log.open('x') as f:
   subprocess.run(['node','--import','tsx','scripts/resume-uncapped-revised.mjs',str(seed),str(g)],stdout=f,stderr=subprocess.STDOUT,check=True)
  print(log.read_text().splitlines()[-1],flush=True)
  paths=sorted((root/'docs/experiments/uncapped-revised-v1-recovery').glob(f'packets/{seed}-g{g:02d}-*.json.gz'))
  paths+=sorted((root/'docs/experiments/uncapped-revised-v1-recovery').glob(f'requests/{seed}-g{g:02d}-*.json'))
  paths+=[root/f'docs/experiments/uncapped-revised-v1-recovery/generations/{seed}-g{g}.json.gz']
  paths+=[root/'scripts/resume-uncapped-revised.mjs',root/'scripts/recover-uncapped-revised.mjs',root/'scripts/run-bounded-recovery.py']
  zpath=dest/f'vida96-recovery-{seed}-g{g}.zip'
  with zipfile.ZipFile(zpath,'x',compression=zipfile.ZIP_STORED) as z:
   for p in paths:z.write(p,p.relative_to(root))
  sha=hashlib.file_digest(zpath.open('rb'),'sha256').hexdigest()
  req={'uploads':[{'local_path':str(zpath),'purpose':'create_library_file','library_artifact_type':'other'}]}
  r=subprocess.run(['python3','/tmp/vida96-current-library/library_upload.py'],input=json.dumps(req),text=True,capture_output=True)
  (dest/f'upload-{seed}-g{g}.json').write_text(r.stdout)
  if r.returncode: print(r.stderr,file=sys.stderr);sys.exit(r.returncode)
  result=json.loads(r.stdout); assert all(x['status']=='succeeded' and x['local_metadata_applied'] for x in result['results']),result
  receipt={'seed':seed,'generation':g,'file':zpath.name,'bytes':zpath.stat().st_size,'sha256':sha,'saved':result['results']}
  (dest/f'saved-{seed}-g{g}.json').write_text(json.dumps(receipt,indent=2))
  print(json.dumps({'durableCheckpoint':True,**receipt}),flush=True)
print('ORIGINAL_TRAINING_BUDGET_COMPLETE',flush=True)

