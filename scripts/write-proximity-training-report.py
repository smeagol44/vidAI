"""Read-only derived deliverables for original505 training packets. Held-outs unresolved."""
from pathlib import Path
import json,gzip,csv,zipfile,hashlib,os,math,subprocess
r=Path('docs/experiments/proximity-targeting-v1')
s=json.loads((r/'summary.json').read_text());v=json.loads((r/'training-verification.json').read_text())
assert len(s['trials'])==505 and len(s['curves'])==55 and not s['heldOut']
held={'status':'unresolved after execution-runtime loss','intentCommit':'48f75676257297be155f71454c7d2b6cfea47992','lastCompleteTrainingEvidence':'5cefc73c3eecc22c0412319c620717be4d4ec3c7','numberStarted':None,'numberCompleted':None,'verifiedReceipts':0,'notReexecuted':True,'slots':[dict(controller=x['controller'],brainSeed=x['brain_seed'],environmentSeed=seed,heading=heading,status='unresolved; not imputed as zero')for x in s['runs']for seed,heading in [(811,-.7),(977,2.3),(2301,math.pi/2)]]}
(r/'held-out-status.json').write_text(json.dumps(held,indent=2)+'\n')
evidence='48f75676257297be155f71454c7d2b6cfea47992'
names=subprocess.check_output(['git','ls-tree','-r','--name-only',evidence,'--','checkpoints/'],text=True).splitlines();checkpoints=[]
for path in sorted(p for p in names if p.endswith('.json')):
 d=json.loads(subprocess.check_output(['git','show',evidence+':'+path]))
 d['descriptorPath']=path;d['commit']=subprocess.check_output(['git','log','-1','--format=%H','--diff-filter=A',evidence,'--',path],text=True).strip();checkpoints.append(d)
assert len(checkpoints)==56
(r/'evidence-index.json').write_text(json.dumps({'verifiedTrainingPackets':505,'offspring':500,'founders':5,'checkpointCount':56,'lastCompletedHead':held['lastCompleteTrainingEvidence'],'pendingHeldOutIntentHead':evidence,'checkpoints':checkpoints},indent=2)+'\n')
out=[]
def p(x):out.extend([x,''])
def table(cols,rows):out.extend(['| '+' | '.join(map(str,cols))+' |','| '+' | '.join(['---']*len(cols))+' |']+['| '+' | '.join('—'if x is None else str(x)for x in row)+' |'for row in rows]+[''])
def f(x,n=6):return None if x is None else round(x,n)
p('# Graded moving nutrient and inherited mutation targeting — training complete; experiment incomplete')
p('**All 500 original offspring, five founders and 50 strict generation decisions are preserved and audited. The 15 held-outs are unresolved after the execution runtime disconnected. None was repeated or assigned a zero score.**')
p('Scientific implementation: f669e09a56e41a1b1c87ff5b8c6aaa5ec266d187. Preregistered protocol: d01d1fd1359b27ee4b8df6bd39356d0071717fb1, based on completed #101 at a44515e27cc82294fcb55cbadf523351e545b09d. Issue #103 and draft #104 remain unmerged.')
p('## Training results')
table(['Controller','Seed','Mutation algorithm','Founder J','Final J','Contact J','Noncontact J','Selected at','Improvements'],[[x['controller'],x['brain_seed'],x['mutation_algorithm'],f(x['founder_J']),f(x['final_J']),f(x['final']['physical_contact_J']),f(x['final']['proximity_J']),x['selected_at'],len(x['improvements'])]for x in s['runs']])
p('MUTABLE17 retains its unchanged founder if its final score remains zero. The other rows identify the actual selected offspring. All replacements required strictly greater actual absorbed J. Zero ties retain the parent; all ten siblings use the same frozen genetic parent. No old physical diagnostic excluded or penalized an offspring.')
p('The standard MUTABLE populations are seeds17/1901; the custom populations are71/4099. Seeds differ between the two groups, so their outcomes cannot establish a causal targeting advantage. The legacy comparison also changes architecture and learning genetics. Results are individual descriptive observations.')
p('## All five generation curves')
keys=[(x['controller'],x['brain_seed'])for x in s['runs']]
table(['Generation']+[c+' '+str(seed)for c,seed in keys],[[g]+[f(next(x['selected_absorbed_J']for x in s['curves']if x['controller']==c and x['brain_seed']==seed and x['generation']==g))for c,seed in keys]for g in range(11)])
p('scores.csv and curves.json preserve all55 points at full precision. evolution-curves.png/.svg plot those values without fitting or smoothing.')
p('## Real feeding and movement')
p('The explicit proximity-90-v1 mode uses d=max(0, distance from source center to the actual mouth-capsule segment minus the two radii), then strength=clamp(1-d/90,0,1). One original gross mouth budget is scaled by strength and constrained by stock, remaining allowance and reserve capacity. Physical contact uses that same transfer, without a second bite. Eighty percent assimilates; the rest is heat. Gross removal is explicitly funded by external reservoir input while visible stock stays3000J/radius18. Contact input is true only for physical geometry; mouth intake and body feeding use actual received energy. Ordinary contact-only feeding is unchanged outside this isolated mode.')
table(['Controller','Seed','Net COM px','Full15s path px','Last5s path px','Signed minimum mouth gap px','Contact ticks','Intake ticks','Detection ticks'],[[x['controller'],x['brain_seed']]+[f(x['final'][k],3)for k in ['displacement_px','path_px_240Hz','last5s_path_px_240Hz','min_mouth_gap_px']]+[x['final'][k]for k in ['contact_ticks','intake_ticks','detection_ticks']]for x in s['runs']])
table(['Controller','Seed','Feeding duration s','COM path in intake ticks px','Mean COM speed in intake ticks px/s','Last5s intake J','Intake-weighted gap px','Intake-weighted strength'],[[x['controller'],x['brain_seed']]+[f(x['final'].get(k),6)for k in ['feeding_duration_s','com_path_in_intake_ticks_px','mean_com_speed_in_intake_ticks_px_s','last5s_absorbed_J','intake_weighted_gap_px','intake_weighted_strength']]for x in s['runs']])
p('Signed raw gap is negative for physical overlap; feeding uses its nonnegative clamp. Motion in an intake tick means motion over the preceding1/60s interval ending in actual absorption. These movement metrics never influence selection. High noncontact intake can reflect remaining close to food and does not demonstrate physical mouth contact or active pursuit.')
for x in s['runs']:
 z=x['final'];a=x['founder']
 p(f"{x['controller']} {x['brain_seed']}: founder→final full COM path {a['path_px_240Hz']:.6f}→{z['path_px_240Hz']:.6f}px; net displacement {a['displacement_px']:.6f}→{z['displacement_px']:.6f}px. Final moving/paused/frozen intake is {z['moving_J']:.6f}/{z['paused_J']:.6f}/{z['frozen_J']:.6f}J.")
