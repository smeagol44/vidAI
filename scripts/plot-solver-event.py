"""Optional read-only evidence figure; matplotlib, no simulation execution."""
import gzip,json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path('docs/experiments');data=json.load(gzip.open(root/'solver-event-windows-v1.json.gz','rt'))
fig,axes=plt.subplots(1,2,figsize=(11,4),layout='constrained')
for hz,color in [(1920,'tab:blue'),(3840,'tab:orange')]:
    first=next(w for w in data['windows'] if w['name']=='first-contact' and w['measured']['hz']==hz)
    es=[e for e in first['measured']['solverTrace']['events'] if e['stage']=='substep-end']
    axes[0].plot([e['endTime']*1000 for e in es],[e['parts'][6]['omega'] for e in es],'.-',color=color,label=f'{hz} Hz')
    over=next(w for w in data['windows'] if w['name']=='first-overspeed' and w['measured']['hz']==hz)
    es=[e for e in over['measured']['solverTrace']['events'] if e['stage']=='joint-accept']
    axes[1].plot([e['endTime']*1000 for e in es],[e['maxOmega'] for e in es],'.-',color=color,label=f'{hz} Hz after joints')
    es=[e for e in over['measured']['solverTrace']['events'] if e['stage']=='after-guards']
    axes[1].plot([e['endTime']*1000 for e in es],[e['maxOmega'] for e in es],':',color=color,label=f'{hz} Hz after guards')
axes[0].set(title='First head–tail contact: tail P6',xlabel='Nominal substep end (ms)',ylabel='Angular velocity (rad/s)')
axes[1].set(title='First post-guard overspeed: body maximum',xlabel='Nominal substep end (ms)',ylabel='Maximum absolute angular velocity (rad/s)')
axes[1].axhline(20,color='black',ls='--',lw=1,label='Guard limit')
for ax in axes:ax.legend(fontsize=8);ax.grid(alpha=.2)
fig.suptitle('CUR-006, identical held torque tape — short event windows\nDiscrete samples; no continuous time-of-impact claim')
fig.savefig(root/'solver-event-v1.png',dpi=160)
