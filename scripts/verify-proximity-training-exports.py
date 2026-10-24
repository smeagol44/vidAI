"""Pure artifact validation; no evaluation and no held-out assumptions."""
from pathlib import Path
import json,gzip,zipfile,csv,io,hashlib
r=Path('docs/experiments/proximity-targeting-v1')
s=json.loads(gzip.decompress((r/'summary.json.gz').read_bytes()));paths=json.loads(gzip.decompress((r/'trajectories.json.gz').read_bytes()));stats=json.loads((r/'mutation-statistics.json').read_text());index=json.loads((r/'all-trajectories-index.json').read_text());held=json.loads((r/'held-out-status.json').read_text())
assert len(s['trials'])==505 and len({x['key']for x in s['trials']})==505 and len(s['curves'])==55 and len(s['runs'])==5 and not s['heldOut']
assert len(stats['offspring'])==500 and len(stats['events'])==4000 and len(index['entries'])==505 and len(index['bundles'])==5
assert len(held['slots'])==15 and held['verifiedReceipts']==0 and held['notReexecuted'] and held['numberStarted']is None and held['numberCompleted']is None
for x in paths:assert len(x['trajectory'])==3601 and len(x['bodyTrajectory'])==3601 and len(x['proximity'])==900 and len(x['feeding'])==900 and len(x['rays'])==900
expected={'scores.csv':55,'finals.csv':5,'trials.csv':505,'mutation-statistics.csv':500,'mutation-events.csv':4000,'target-timelines.csv':3601*len(paths),'feeding-timelines.csv':900*len(paths),'all-trajectories-index.csv':505}
with zipfile.ZipFile(r/'training-graph-data.zip')as z:
 assert z.testzip()is None
 for name in z.namelist():
  if (r/name).exists():assert z.read(name)==(r/name).read_bytes()
 for name,count in expected.items():assert len(list(csv.DictReader(io.StringIO(z.read(name).decode()))))==count
result={'experimentComplete':False,'trainingOriginalPackets':505,'offspring':500,'heldOutUnresolved':15,'curvePoints':55,'mutationEvents':4000,'trajectoryConditions':len(paths),'zipCRCAndMembersExact':True,'rows':expected,'zipSHA256':hashlib.file_digest((r/'training-graph-data.zip').open('rb'),'sha256').hexdigest(),'simulationEvaluations':0}
(r/'training-export-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

manifest=r/'training-artifact-manifest.json'
if manifest.exists():
 m=json.loads(manifest.read_text())
 for e in m['files']:
  p=Path(e['path']);assert p.stat().st_size==e['bytes']and hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==e['sha256'],e['path']
 print(json.dumps({'publishedArtifactHashesExact':True,'files':len(m['files']),'simulationEvaluations':0}))
