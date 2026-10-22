"""Optional offline figure regeneration; requires matplotlib, no simulation runs."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path('docs/experiments')
r=json.loads((root/'prism-integration-v1.json').read_text())
fig,axes=plt.subplots(2,3,figsize=(12,7),layout='constrained')
for col,b in enumerate(r['bodies']):
    ax=axes[0,col]
    rows=[x for x in b['rows'] if x['splitting']=='motor-drag']
    for hz in [240,1920,3840]:
        x=next(x for x in rows if x['hz']==hz)
        ax.plot([p[0]['x'] for p in x['trajectory']],[p[0]['y'] for p in x['trajectory']],label=f'{hz} Hz')
    ax.scatter([0],[0],color='black',s=12)
    ax.set_title(b['id']);ax.set_xlabel('COM x displacement (px)');ax.set_ylabel('COM y displacement (px)')
    ax.set_aspect('equal',adjustable='datalim');ax.grid(alpha=.2);ax.legend(fontsize=8)
    ax=axes[1,col]
    for method,label in [('motor-drag','motor → BE'),('motor-half-half','motor → BE/2 → BE/2'),('half-motor-half','BE/2 → motor → BE/2')]:
        rows=[x for x in b['rows'] if x['splitting']==method]
        ax.plot([x['hz'] for x in rows],[x['displacementPx'] for x in rows],marker='.',label=label)
    ax.axhline(b['v3DisplacementPx'],color='grey',linestyle='--',label='archived v3 context')
    ax.set_xscale('log',base=2);ax.set_xticks([240,960,3840],['240','960','3840']);ax.set_xlabel('Physical integration Hz');ax.set_ylabel('Final displacement (px)')
    ax.grid(alpha=.2);ax.legend(fontsize=7)
fig.suptitle('Fixed 60 Hz neural schedule and identical 240 Hz held torques; 5 seconds\nNo articulated method passed the finest-pair convergence criteria')
fig.savefig(root/'prism-integration-v1.png',dpi=150)
