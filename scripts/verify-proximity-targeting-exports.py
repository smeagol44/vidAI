"""Validate graph/count/trajectory/lineage deliverables without scientific simulation."""
from pathlib import Path
import csv,gzip,io,json,zipfile,hashlib,math
r=Path('docs/experiments/proximity-targeting-v1');s=json.loads(gzip.decompress((r/'summary.json.gz').read_bytes()));paths=json.loads(gzip.decompress((r/'trajectories.json.gz').read_bytes()));counts={}
assert len(s['trials'])==520 and len({x['key']for x in s['trials']})==520
assert len(s['mutationStats'])==500 and len(s['curves'])==55 and len(s['heldOut'])==15 and len(s['runs'])==5
lineage=json.loads((r/'mutation-statistics.json').read_text());assert len(lineage['events'])==4000 and len(lineage['offspring'])==500
for x in lineage['offspring']:assert x['targeted_events']+x['exploratory_events']==8 and x['targeted_fraction']==x['targeted_events']/8
with zipfile.ZipFile(r/'graph-data.zip')as z:
 assert z.testzip()is None
 for name in z.namelist():
  if (r/name).exists():assert z.read(name)==(r/name).read_bytes(),name
 for name,expected in [('scores.csv',55),('finals.csv',5),('held-out.csv',15),('trials.csv',520),('target-timelines.csv',3601*len(paths)),('feeding-timelines.csv',900*len(paths)),('mutation-statistics.csv',500),('mutation-events.csv',4000)]:
  rows=list(csv.DictReader(io.StringIO(z.read(name).decode())));assert len(rows)==expected,(name,len(rows));assert all(all(v is not None for v in row.values())for row in rows);counts[name]=len(rows)
 assert len(json.loads(z.read('curves.json'))['curves'])==55
assert len({p['key']for p in paths})==len(paths)
for p in paths:
 assert len(p['trajectory'])==3601 and len(p['bodyTrajectory'])==3601 and len(p['proximity'])==900 and len(p['feeding'])==900 and len(p['rays'])==900
 assert all(len(row)==len(p['bodyColumns'])for row in p['bodyTrajectory'])
 for sample in p['proximity']:assert abs(sample['absorbedJ']-.8*sample['grossJ'])<1e-9
 assert all(all(math.isfinite(v)for v in row)for row in p['trajectory'])
for run in s['runs']:
 curve=[p['selected_absorbed_J']for p in s['curves']if p['controller']==run['controller']and p['brain_seed']==run['brain_seed']];assert len(curve)==11 and all(a<=b for a,b in zip(curve,curve[1:]))
 assert curve[0]==run['founder_J']and curve[-1]==run['final_J']
print(json.dumps({'zipCRCAndMembersExact':True,'rows':counts,'trajectoryConditions':len(paths),'simulationEvaluations':0,'zipSHA256':hashlib.file_digest((r/'graph-data.zip').open('rb'),'sha256').hexdigest()}))
