"""Verify final counts, raw provenance references, graph members and hashes; no simulation."""
from pathlib import Path
import json,gzip,csv,zipfile,hashlib,math
b=Path('docs/experiments/proximity-targeting-v1');r=b/'recovery'
read=lambda p:json.loads(gzip.decompress(p.read_bytes())if p.suffix=='.gz'else p.read_bytes())
training=read(b/'summary.json.gz');s=read(r/'summary.json.gz');v=read(r/'verification.json');held=s['heldOut'];paths=read(r/'trajectories.json.gz');index=read(r/'all-trajectories-index.json');manifest=read(r/'manifest.json');complete=read(r/'complete.json')
assert len(s['trials'])==520 and len({x['key']for x in s['trials']})==520 and len(held)==15 and len(paths)==31 and len(index['entries'])==520
assert s['curves']==training['curves']and s['runs']==training['runs']and s['mutationStats']==training['mutationStats']and s['selectedAncestry']==training['selectedAncestry']and s['trials'][:505]==training['trials']
assert s['originalExactOnceHeldOutsEstablished']is False and v['trainingOutcomesReexecuted']==0 and complete['trainingOutcomesReexecuted']==0
assert v['fullWorkerReplays']==15 and v['splitResetForks']==5 and len(v['replay'])==15
for x in v['replay']:assert x['actualPacketSha']==x['expectedPacketSha']and x['fullWorkerPacketExact']
expected={(c,seed,e,h)for c,seed in [('legacy',17),('mutable',17),('mutable',71),('mutable',1901),('mutable',4099)]for e,h in [(811,-.7),(977,2.3),(2301,math.pi/2)]}
assert {(x['controller'],x['brain_seed'],x['environment_seed'],x['heading'])for x in held}==expected
assert all(x['evaluation_class']=='recovery-evaluation'and x['possible_prior_execution']is True for x in held)
assert read(b/'held-out-status.json')['verifiedReceipts']==0 and read(b/'held-out-status.json')['numberStarted']is None
for x in paths:assert len(x['trajectory'])==3601 and len(x['bodyTrajectory'])==3601 and len(x['proximity'])==900 and len(x['rays'])==900
for e in manifest['files']+read(b/'training-artifact-manifest.json')['files']:
 p=Path(e['path']);assert p.stat().st_size==e['bytes']and hashlib.file_digest(p.open('rb'),'sha256').hexdigest()==e['sha256'],e['path']
with zipfile.ZipFile(r/'graph-data.zip')as z:
 assert z.testzip()is None
 for name in z.namelist():
  p=r/name.removeprefix('recovery/')if name.startswith('recovery/')else b/name.removeprefix('training/')
  assert z.read(name)==p.read_bytes(),name
assert len(list(csv.DictReader((r/'held-out.csv').open())))==15 and len(list(csv.DictReader((r/'trials.csv').open())))==520
result=dict(completedWithRecoveryException=True,logicalConditions=520,originalTrainingUnchanged=505,heldOutRecoveryEvaluations=15,fullWorkerPacketReplays=15,splitResetForks=5,graphTrajectoryConditions=31,completeTrajectoryIndex=520,manifestFilesVerified=len(manifest['files']),trainingArtifactFilesVerified=25,ZIPCRCAndMembersExact=True,simulationEvaluations=0,graphZIPsha256=hashlib.file_digest((r/'graph-data.zip').open('rb'),'sha256').hexdigest())
(r/'export-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
