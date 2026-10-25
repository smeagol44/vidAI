"""One bounded recovery batch, checkpointed before advancing. No training entry point."""
from pathlib import Path
import json,subprocess,os,hashlib,zipfile,shutil,gzip

repo=Path.cwd();base=repo/'docs/experiments/proximity-targeting-v1';root=base/'recovery'
original='48f75676257297be155f71454c7d2b6cfea47992'
ref='refs/heads/experiment/proximity-heldout-recovery-evidence-103'
source_ref='refs/heads/experiment/proximity-targeting-103'
assert os.environ.get('GITHUB_REPOSITORY')=='smeagol44/vidAI'
assert os.environ.get('VIDA103_HEAD_REF')=='experiment/proximity-targeting-103'
def run(*args,**kw):return subprocess.run(args,check=True,**kw)
def git(*args,cwd=repo):return subprocess.check_output(['git',*args],cwd=cwd,text=True).strip()
def sha(b):return hashlib.sha256(b).hexdigest()
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2)+'\n')
def read(p):return json.loads(p.read_text())
source_head=git('rev-parse','HEAD');git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
assert git('ls-remote','origin',source_ref).split()[0]==source_head,'Source advanced: stop before evaluation'
git('fetch','origin','experiment/proximity-targeting-evidence-103')
assert git('ls-remote','origin','refs/heads/experiment/proximity-targeting-evidence-103').split()[0]==original,'Reinspect changed original evidence before any execution'
original_paths=git('ls-tree','-r','--name-only',original).splitlines()
assert [p for p in original_paths if 'held' in p]==['intents/056-held-outs.json'],'Original held-out evidence appeared; recover it first'
plan=json.loads(subprocess.check_output(['node','--import','tsx','scripts/run-proximity-heldout-recovery.mjs','plan'],text=True));assert len(plan['slots'])==15
root.mkdir(exist_ok=True);write(root/'plan.json',plan)
existing=git('ls-remote','origin',ref).split();parent=existing[0]if existing else original
if existing:git('fetch','origin',ref)
wt=Path(os.environ['RUNNER_TEMP'])/'vida103-recovery-evidence'
git('worktree','add','--detach',str(wt),parent)
def publish(paths,message):
 global parent
 git('add',*paths,cwd=wt);git('commit','-m',message,cwd=wt);head=git('rev-parse','HEAD',cwd=wt)
 git('push','--force-with-lease='+ref+':'+(parent if existing or parent!=original else ''),'origin',head+':'+ref,cwd=wt)
 assert git('ls-remote','origin',ref).split()[0]==head
 git('fetch','origin',ref);parent=head;return head
def restore(label):
 run('python','scripts/restore-proximity-targeting-evidence.py','--ref',parent,'--label-prefix',label)
checkpoints=[]
for i,slot in enumerate(plan['slots'],1):
 label=f'recovery-{i:03d}-{slot["key"]}';desc='checkpoints/'+label+'.json';intent_path='recovery-intents/'+slot['key']+'.json'
 if (wt/desc).exists():
  restore(label);d=read(wt/desc);checkpoints.append(dict(d,descriptorPath=desc,commit=git('log','-1','--format=%H','--',desc,cwd=wt)));continue
 assert not (wt/intent_path).exists(),'Uncertain recovery intent exists without archived packet; refuse automatic repetition: '+slot['key']
 intent={**slot,'workerSha':plan['workerSha'],'implementation':plan['implementation'],'evaluationClass':'recovery-evaluation','possiblePriorExecution':True,'authorizationSourceCommit':source_head,'authorizationSha256':sha((base/'owner-recovery-authorization.md').read_bytes())}
 write(wt/intent_path,intent);intent_head=publish([intent_path],'Intent: authorized #103 held-out recovery '+slot['key'])
 write(root/'active-intent.json',intent)
 log=root/(label+'-run.log')
 with log.open('x')as f:run('node','--import','tsx','scripts/run-proximity-heldout-recovery.mjs',slot['key'],stdout=f,stderr=subprocess.STDOUT)
 print(log.read_text(),flush=True)
 members=[root/k/(slot['key']+'.json.gz')for k in ['requests','received','packets']]+[log]
 hashes=[dict(path=str(p.relative_to(repo)),bytes=p.stat().st_size,sha256=sha(p.read_bytes()))for p in members]
 bundle=Path(os.environ['RUNNER_TEMP'])/(label+'.zip')
 with zipfile.ZipFile(bundle,'x',compression=zipfile.ZIP_STORED)as z:
  for p in members:z.write(p,str(p.relative_to(repo)))
  z.writestr('checkpoint-file-hashes.json',json.dumps(hashes,indent=2))
 data=bundle.read_bytes();parts=[];paths=[]
 for j,offset in enumerate(range(0,len(data),24000000)):
  chunk=data[offset:offset+24000000];path='checkpoints/'+label+f'.zip.part{j:03d}';(wt/path).write_bytes(chunk);parts.append(dict(path=path,bytes=len(chunk),sha256=sha(chunk),gitSha=hashlib.sha1(b'blob '+str(len(chunk)).encode()+b'\0'+chunk).hexdigest()));paths.append(path)
 d=dict(label=label,key=slot['key'],kind='owner-authorized-held-out-recovery',evaluationClass='recovery-evaluation',possiblePriorExecution=True,logicalTrials=1,bytes=len(data),sha256=sha(data),parts=parts,intentHead=intent_head,implementation=plan['implementation'],workerSha=plan['workerSha'])
 write(wt/desc,d);head=publish(paths+[desc],'Preserve #103 recovery packet '+slot['key']);restore(label)
 checkpoints.append(dict(d,descriptorPath=desc,commit=head));print(json.dumps({'durableCheckpoint':slot['key'],'commit':head}),flush=True)
