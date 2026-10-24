"""Validate published graph artifacts without simulation or full raw-archive download."""
from pathlib import Path
import csv,gzip,io,json,zipfile,hashlib
r=Path('docs/experiments/moving-nutrient-v1');counts={}
with zipfile.ZipFile(r/'graph-data.zip')as z:
 assert z.testzip()is None
 for name in z.namelist():
  if (r/name).exists():assert z.read(name)==(r/name).read_bytes(),name
 for name,expected in [('scores.csv',55),('finals.csv',5),('held-out.csv',15),('trials.csv',520),('target-timelines.csv',72020),('feeding-timelines.csv',18000)]:
  rows=list(csv.DictReader(io.StringIO(z.read(name).decode())));assert len(rows)==expected,(name,len(rows));assert all(all(v is not None for v in row.values())for row in rows);counts[name]=len(rows)
 assert len(json.loads(z.read('curves.json'))['curves'])==55
summary=json.loads(gzip.decompress((r/'summary.json.gz').read_bytes()));assert len(summary['trials'])==520
paths=json.loads(gzip.decompress((r/'trajectories.json.gz').read_bytes()));assert len(paths)==20;assert all(len(x['trajectory'])==3601 and len(x['feeding'])==900 and len(x['rays'])==900 for x in paths)
print(json.dumps({'zipCRCAndMembersExact':True,'rows':counts,'trajectoryConditions':20,'simulationEvaluations':0,'zipSHA256':hashlib.file_digest((r/'graph-data.zip').open('rb'),'sha256').hexdigest()}))
