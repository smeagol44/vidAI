"""Independent download/hash/CRC/schema verification of15 published recovery packets; zero simulation."""
from pathlib import Path
import json,subprocess,hashlib,zipfile,io,gzip,argparse,os
p=argparse.ArgumentParser();p.add_argument('--verify-only',action='store_true');p.add_argument('--destination',default='.');a=p.parse_args()
base=Path('docs/experiments/proximity-targeting-v1');index=json.loads((base/'recovery/evidence-index.json').read_text());ref=index['evidenceHead'];target=Path(a.destination).resolve();count=0
def get(path):return subprocess.check_output(['git','show',ref+':'+path])
for e in index['checkpoints']:
 d=json.loads(get(e['descriptorPath']));assert d['possiblePriorExecution']and d['evaluationClass']=='recovery-evaluation'and d['logicalTrials']==1
 assert d=={k:v for k,v in e.items()if k not in ['descriptorPath','commit']}
 b=bytearray()
 for part in d['parts']:
  v=get(part['path']);assert len(v)==part['bytes']and hashlib.sha256(v).hexdigest()==part['sha256'];assert hashlib.sha1(b'blob '+str(len(v)).encode()+b'\0'+v).hexdigest()==part['gitSha'];b.extend(v)
 assert len(b)==d['bytes']and hashlib.sha256(b).hexdigest()==d['sha256']
 with zipfile.ZipFile(io.BytesIO(b))as z:
  assert z.testzip()is None
  hashes=json.loads(z.read('checkpoint-file-hashes.json'));assert len(hashes)==4
  files={}
  for h in hashes:
   v=z.read(h['path']);assert len(v)==h['bytes']and hashlib.sha256(v).hexdigest()==h['sha256'];files[h['path']]=v
   if not a.verify_only:
    out=(target/h['path']).resolve();assert out.is_relative_to(target)
    if out.exists():assert out.read_bytes()==v
    else:
     out.parent.mkdir(parents=True,exist_ok=True)
     with out.open('xb')as f:f.write(v);f.flush();os.fsync(f.fileno())
  root=str(base/'recovery');row=json.loads(gzip.decompress(files[root+'/packets/'+d['key']+'.json.gz']));req=json.loads(gzip.decompress(files[root+'/requests/'+d['key']+'.json.gz']));received=json.loads(gzip.decompress(files[root+'/received/'+d['key']+'.json.gz']))
  assert row['packet']==received['packet']and row['genome']==received['genome']and row['evaluationClass']=='recovery-evaluation'and row['possiblePriorExecution']is True
  assert req['source']['state']['organisms'][0]['genome']==row['genome']and req['workerSha']==d['workerSha']and req['environment']==row['environment']
  packet=row['packet'];state=packet['snapshot']['state'];assert len(state['pursuit']['trace'])==3600 and len(state['proximityFeeding']['bodyTrace'])==3600 and len(state['proximityFeeding']['samples'])==900 and len(packet['pursuitAudit']['rays'])==900
  assert packet['metrics']['ticks']==900 and packet['metrics']['finite']
  count+=1
 print(json.dumps(dict(key=d['key'],partsZIPMembersAndPacketSchemaExact=True)),flush=True)
assert count==15
print(json.dumps(dict(verifiedRecoveryPackets=count,simulationEvaluations=0,writeFiles=not a.verify_only)))
