"""Verify/restore published original505 normalized trajectories; zero simulation."""
from pathlib import Path
import argparse,json,subprocess,hashlib,zipfile,io,os,re,gzip
p=argparse.ArgumentParser();p.add_argument('--ref');p.add_argument('--destination',default='.');p.add_argument('--verify-only',action='store_true');a=p.parse_args()
ref=a.ref or json.loads(Path('docs/experiments/proximity-targeting-v1/analysis-links.json').read_text())['analysisCommit']
assert re.fullmatch('[0-9a-f]{40}',ref),'Use an immutable40-digit commit SHA'
def read(path):return subprocess.check_output(['git','show',ref+':'+path])
catalog=json.loads(read('exports/trajectory-bundles.json'));assert catalog['verifiedTrials']==505 and catalog['heldOutUnresolved']==15
target=Path(a.destination).resolve();verified=0
for bundle in catalog['bundles']:
 data=bytearray()
 for part in bundle['parts']:
  v=read(part['path']);assert len(v)==part['bytes']and hashlib.sha256(v).hexdigest()==part['sha256'];data.extend(v)
 assert len(data)==bundle['bytes']and hashlib.sha256(data).hexdigest()==bundle['sha256']
 with zipfile.ZipFile(io.BytesIO(data))as z:
  assert z.testzip()is None
  entries=json.loads(z.read('checkpoint-file-hashes.json'));assert len(entries)==101
  for e in entries:
   v=z.read(e['path']);assert len(v)==e['bytes']and hashlib.sha256(v).hexdigest()==e['sha256']
   row=json.loads(gzip.decompress(v));assert len(row['targetTrajectory'])==3600 and len(row['bodyTrajectory'])==3600 and len(row['feeding'])==900 and len(row['rayDetections'])==900
   if not a.verify_only:
    out=(target/e['path']).resolve();assert out.is_relative_to(target)
    if out.exists():assert out.read_bytes()==v,'Existing file differs;refusing overwrite'
    else:
     out.parent.mkdir(parents=True,exist_ok=True);tmp=out.with_name(out.name+'.restoring')
     with tmp.open('xb')as f:f.write(v);f.flush();os.fsync(f.fileno())
     tmp.rename(out)
   verified+=1
 print(json.dumps({'bundle':bundle['label'],'trials':101,'partZIPMemberAndTrajectorySchemaVerified':True}),flush=True)
assert verified==505
print(json.dumps({'verifiedOriginalTrainingTrajectories':505,'bundles':5,'heldOutUnresolved':15,'simulationEvaluations':0,'writeFiles':not a.verify_only}))