p('## Mutation targeting and lineage')
p('Every child has eight ordered scalar receipts with stable IH/HH/HO/hidden-bias/output-bias identities, before/after values, repeated coordinates and genetic parent hash. Target sets contain only the distinct net changed coordinates from the selected parent’s own birth. Founder origin is null, so its children use exact original random mutation in any generation. Birth metadata remains outside genomes and neural inputs; acquired lifetime deltas never become targets or pass to newborns.')
p('For an eligible custom child, a separate deterministic stream requests five targets with72% probability or six with28%, expected5.28/8=66%. Parental coordinates are sampled without replacement; shortfalls are filled uniformly outside the parent set. Other events remain random outside that set, with replacement. The original Gaussian stream consumes the same coordinate and two Box–Muller draws for each of the eight sigma.15 events. Bounds and the original nine-draw inherited-plasticity mechanism remain unchanged. Policy targeting and actual coordinate membership are reported separately for standard random children.')
stats=[]
for c,seed in keys:
 ms=[m for m in s['mutationStats']if m['controller']==c and m['brain_seed']==seed]
 eligible=[m for m in ms if m['algorithm']=='parent-targeted-66'and not m['parent_was_founder']and m['parent_distinct_coordinates']>0]
 n=sum(m['targeted_events']for m in ms)
 stats.append([c,seed,ms[0]['algorithm'],sum(m['parent_was_founder']for m in ms),len(eligible),n,800-n,f(100*n/800,3),f(100*n/(8*len(eligible)),3)if eligible else None,sum(m['requested_targets']==5 for m in eligible),sum(m['requested_targets']==6 for m in eligible)])
table(['Controller','Seed','Algorithm','Founder-parent children','Eligible custom children','Target events','Other events','Overall target %','Eligible target %','Requested5','Requested6'],stats)
reuse=[]
for c,seed in keys:
 previous=set()
 for a in s['selectedAncestry']:
  if a['controller']!=c or a['brain_seed']!=seed:continue
  ids=set(a['changedCoordinates']);reuse.append(dict(controller=c,seed=seed,generation=a['generation'],child=a['child'],netChanged=len(ids),reusedFromEarlierSelectedBirths=len(ids&previous),newToSelectedAncestry=len(ids-previous)));previous|=ids
