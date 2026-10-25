"""Complete report and graph inputs from original training + labelled recovery; zero simulation."""
from pathlib import Path
import json,gzip,csv,zipfile,hashlib
base=Path('docs/experiments/proximity-targeting-v1');r=base/'recovery'
read=lambda p:json.loads(gzip.decompress(p.read_bytes())if p.suffix=='.gz'else p.read_bytes())
s=read(r/'summary.json.gz');v=read(r/'verification.json');tv=read(base/'training-verification.json');held=s['heldOut'];out=[]
# Scalar CSV cells stay graph-ready; nested genetics/modes are lossless JSON cells.
def csv_rows(name,rows,columns=None):
 columns=columns or list(rows[0]);
 with (r/name).open('w',newline='')as f:
  w=csv.DictWriter(f,fieldnames=columns,extrasaction='ignore');w.writeheader()
  for row in rows:w.writerow({k:json.dumps(row.get(k),separators=(',',':'))if isinstance(row.get(k),(dict,list))else row.get(k)for k in columns})
csv_rows('held-out.csv',held)
csv_rows('trials.csv',[dict(x,evaluation_class=x.get('evaluation_class','original-training'),possible_prior_execution=x.get('possible_prior_execution',False))for x in s['trials']],list(dict.fromkeys([*s['trials'][0],'evaluation_class','possible_prior_execution'])))
def p(x):out.extend([x,''])
def table(cols,rows):out.extend(['| '+' | '.join(map(str,cols))+' |','| '+' | '.join(['---']*len(cols))+' |']+['| '+' | '.join('—'if x is None else str(x)for x in row)+' |'for row in rows]+[''])
def f(x,n=6):return None if x is None else round(x,n)
p('# VIDA 2D #103 — completed with an authorized held-out recovery exception')
p('**500 original offspring + five original founders + 15 recovery held-outs = 520 verified logical conditions.** The original held-out execution history remains unknown: some or all of those same logical conditions may have run before the runtime disconnect. The 15 new outcomes are recovery evaluations, not recovered original exact-once executions. No founder, offspring, generation or evolutionary selection was re-executed in this recovery batch.')
p('Owner authorization: [owner-recovery-authorization.md](../owner-recovery-authorization.md). The final reasonable search found no original held-out receipts in the restored filesystem, original evidence branch or prior CI artifacts. All15 unresolved conditions therefore required recovery evaluations. Original [held-out-status.json](../held-out-status.json), [runtime-loss provenance](../../proximity-targeting-v1-runtime-loss.md), training reports, immutable archives and genotype lineages are unchanged.')
p('Scientific implementation f669e09a56e41a1b1c87ff5b8c6aaa5ec266d187 and exact Worker SHA '+v['workerSha']+' are unchanged. The five selected genome hashes and birth lineages match the audited generation10 ledger. Each recovery evaluation starts from its frozen genetic genome with fresh lifetime state, 10000J actual reserve, normal mortality, the original 4800×3000 water environment and passive-work-v3 uncapped physics. Only the original environment seeds/headings811/−0.7,977/2.3,2301/π/2 are used for15s. The actual mouth capsule,90px graded transfer,80% assimilation, funded reservoir and true physical-contact flag remain unchanged. There is no selection from held-outs.')
p('## Held-out recovery outcomes')
p('The legacy17 selected specimen absorbs energy in all three held-outs, including genuine physical-contact intake in each and nonzero last5s intake. Every one of the12 MUTABLE held-outs absorbs0J: the small71/4099 training gains and1901 training feeding do not carry over to these three conditions. This is a descriptive outcome for these specimens, not an architecture-wide or causal learning/targeting advantage.')
table(['Controller','Brain seed','Environment seed','Absorbed J','Physical contact J','Noncontact J','Moving J','Paused J','Frozen J'],[[x['controller'],x['brain_seed'],x['environment_seed']]+[f(x[k])for k in ['absorbed_J','physical_contact_J','proximity_J','moving_J','paused_J','frozen_J']]for x in held])
table(['Controller','Brain seed','Training final J','811 recovery J','977 recovery J','2301 recovery J','Held-out mean J'],[[x['controller'],x['brain_seed'],f(x['final_J'])]+[f(next(y['absorbed_J']for y in held if y['controller']==x['controller']and y['brain_seed']==x['brain_seed']and y['environment_seed']==seed))for seed in [811,977,2301]]+[f(sum(y['absorbed_J']for y in held if y['controller']==x['controller']and y['brain_seed']==x['brain_seed'])/3)]for x in s['runs']])
p('These are descriptive generalization observations of five already selected specimens. Each condition has one retained recovery result; deterministic replays are verification only and are not averaged, selected, or counted as independent trials. Changing the heading also changes the resource’s closed-loop path. These three conditions do not establish population-wide reliability or a causal benefit of learning or mutation targeting.')
p('## Held-out movement and actual learning')
table(['Controller','Brain seed','Environment','Net COM px','Full path px','Last5s path px','Last5s intake J','Minimum signed gap px','Intake ticks','Contact ticks'],[[x['controller'],x['brain_seed'],x['environment_seed']]+[f(x[k],3)for k in ['displacement_px','path_px_240Hz','last5s_path_px_240Hz','last5s_absorbed_J','min_mouth_gap_px']]+[x['intake_ticks'],x['contact_ticks']]for x in held])
table(['Controller','Brain seed','Environment','Motor learned L1','Sensory learned L1','Paid learning J','Nonzero motor edges','Nonzero sensory edges','Late mode switches'],[[x['controller'],x['brain_seed'],x['environment_seed']]+[f(x[k],9)for k in ['motor_learned_L1','sensory_learned_L1','learning_cost_J']]+[x['nonzero_learned_motor'],x['nonzero_learned_sensory'],x['late_mode_switches']]for x in held])
p('Full per-tick mouth intake, contact truth, source state, reserve and chemical errors; all240Hz body/source coordinates; retinal detections; joint/mode traces; and emitted somatic changes are preserved in the full Worker packets. Paid weight changes establish that learning occurred, not that it caused better performance. Noncontact intake is reported separately and may occur while a specimen is nearly stationary. Physical contact and sustained movement are observations; no causal visual-pursuit claim follows without the appropriate control.')
# Carry forward every audited training finding, without rewriting original partial-state artifacts.
training=(base/'training-report.md').read_text();start=training.index('## Training results');end=training.index('## Runtime loss and unresolved held-outs')
p(training[start:end].strip())
p('## Final integrity audit')
p(f"The preserved training audit covers505 original packets,500 genotype histories,50 strict choices,{tv['ticks']} tick receipts,{tv['changes']} emitted learning records and1818000 body/source substeps. This recovery adds15 individually checkpointed packets,{v['ticks']} tick receipts,{v['changes']} emitted learning records and{v['bodyAndTargetSubsteps']} body/source substeps:468000 ticks and1872000 substeps across520 logical conditions. Original uncertainty is retained; an exact count of pre-disconnect executions cannot be reconstructed.")
p('Every recovery request matches the exact frozen source; all selected genomes, science/prior hashes and published training-artifact hashes are unchanged. Every recovered packet passes finite-state/schema/900tick checks, source schedule and independent240Hz capsule geometry reconstruction, real contact/strength/60J gross tick allowance/80% assimilation checks, external reservoir and reserve partition reconciliation, normal learning-mask membership and independent per-edge rewrite/upkeep accounting. No old diagnostic excludes a row. All15 full canonical actual-Worker packets replay exactly; five450+450 reset continuations reproduce final snapshot/PRNG exactly. Replays are verification only and contain no founder/offspring/training evaluations.')
table(['Recovery diagnostic','Maximum residual / value'],[[k,v[k]]for k in ['maxLearningResidual','maxExternalInputResidual','maxOralResidual','maxStrengthResidual','maxRewriteReceiptResidual','maxUpkeepReceiptResidual','maxTargetSpeed','minMovingDot']])
table(['Held-out numerical measure','Maximum'],[[k,max(abs(x[k])for x in held)]for k in ['chemical_error_J','partition_residual_J','constraint_gain_J','delivery_error','guard_loss_J','max_anchor_px','max_limit_overshoot_rad','max_linear_px_s','max_angular_rad_s']])
p('The raw inherited generic trial.reserveJ observer label can still say50000J. It is stale metadata; all actual initial requests and energy reconciliation use10000J. This disclosed frozen-code label is not edited. Finite constraint/limit/old-cap exceedances are reported rather than hidden; this is not a physical-realism certification.')
p('## Data, provenance and stopping point')
p('[graph-data.zip](graph-data.zip) contains the unchanged five evolution curves and full mutation-event/coordinate data plus all15 labelled held-outs,520-row trial summary and combined31-condition selected/founder/held-out graph trajectories. CSVs include evaluation_class and possible_prior_execution. [all-trajectories-index.json](all-trajectories-index.json) points to all505 immutable normalized training exports and all15 recovery packet/graph traces. [evidence-index.json](evidence-index.json) records per-slot immutable ZIPs/parts, SHA256/member hashes and intent/checkpoint commits. The raw ZIPs contain request, immediate received packet, interpreted packet and run log. [verification.json](verification.json) preserves full replay digests and reset evidence; split snapshots are saved in the recovery evidence branch. [manifest.json](manifest.json) hashes the final deliverables. Original data and reports remain available in the parent folder.')
p('No merge, deployment, Wiki edit, production/testing release, additional experiment or VIDA3D modification. Stop for owner review. CI links and final commit readbacks are recorded in #103/#57/draft#104.')
(r/'report.md').write_text('\n'.join(out))
# A standard plot of actual recorded values; no fitting or additional evaluation.
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
fig,axes=plt.subplots(2,1,figsize=(11,8),constrained_layout=True)
for ax,selected in zip(axes,[s['runs'],[x for x in s['runs']if x['controller']=='mutable']]):
 maximum=0
 for j,seed in enumerate([811,977,2301]):
  values=[next(y['absorbed_J']for y in held if y['controller']==x['controller']and y['brain_seed']==x['brain_seed']and y['environment_seed']==seed)for x in selected];maximum=max(maximum,*values)
  ax.bar(np.arange(len(selected))+(j-1)*.25,values,width=.24,label=str(seed))
 ax.set_ylim(0,max(1,maximum)*1.14)
 if maximum==0:
  ax.text(.5,.55,'All 12 held-outs: 0 J',transform=ax.transAxes,ha='center',fontsize=18,color='#475569')
  for i in range(len(selected)):ax.annotate('0 J × 3',(i,0),xytext=(0,8),textcoords='offset points',ha='center',fontsize=10)
 ax.set_xticks(np.arange(len(selected)),[x['controller']+' '+str(x['brain_seed'])for x in selected]);ax.set_ylabel('Absorbed nutrient energy (J)');ax.grid(axis='y',alpha=.2);ax.legend(title='Environment seed',frameon=False);ax.spines[['top','right']].set_visible(False)
