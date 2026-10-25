"""Plot the recorded55 curve points; no evaluation or fitting."""
from pathlib import Path
import csv
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=Path('docs/experiments/proximity-targeting-v1');rows=list(csv.DictReader((r/'scores.csv').open()));fig,axes=plt.subplots(2,1,figsize=(11,8),constrained_layout=True)
styles=[('legacy',17,'#263244','-','Legacy17 · random'),('mutable',17,'#0072B2','-','MUTABLE17 · random'),('mutable',1901,'#009E73','-','MUTABLE1901 · random'),('mutable',71,'#D55E00','--','MUTABLE71 · parent targeted'),('mutable',4099,'#AA4499','--','MUTABLE4099 · parent targeted')]
for c,seed,color,linestyle,label in styles:
 points=[x for x in rows if x['controller']==c and int(x['brain_seed'])==seed];x=[int(p['generation'])for p in points];y=[float(p['selected_absorbed_J'])for p in points];assert len(x)==11
 axes[0].plot(x,y,color=color,linestyle=linestyle,marker='o',markersize=4,label=label)
 if c=='mutable':axes[1].plot(x,y,color=color,linestyle=linestyle,marker='o',markersize=4,label=label)
for ax in axes:ax.set(xlabel='Generation (0 = measured founder)',ylabel='Selected absorbed nutrient energy (J)',xticks=range(11));ax.grid(alpha=.2);ax.spines[['top','right']].set_visible(False);ax.set_ylim(bottom=0);ax.legend(frameon=False,fontsize=8,loc='upper left')
axes[0].set_title('Five independent populations · 90 px graded real feeding',loc='left',weight='bold');axes[1].set_title('MUTABLE populations · separate scale',loc='left',weight='bold');fig.suptitle('500 offspring · strict absorbed-J improvement only',fontsize=16,weight='bold');fig.text(.5,-.025,'Seeds and mutation algorithm differ between groups; this is not a causal targeting comparison.',ha='center',fontsize=10,color='#475569');fig.savefig(r/'evolution-curves.png',dpi=170,bbox_inches='tight');fig.savefig(r/'evolution-curves.svg',bbox_inches='tight');plt.close(fig)