(r/'ancestry-reuse.json').write_text(json.dumps(reuse,indent=2)+'\n')
p('mutation-statistics.csv/.json contains500 child summaries and exact current-parent coordinate sets. mutation-events.csv contains4000 ordered events, including reconstructed unbounded Gaussian values and applied deltas. training-ledger.json.gz preserves full origin records, rounding/selection draws, all trait/mask attempts and all50 choices. Ancestry reuse is observational; the mutation algorithm never targets the cumulative ancestry union.')
p('## Actual learning and physical motor delivery')
table(['Controller','Seed','Motor learned L1','Sensory learned L1','Nonzero motor/sensory edges','Learning cost J','Physical OSC samples','Late mode switches'],[[x['controller'],x['brain_seed'],f(x['final']['motor_learned_L1'],9),f(x['final']['sensory_learned_L1'],9),str(x['final']['nonzero_learned_motor'])+'/'+str(x['final']['nonzero_learned_sensory']),f(x['final']['learning_cost_J'],9),x['final']['physical_oscillator_samples'],x['final']['late_mode_switches']]for x in s['runs']])
table(['Controller','Seed','Motor upkeep J','Motor rewrites J','Sensory upkeep J','Sensory rewrites J','Mode substeps','Motor work heat J'],[[x['controller'],x['brain_seed']]+[f(x['final'].get(k),9)for k in ['motor_learning_upkeep_J','motor_learning_rewrite_J','sensory_learning_upkeep_J','sensory_learning_rewrite_J']]+[json.dumps(x['final']['modes'],sort_keys=True),f(x['final']['motor_work_heat_J'],9)]for x in s['runs']])
p('Legacy retains native servo semantics, rather than neural DIRECT/OSC labels. Hybrid OSC counts require actual nonzero delivered torque. Eligible masks, genetic learning rates, paid rewrites/upkeep and acquired state remain in the data. Per-edge changes independently reconstruct learning charges. Emitted zero initialization records are not evidence of nonzero learning. No learning-OFF ablation was authorized or run, so a causal learning benefit is not isolated.')
p('## Energy,environment and numerical audit')
p('All #101 conditions remain: original CUR-001 body/eyes/mouth,4800×3000,root2400/1500,training heading.37,env73,water.18,gravity0,passive-work-v3,normal mortality and funded10000J initial reserve. One source starts120px ahead of the mounted forward eye. The unchanged separate environmental stream presamples ten1.5s decisions with25%STOP,22px/s outward/sideways motion, inward-heading pause and permanent swept405px union-of-eye-disks freeze. No source coordinates or force are supplied to the brain/body.')
p('Only the original400px/s and±20rad/s experimental clamps are disabled. Constraints,contacts,drag,actuators,strength and prepaid work remain. Finite solver anchor/joint residuals are disclosed imperfections; consistency does not establish complete physical realism.')
table(['Diagnostic','All505 verified training trials'],[[k,max(abs(x[k])for x in s['trials'])]for k in ['max_linear_px_s','max_angular_rad_s','max_anchor_px','max_limit_overshoot_rad','constraint_gain_J','delivery_error','chemical_error_J','partition_residual_J']]+[['Actual clamp loss J',sum(x['guard_loss_J']for x in s['trials'])],['Alive trials',sum(x['alive']for x in s['trials'])],['Former-flagged offspring',s['offspring']['oldFlagged']],['External-input reconciliation J',v['maxExternalInputResidual']],['Normalized oral-input residual J',v['maxOralResidual']],['Learning reconciliation J',v['maxLearningResidual']],['Per-edge rewrite receipt residual J',v['maxRewriteReceiptResidual']],['Per-edge upkeep receipt residual J',v['maxUpkeepReceiptResidual']]])
p('The inherited generic trial.reserveJ metadata label remains50000J from an older helper. Actual initial reserve is verified as10000J in every original request; stocks,expenditure and conservation calculations use those actual values. The stale label never affects physics or selection, and raw evidence is unchanged.')
caps=[]
for c,seed in keys:
 rows=[x for x in s['trials']if x['controller']==c and x['brain_seed']==seed]
 caps.append(dict(controller=c,seed=seed,trialCount=len(rows),stages={k:{name:sum(x['former_cap_stages'][k][name]for x in rows)for name in ['samples','linearExceedances','angularExceedances']}for k in ['forces','contact']}))
