"""Optional static figure from sealed summary, no simulation."""
import json,pathlib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
s=json.loads(pathlib.Path('docs/experiments/neural-food-v1-summary.json').read_text())
plt.rcParams.update({'font.size':9,'svg.fonttype':'none'})
fig,axs=plt.subplots(3,3,figsize=(11,8),sharex=True,sharey=True)
colors=['#1e66a8','#bf5f28','#228573']
for row,e in enumerate(['A','B','C']):
 for col,a in enumerate(['oscillator-only','direct-only','two-output']):
  ax=axs[row,col];rows=[r for r in s['runs'] if r['environment']==e and r['architecture']==a]
  for r,color in zip(rows,colors):
   y=[g['best'] if g['best'] is not None else float('nan') for g in r['generations']]
   if r['initialValid']:x=[0]+list(range(1,13));y=[r['initialDistance']]+y
   else:x=list(range(1,13))
   ax.plot(x,y,label=str(r['seed']),color=color,linewidth=1.8)
  if not any(r['finalDistance'] is not None for r in rows):ax.text(.5,.5,'No valid elite\n0 / 576 valid offspring',transform=ax.transAxes,ha='center',va='center',color='#a13c28')
  ax.grid(alpha=.2);ax.set_xticks([0,3,6,9,12]);ax.set_title(f'{e}: {a}')
  if col==0:ax.set_ylabel('Best valid net COM travel (px / 5 s)')
  if row==2:ax.set_xlabel('Generation')
axs[0,2].legend(title='Brain seed',loc='upper left')
fig.suptitle('Corrected neural motor comparison / unchanged Darter and passive-work-v3')
fig.text(.5,.01,'A empty · B one nutrient · C mildly clustered nutrients. Invalid founder distances are not plotted as valid baselines.',ha='center',fontsize=9)
fig.tight_layout(rect=(0,.025,1,.965));fig.savefig('docs/experiments/neural-food-v1-progress.svg');plt.close(fig)
