"""Optional static report figure from frozen summaries; no simulation."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
s=json.loads(Path('docs/experiments/neural-selection-v1-summary.json').read_text())
plt.rcParams.update({'font.size':10,'svg.fonttype':'none'})
fig,axes=plt.subplots(1,3,figsize=(12,3.5),sharey=True)
colors={'legacy':'#1e66a8','signed':'#b94926','hybrid':'#21816b'}
for ax,seed in zip(axes,[17,71,1901]):
    for a in colors:
        r=next(r for r in s['runs'] if r['architecture']==a and r['seed']==seed)
        x=[g['generation'] for g in r['generations']]; y=[g['best'] for g in r['generations']]
        if r['initialValid']: x=[0]+x; y=[r['initialDistance']]+y
        else: ax.scatter([0],[r['initialDistance']],marker='x',color=colors[a],s=40)
        ax.plot(x,y,color=colors[a],label=a,linewidth=2)
    ax.set_title(f'Starting seed {seed}'); ax.set_xlabel('Generation')
    ax.set_xticks([0,3,6,9,12]); ax.grid(alpha=.2)
axes[0].set_ylabel('Best valid net COM displacement (px / 5 s)')
axes[-1].legend(loc='upper left')
fig.suptitle('Equal-budget neural selection on unchanged Darter / passive-work-v3',y=1.02)
fig.text(.5,-.03,'12 × 16 offspring per architecture per seed. Crosses: invalid signed founders, ineligible for selection.',ha='center',fontsize=9)
fig.tight_layout(); fig.savefig('docs/experiments/neural-selection-v1-progress.svg',bbox_inches='tight')
plt.close(fig)
