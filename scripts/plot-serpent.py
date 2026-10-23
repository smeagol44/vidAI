"""Read-only static evidence figure. No simulation or parameter search."""
import gzip,json,math
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path('docs/experiments');d=json.load(gzip.open(root/'brain-free-serpent-v1.json.gz','rt'))
fig,axes=plt.subplots(2,2,figsize=(11,8),layout='constrained')
for regime,color,label in [('passive-work-v3','tab:blue','v3'),('prism-resistance-v4','tab:orange','v4')]:
    rows=[r for r in d['rows'] if r['regime']==regime]
    n=next(r for r in rows if r['label']=='native-feedback')
    for name,style in [('native-feedback','-'),('reverse-feedback','--')]:
        r=next(r for r in rows if r['label']==name);t=r['trajectory']
        axes[0,0].plot([p['x'] for p in t],[p['y'] for p in t],style,color=color,label=label+(' wave' if name=='native-feedback' else ' reversed'))
        axes[0,0].plot(t[-1]['x'],t[-1]['y'],'o',color=color,ms=4)
    for name,hz,style in [('native-feedback',240,'-'),('held-native-tape',960,':'),('reciprocal-feedback',240,'--')]:
        r=next(r for r in rows if r['label']==name and r['hz']==hz);t=r['trajectory']
        axes[0,1].plot([p['time'] for p in t],[p['y'] for p in t],style,color=color,label=f'{label} '+('in-phase' if name=='reciprocal-feedback' else f'{hz}Hz'))
    q=n['trajectory'][720:]
    axes[1,1].plot([p['q'][0]*180/math.pi for p in q],[p['q'][1]*180/math.pi for p in q],color=color,label=f'{label} wave, cycle4')
    rec=next(r for r in rows if r['label']=='reciprocal-feedback')['trajectory'][720:]
    axes[1,1].plot([p['q'][0]*180/math.pi for p in rec],[p['q'][1]*180/math.pi for p in rec],'--',color=color,label=f'{label} in-phase')
v4=next(r for r in d['rows'] if r['regime']=='prism-resistance-v4' and r['label']=='native-feedback')['trajectory'][720:]
for j,color in [(0,'tab:green'),(1,'tab:purple')]:
    axes[1,0].plot([p['time'] for p in v4],[p['q'][j]*180/math.pi for p in v4],color=color,label=f'Joint{j+1} actual v4')
    axes[1,0].plot([p['time'] for p in v4],[p['target'][j]*180/math.pi for p in v4],':',color=color,label=f'Joint{j+1} requested')
axes[0,0].set(title='Actual COM paths (end dots)',xlabel='x displacement (px)',ylabel='y displacement (px)')
axes[0,1].set(title='Travel and timestep comparison',xlabel='Simulated seconds',ylabel='y displacement (px)')
axes[1,0].set(title='Achieved phased bends, fourth cycle',xlabel='Simulated seconds',ylabel='Relative joint angle (degrees)')
axes[1,1].set(title='Actual joint-shape loops, fourth cycle',xlabel='Joint1 (degrees)',ylabel='Joint2 (degrees)')
for ax in axes.flat:ax.grid(alpha=.2);ax.legend(fontsize=7)
axes[1,1].set_aspect('equal',adjustable='box')
fig.suptitle('Brain-free three-part serpent — funded independent traveling-wave torques\nBoth local refinement checks pass; different regime mass/drag/capacity prevents drag-only attribution')
fig.savefig(root/'brain-free-serpent-v1.png',dpi=150)
