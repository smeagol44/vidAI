"""Exact archived intake curves; no simulations or interpolation of invalid runs."""
import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
root=Path('docs/experiments');prefix='hybrid-threshold-intake-v1'
s=json.loads((root/(prefix+'-summary.json')).read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'svg.hashsalt':prefix})
fig,axes=plt.subplots(3,1,figsize=(10,10),sharex=True,layout='constrained')
colors=['#64748b','#9333ea','#0284c7','#d97706','#15803d'];marks=['x','s','^','o','D'];x=np.arange(16)
for r,col,marker in zip(s['results'],colors,marks):
 y=[r['founder']['absorbedJ'] if r['founder']['valid'] else np.nan]+[g['bestJ'] if g['bestJ'] is not None else np.nan for g in r['generations']]
 label=str(r['seed'])+(' — no valid incumbent' if not r['championAvailable'] else '')
 for ax in axes[:2]:ax.plot(x,y,color=col,marker=marker,markersize=3,linewidth=1.7,label=label)
 axes[2].plot(x[1:],[g['medianValidJ'] if g['medianValidJ'] is not None else np.nan for g in r['generations']],color=col,marker=marker,markersize=3,linewidth=1.7,label=label)
axes[0].plot(x,s['historicalLegacy']['curve'],color='#171717',linestyle='--',linewidth=2,label='Legacy #87 (one historical run)')
axes[0].set_title('Absorbed nutrient energy — valid incumbent, historical comparison',loc='left',fontweight='bold');axes[0].set_ylabel('Absorbed J / 12 s');axes[0].set_ylim(-400,18000)
axes[0].legend(loc='center right',ncols=2,fontsize=9)
axes[1].set_title('Revised hybrid incumbents — detail',loc='left',fontweight='bold');axes[1].set_ylabel('Absorbed J / 12 s');axes[1].set_ylim(-45,1250)
axes[2].set_title('Median intake of valid offspring in each generation',loc='left',fontweight='bold');axes[2].set_ylabel('Absorbed J / 12 s');axes[2].set_xlabel('Generation (0 = founder)');axes[2].set_ylim(-15,270)
for ax in axes:ax.grid(axis='y',alpha=.22);ax.set_xlim(-.2,15.2);ax.set_xticks(range(16));ax.spines[['top','right']].set_visible(False)
fig.suptitle('Five-run revised neural hybrid experiment (#89)',fontsize=15,fontweight='bold')
fig.supxlabel('Gaps mean no valid specimen; invalid intake is never plotted as success.\nSame #87 habitat/score/gates; legacy curve is archived, not rerun.',fontsize=9)
fig.savefig(root/(prefix+'-curves.svg'),metadata={'Date':None})
fig.savefig(root/(prefix+'-curves.png'),dpi=135,metadata={'Software':'VIDA offline experiment'})
print('Curves generated from preserved raw-derived summary; no Worker executions.')