axes[0].set_title('Five frozen final specimens · original three held-out conditions',loc='left');axes[1].set_title('Mutable populations · separate scale',loc='left');fig.suptitle('15 owner-authorized recovery evaluations',fontsize=16,weight='bold');fig.text(.5,-.025,'The same logical conditions may have executed before runtime loss. Seeds and mutation algorithm are confounded.',ha='center',fontsize=9)
fig.savefig(r/'held-out.png',dpi=170,bbox_inches='tight');fig.savefig(r/'held-out.svg',bbox_inches='tight');plt.close(fig)
names=['plan.json','evidence-index.json','verification.json','held-out-summary.json','summary.json.gz','trajectories.json.gz','held-out.csv','held-out-target-timelines.csv','held-out-feeding-timelines.csv','trials.csv','all-trajectories-index.json','report.md','held-out.png','held-out.svg']
with zipfile.ZipFile(r/'graph-data.zip','w',compression=zipfile.ZIP_DEFLATED)as z:
 for name in names:z.write(r/name,'recovery/'+name)
 for name in ['scores.csv','curves.json','finals.csv','mutation-statistics.csv','mutation-statistics.json','mutation-events.csv','ancestry-reuse.json','evolution-curves.png','evolution-curves.svg','training-verification.json','held-out-status.json','analysis-links.json']:z.write(base/name,'training/'+name)
 for name in ['owner-recovery-authorization.md']:z.write(base/name,name)
names+=['graph-data.zip']
manifest=[dict(path=str(r/name),bytes=(r/name).stat().st_size,sha256=hashlib.file_digest((r/name).open('rb'),'sha256').hexdigest())for name in names]
(r/'manifest.json').write_text(json.dumps(dict(completedWithRecoveryException=True,originalTrainingTrials=505,heldOutRecoveryEvaluations=15,originalExactOnceHeldOutsEstablished=False,files=manifest),indent=2)+'\n')
(r/'complete.json').write_text(json.dumps(dict(completed=True,completionBasis='owner-authorized bounded held-out recovery exception',originalTrainingTrials=505,heldOutRecoveryEvaluations=15,reusedOriginalHeldOuts=0,totalLogicalConditions=520,possiblePriorExecution=True,originalHeldOutExecutionsStarted=None,originalHeldOutExecutionsCompleted=None,trainingOutcomesReexecuted=0),indent=2)+'\n')