assert len(checkpoints)==15
write(root/'evidence-index.json',dict(evidenceBranch=ref.removeprefix('refs/heads/'),evidenceHead=parent,sourceAuthorizationCommit=source_head,originalUnresolvedEvidenceHead=original,recoveryEvaluations=15,reusedOriginalOutcomes=0,possiblePriorExecution=True,checkpoints=checkpoints))
run('node','--import','tsx','scripts/audit-proximity-heldout-recovery.mjs')
run('node','--import','tsx','scripts/summarize-proximity-heldout-recovery.mjs')
run('python','scripts/report-proximity-heldout-recovery.py')
run('python','scripts/verify-proximity-heldout-recovery.py')
# Preserve all split-reset snapshots as verification evidence without adding dataset rows.
paths=[]
for p in sorted((root/'replay-halves').glob('*.gz')):
 dest='recovery-replays/'+p.name;(wt/dest).parent.mkdir(exist_ok=True);shutil.copy2(p,wt/dest);paths.append(dest)
for name in ['verification.json','evidence-index.json','held-out-summary.json','manifest.json','complete.json']:
 dest='recovery-replays/'+name;shutil.copy2(root/name,wt/dest);paths.append(dest)
verification_head=publish(paths,'Preserve #103 recovery audit and split-reset verification evidence')
write(root/'publication.json',dict(sourceAuthorizationCommit=source_head,primaryRecoveryEvidenceHead=parent,checkpointHead=checkpoints[-1]['commit'],trainingEvidenceHead='5cefc73c3eecc22c0412319c620717be4d4ec3c7',originalUnresolvedEvidenceHead=original,trainingNormalizedTrajectoryHead='481da436e0f08ff91bc4f4a3cc2cd61e2f97377d'))
# Source publication only adds bounded recovery deliverables. Raw packets stay in the data ref.
names=['plan.json','evidence-index.json','verification.json','held-out-summary.json','summary.json.gz','trajectories.json.gz','held-out.csv','held-out-target-timelines.csv','held-out-feeding-timelines.csv','trials.csv','all-trajectories-index.json','report.md','held-out.png','held-out.svg','graph-data.zip','manifest.json','complete.json','export-verification.json','publication.json']
git('add',*[str((root/name).relative_to(repo))for name in names]);git('commit','-m','Record completed #103 held-out recovery evaluations')
head=git('rev-parse','HEAD');git('push','--force-with-lease='+source_ref+':'+source_head,'origin','HEAD:'+source_ref);assert git('ls-remote','origin',source_ref).split()[0]==head
print(json.dumps({'completedRecovery':True,'sourceHead':head,'recoveryEvidenceHead':parent,'heldOutRecoveryEvaluations':15,'trainingOutcomesReexecuted':0}),flush=True)
