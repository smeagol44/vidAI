"""Publish verified derivatives only to two bounded experimental refs."""
from pathlib import Path
import json,subprocess,os,shutil,hashlib
repo=Path.cwd();r=repo/'docs/experiments/proximity-targeting-v1'
def git(*args,cwd=repo):return subprocess.check_output(['git',*args],cwd=cwd,text=True).strip()
source_ref='refs/heads/experiment/proximity-targeting-103';analysis_ref='refs/heads/experiment/proximity-analysis-103'
assert os.environ.get('GITHUB_REPOSITORY')=='smeagol44/vidAI'
assert os.environ.get('VIDA103_HEAD_REF')=='experiment/proximity-targeting-103'
git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
v=json.loads((r/'training-verification.json').read_text());assert v['packets']==505 and v['offspring']==500 and v['experimentComplete']is False
old=git('ls-remote','origin',analysis_ref).split()
if old:
 git('fetch','origin',analysis_ref);parent=old[0]
else:parent='48f75676257297be155f71454c7d2b6cfea47992'
wt=Path(os.environ['RUNNER_TEMP'])/'vida103-analysis-publish'
git('worktree','add','--detach','--no-checkout',str(wt),parent);git('read-tree','--empty',cwd=wt)
out=wt/'exports';(out/'trajectories').mkdir(parents=True)
index=json.loads((r/'all-trajectories-index.json').read_text());bundles=[]
for b in index['bundles']:
 p=Path(b['path']);data=p.read_bytes();assert hashlib.sha256(data).hexdigest()==b['sha256'];parts=[]
 step=len(data)if len(data)<=90000000 else 24000000
 for i,offset in enumerate(range(0,len(data),step)):
  chunk=data[offset:offset+step];name=p.name if step==len(data)else p.name+f'.part{i:03d}';dest=out/'trajectories'/name;dest.write_bytes(chunk);parts.append(dict(path='exports/trajectories/'+name,bytes=len(chunk),sha256=hashlib.sha256(chunk).hexdigest()))
 bundles.append(dict(label=b['label'],logicalTrials=101,bytes=len(data),sha256=b['sha256'],parts=parts))
for name in ['all-trajectories-index.json','all-trajectories-index.csv','evidence-index.json','training-verification.json','training-completion.json','held-out-status.json']:
 shutil.copy2(r/name,out/name)
(out/'trajectory-bundles.json').write_text(json.dumps({'verifiedTrials':505,'heldOutUnresolved':15,'bundles':bundles},indent=2)+'\n')
git('add','exports',cwd=wt);tree=git('write-tree',cwd=wt)
analysis=git('commit-tree',tree,'-p',parent,'-m','Preserve normalized original505 training trajectories; held-outs unresolved',cwd=wt)
git('push','origin',analysis+':'+analysis_ref,cwd=wt)
assert git('ls-remote','origin',analysis_ref).split()[0]==analysis
links={'analysisCommit':analysis,'analysisBranch':'experiment/proximity-analysis-103','primaryTrainingHead':'5cefc73c3eecc22c0412319c620717be4d4ec3c7','pendingHeldOutIntent':'48f75676257297be155f71454c7d2b6cfea47992','heldOutUnresolved':15,'bundles':bundles}
(r/'analysis-links.json').write_text(json.dumps(links,indent=2)+'\n')
names=['scores.csv','curves.json','finals.csv','trials.csv','summary.json.gz','trajectories.json.gz','training-ledger.json.gz','training-completion.json','training-verification.json','training-export-verification.json','training-report.md','training-graph-data.zip','mutation-statistics.csv','mutation-statistics.json','mutation-events.csv','ancestry-reuse.json','held-out-status.json','all-trajectories-index.csv','all-trajectories-index.json','evidence-index.json','former-cap-exceedances.json','analysis-links.json','evolution-curves.png','evolution-curves.svg','frozen.json.gz']
manifest=[]
for name in names:
 p=r/name;assert p.is_file();manifest.append(dict(path=str(p.relative_to(repo)),bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest()))
(r/'training-artifact-manifest.json').write_text(json.dumps({'experimentComplete':False,'verifiedTrainingTrials':505,'heldOutUnresolved':15,'analysisCommit':analysis,'files':manifest},indent=2)+'\n')
git('add',*[str((r/name).relative_to(repo))for name in names],str((r/'training-artifact-manifest.json').relative_to(repo)))
for p in sorted((r/'champions').glob('*.gz')):git('add',str(p.relative_to(repo)))
git('commit','-m','Record audited #103 training results; held-outs unresolved')
source=git('rev-parse','HEAD');git('push','origin','HEAD:'+source_ref)
assert git('ls-remote','origin',source_ref).split()[0]==source
print(json.dumps({'sourceCommit':source,'analysisCommit':analysis,'verifiedOriginalTrials':505,'heldOutUnresolved':15,'originalOutcomesReplaced':0}))
