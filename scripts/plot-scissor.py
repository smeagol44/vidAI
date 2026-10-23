"""Read-only plot of archived brain-free Worker results; no simulation execution."""
import json,gzip,math
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path('docs/experiments');d=json.load(gzip.open(root/'brain-free-scissor-v2.json.gz','rt'))
fig,axes=plt.subplots(2,2,figsize=(11,7),layout='constrained')
for column,regime in enumerate(['passive-work-v3','prism-resistance-v4']):
    rows=[r for r in d['rows'] if r['regime']==regime]
    for label,hz,style in [('native-feedback',240,'-'),('held-native-tape',480,'--'),('held-native-tape',960,':'),('passive',240,'-.')]:
        r=next(r for r in rows if r['label']==label and r['hz']==hz);t=r['trajectory']
        axes[0,column].plot([s['time'] for s in t],[s['y'] for s in t],style,label=f'{label}, {hz} Hz')
        axes[1,column].plot([s['time'] for s in t],[s['aperture']*180/math.pi for s in t],style)
    t=rows[0]['trajectory'];axes[1,column].plot([s['time'] for s in t],[s['requestedAperture']*180/math.pi for s in t],color='grey',lw=.6,label='Requested aperture')
    axes[0,column].set(title=regime,ylabel='COM y displacement (px)');axes[0,column].legend(fontsize=7)
    axes[1,column].set(xlabel='Simulated time (s)',ylabel='Actual aperture (degrees)');axes[1,column].legend(fontsize=8)
    for ax in axes[:,column]:ax.grid(alpha=.2)
fig.suptitle('Brain-free 1×7 px corner-hinged scissor — four funded cycles\nv3 is timestep-sensitive; v4 finest fixed-tape pair passes a local check, not physical validation')
fig.savefig(root/'brain-free-scissor-v2.png',dpi=150)
