"""Pure report/CSV/plot finalization; no Worker or scientific execution."""
from pathlib import Path
import os,subprocess,json
assert os.environ.get('GITHUB_REPOSITORY')=='smeagol44/vidAI'
assert os.environ.get('VIDA103_HEAD_REF')=='experiment/proximity-targeting-103'
ref='refs/heads/experiment/proximity-targeting-103';r=Path('docs/experiments/proximity-targeting-v1/recovery')
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
head=git('rev-parse','HEAD');assert git('ls-remote','origin',ref).split()[0]==head
subprocess.run(['python','scripts/verify-proximity-heldout-recovery.py'],check=True)
subprocess.run(['python','scripts/report-proximity-heldout-recovery.py'],check=True)
subprocess.run(['python','scripts/verify-proximity-heldout-recovery.py'],check=True)
names=['held-out.csv','trials.csv','report.md','held-out.png','held-out.svg','graph-data.zip','manifest.json','export-verification.json']
git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
git('add',*[str(r/name)for name in names]);git('commit','-m','Record finalized #103 recovery report and explicit zero-outcome graph')
final=git('rev-parse','HEAD');git('push','--force-with-lease='+ref+':'+head,'origin','HEAD:'+ref);assert git('ls-remote','origin',ref).split()[0]==final
print(json.dumps(dict(sourceHead=final,simulationEvaluations=0,trainingOutcomesReexecuted=0,reportOnly=True)))
