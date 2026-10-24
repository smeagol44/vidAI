"""Export all520 complete trajectories from preserved packets; zero simulation."""
from pathlib import Path
import gzip,json,hashlib,zipfile,os,csv
r=Path('docs/experiments/proximity-targeting-v1');dest=r/'trajectory-exports';dest.mkdir(exist_ok=True);bundles=Path('../proximity-trajectory-bundles');bundles.mkdir(exist_ok=True);index=[];metadata=[]
for c,seed in [('legacy',17),('mutable',17),('mutable',71),('mutable',1901),('mutable',4099)]:
 entries=[];label=f'100-trajectories-{c}-{seed}';zip_path=bundles/(label+'.zip')
 for path in sorted((r/'packets').glob(f'{c}-{seed}-*.json.gz')):
  row=json.loads(gzip.decompress(path.read_bytes()));req=json.loads(gzip.decompress((r/'requests'/(row['key']+'.json.gz')).read_bytes()));p=row['packet'];q=p['snapshot']['state']['pursuit'];a=p['snapshot']['state']['proximityFeeding'];o=req['source']['state']['organisms'][0];g=row['genome'];n=req['source']['state']['nutrients'][0]
  value={'key':row['key'],'controller':c,'brainSeed':seed,'role':row['role'],'environment':row['environment'],'genomeSha':row['genomeSha'],'partDefs':g['parts'],'mouths':g['mouths'],'eyes':g['eyes'],'initialSource':n,'initialBody':o['segments'],'targetColumns':['time_s','target_x','target_y','status_0moving_1paused_2frozen','heading','com_x','com_y','mouth_x','mouth_y','capsule_gap_px','eye0_x','eye0_y','eye1_x','eye1_y','nearest_eye_distance_px'],'targetTrajectory':q['trace'],'bodyColumns':['time_s']+[f'part{i}_{d["id"]}_{k}'for i,d in enumerate(g['parts'])for k in ['x','y','angle','vx','vy','angular_velocity']],'bodyTrajectory':a['bodyTrace'],'feeding':a['samples'],'tickEnergy':p['pursuitAudit']['ticks'],'rayDetections':p['pursuitAudit']['rays'],'decisions':q['decisions'],'events':q['events'],'modeTransitions':p['modeAudit']['transitions']}
  assert len(value['targetTrajectory'])==3600 and len(value['bodyTrajectory'])==3600 and len(value['feeding'])==900
  b=gzip.compress((json.dumps(value,separators=(',',':'))+'\n').encode(),compresslevel=9,mtime=0);out=dest/(row['key']+'.json.gz')
  if out.exists():assert out.read_bytes()==b
  else:
   with out.open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
  e={'path':str(out),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()};entries.append(e);index.append(dict(e,key=row['key'],controller=c,brain_seed=seed,role=row['role'],environment_seed=row['environment']['seed'],bundle_label=label))
 assert len(entries)==104
 if not zip_path.exists():
  tmp=zip_path.with_suffix('.building.zip')
  with zipfile.ZipFile(tmp,'w',compression=zipfile.ZIP_STORED)as z:
   for e in entries:z.write(e['path'],e['path'])
   z.writestr('checkpoint-file-hashes.json',json.dumps(entries,indent=2))
  with tmp.open('rb')as f:os.fsync(f.fileno())
  os.replace(tmp,zip_path)
 with zipfile.ZipFile(zip_path)as z:
  assert z.testzip()is None
  for e in entries:assert hashlib.sha256(z.read(e['path'])).hexdigest()==e['sha256']
 b=zip_path.read_bytes();m={'label':label,'kind':'derived-full-trajectory-export','path':str(zip_path.resolve()),'file':zip_path.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gitSha':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),'logicalTrials':104,'simulationEvaluations':0};metadata.append(m);print(json.dumps(m),flush=True)
assert len(index)==520
(r/'all-trajectories-index.json').write_text(json.dumps({'logicalTrials':520,'simulationEvaluations':0,'entries':index,'bundles':metadata},indent=2)+'\n')
with (r/'all-trajectories-index.csv').open('w')as f:
 w=csv.DictWriter(f,fieldnames=list(index[0]));w.writeheader();w.writerows(index)