(r/'former-cap-exceedances.json').write_text(json.dumps({'scope':'Part/stage samples,not distinct organisms or selection exclusions','runs':caps},indent=2)+'\n')
p('## Comparison with original #101')
p('Original #101 used physical-contact-only feeding: all520 trials0J,no contact,no improvement and unchanged founders. The new90px rule changes real energy acquisition and its normal learning signal. Standard-random populations differ in that feeding rule; custom populations additionally change mutation targeting after an evolved parent exists. These are descriptive task differences, not evidence for a causal algorithm or architecture ranking.')
p('## Runtime loss and unresolved held-outs')
p('After all500 offspring were independently checkpointed, intent48f75676257297be155f71454c7d2b6cfea47992 was published for the15 held-outs. The execution service disconnected during a subsequent local operation. The available error does not identify whether the local intent receipt or the held-out process was active. No completed held-out checkpoint is remote. It is therefore unknown how many of the15 started or completed locally. No score is imputed and none is re-executed.')
p('Recover the original runtime’s requests,packets,received receipts,champions and056-held-outs log/ZIP. If those cannot be recovered, an explicit owner decision is required before any uncertain held-out slot can be executed again. No offspring may be rerun. This experiment is not marked complete.')
p('## Verified evidence and deliverables')
p(f"The cloud recovery audit reads all{v['packets']} original packets,500 exact genotypes/mutation histories,50 choices,{v['ticks']} tick receipts and{v['packets']*3600} full-body/source substeps. Five final-training canonical Worker packets and five450+450 reset continuations match exactly. These are verification only and do not add or replace scientific outcomes. Frozen source,Worker and protected historical hashes match.")
p('Fifty-six immutable original checkpoints preserve frozen sources,allfive founders andall50 generations. Each was independently Git-downloaded and part/ZIP/member-verified before advancing. evidence-index.json identifies descriptors and introduction commits. The primary complete-training head is5cefc73c3eecc22c0412319c620717be4d4ec3c7;48f7567 adds only the unresolved held-out intent.')
p('scores.csv/curves.json: all55 curve points. finals.csv/trials.csv/summary.json.gz: all505 verified outcomes,founder/final comparisons,feeding,movement,learning,traits/masks and diagnostics. mutation-statistics.csv/.json,mutation-events.csv and ancestry-reuse.json: all500 birth histories and4000 scalar events. trajectories.json.gz: every founder and selected improvement,with3601 body/source points and900 feeding/ray samples. Five normalized trajectory ZIPs contain all505 original full-body/source trajectories,101 per population,plus feeding,rays,decisions and mode/joint traces; all-trajectories-index.csv/.json records each file hash. Raw primary packets remain independently restorable.')
p('training-graph-data.zip is CRC/member/count verified and contains copyable CSV/JSON graph inputs. training-verification.json and training-completion.json document the audit and its limited scope. The initial355-test fast suite+metadata/build,production and focused Worker checks passed. Initial PR CI automatically ran an archived locomotion regression/browser smoke; exclusions now keep those separate from final branch checks.')
p('STOP for original-receipt recovery and owner review. No merge,deployment,Wiki edit,production/testing release change,extra experiment orVIDA3D change.')
(r/'training-report.md').write_text('\n'.join(out)+'\n')
names=['scores.csv','curves.json','finals.csv','trials.csv','target-timelines.csv','feeding-timelines.csv','mutation-statistics.csv','mutation-events.csv','mutation-statistics.json','ancestry-reuse.json','held-out-status.json','all-trajectories-index.csv','all-trajectories-index.json']
tmp=r/'training-graph-data.building.zip'
with zipfile.ZipFile(tmp,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for name in names:z.write(r/name,name)
 z.writestr('README.txt','500 original offspring +5 founders verified.15 held-outs unresolved after runtime loss; none imputed or repeated.90px real feeding;physical contact separate. Seeds confound mutation algorithm. STOP for receipt recovery/owner review.\n')
with tmp.open('rb')as f:os.fsync(f.fileno())
with zipfile.ZipFile(tmp)as z:
 assert z.testzip()is None
 for name in names:assert z.read(name)==(r/name).read_bytes()
os.replace(tmp,r/'training-graph-data.zip')
fd=os.open(r,os.O_RDONLY);os.fsync(fd);os.close(fd)
print(json.dumps({'trainingReportWritten':True,'experimentComplete':False,'heldOutUnresolved':15,'graphZipSHA256':hashlib.file_digest((r/'training-graph-data.zip').open('rb'),'sha256').hexdigest()}))
