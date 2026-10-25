"""Restore preserved Git evidence WITHOUT running simulations or overwriting differences."""
import argparse,subprocess,json,hashlib,pathlib,zipfile,io,os
p=argparse.ArgumentParser();p.add_argument('--ref',required=True);p.add_argument('--destination',default='.');p.add_argument('--label-prefix',default='');a=p.parse_args()
base='checkpoints/'
paths=subprocess.check_output(['git','ls-tree','-r','--name-only',a.ref,'--',base],text=True).splitlines()
descriptors=[x for x in paths if x.endswith('.json')and pathlib.Path(x).name.startswith(a.label_prefix)]
assert descriptors,'Fetch the evidence ref first; no descriptors found'
target=pathlib.Path(a.destination).resolve();files=0
for descriptor in sorted(descriptors):
 d=json.loads(subprocess.check_output(['git','show',a.ref+':'+descriptor]));parts=[]
 for part in d['parts']:
  b=subprocess.check_output(['git','show',a.ref+':'+part['path']]);assert len(b)==part['bytes'];assert hashlib.sha256(b).hexdigest()==part['sha256'];assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==part['gitSha'];parts.append(b)
 b=b''.join(parts);assert len(b)==d['bytes'];assert hashlib.sha256(b).hexdigest()==d['sha256']
 with zipfile.ZipFile(io.BytesIO(b)) as z:
  assert z.testzip() is None
  for entry in json.loads(z.read('checkpoint-file-hashes.json')):
   name=entry['path'];dest=(target/name).resolve();assert dest.is_relative_to(target)
   data=z.read(name);assert len(data)==entry['bytes'];assert hashlib.sha256(data).hexdigest()==entry['sha256']
   if dest.exists():assert dest.read_bytes()==data,'Existing file differs;preserved without overwrite: '+name
   else:
    dest.parent.mkdir(parents=True,exist_ok=True);tmp=dest.with_name(dest.name+'.restore-tmp')
    with tmp.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
    tmp.rename(dest)
   files+=1
 print(json.dumps({'checkpoint':d['label'],'bytes':d['bytes'],'restored':True}),flush=True)
print(json.dumps({'checkpoints':len(descriptors),'fileEntriesVerified':files,'simulationEvaluations':0}))

