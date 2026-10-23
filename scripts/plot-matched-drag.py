"""Read-only gameplay comparison plot; no simulation or parameter fitting."""
import json,gzip
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path('docs/experiments');data=json.load(open(root/'matched-drag-v1.json'))
fig,axes=plt.subplots(2,3,figsize=(12,6.5),layout='constrained')
for col,b in enumerate(data['bodies']):
    d=json.load(gzip.open(root/b['archive'],'rt'))
    for law,color in [('v3','tab:blue'),('v4','tab:orange')]:
        for hz,style in [(240,'-'),(960,':')]:
            r=next(r for r in d['rows'] if r['label']=='primary' and r['law']==law and r['hz']==hz)
            t=r['trajectory'];axis='y' if b['body']!='paddles' else 'x'
            axes[0,col].plot([p['time'] for p in t],[p[axis] for p in t],style,color=color,label=f'{law} drag {hz}Hz')
            if hz==240:axes[1,col].plot([p['time'] for p in t],[p['q'][0]*180/3.141592653589793 for p in t],color=color,label=f'{law} actual joint1')
    target=d['rows'][0]['trajectory'];axes[1,col].plot([p['time'] for p in target],[p['target'][0]*180/3.141592653589793 for p in target],'--',color='grey',lw=.8,label='Requested joint1')
    axes[0,col].axhline(0,color='black',lw=.5);axes[0,col].set(title=b['body'],ylabel=f'{axis} displacement (px)')
    axes[1,col].set(xlabel='Simulated seconds',ylabel='Relative angle (degrees)')
    for ax in axes[:,col]:ax.grid(alpha=.2);ax.legend(fontsize=7)
fig.suptitle('Identical mass, inertia, torque tapes and explicit integration — only drag law differs\nCurrent v3 recommended for gameplay; failed scissor/contact gates remain visible')
fig.savefig(root/'matched-drag-v1.png',dpi=140)
