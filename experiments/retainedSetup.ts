/** Private t=0 counterfactual copies of the frozen torque-audit organisms. */
import {torqueAuditSource,TORQUE_AUDIT_CONDITIONS} from './torqueAuditSetup';
import {makeRetainedGenome} from './retainedHead';
import {createSnapshot,restoreSnapshot} from '../persistence';
export type RetainedVariant='retained-legacy'|'retained-first-signed'|'retained-all-signed';
export function retainedSource(id:string,variant:RetainedVariant){
 const c=TORQUE_AUDIT_CONDITIONS[0],r=restoreSnapshot(torqueAuditSource(id,'legacy-six-output',c));
 const o=r.state.organisms[0],ids=o.genome.parts.slice(1).map(p=>p.id);
 if(o.age!==0||o.neuralHidden.some(x=>x!==0)||o.learnedMotorWeights||o.learnedSensoryWeights)throw new Error('Untouched newborn fixture required');
 o.genome=makeRetainedGenome(o.genome,c.seed,variant==='retained-legacy'?[]:variant==='retained-first-signed'?ids.slice(0,1):ids);
 o.neuralOutputs=o.genome.outputKeys!.map(()=>0);o.joints.forEach(j=>j.gateMode='direct');
 for(const row of r.state.lineage.values())if(row.genome.id===o.genome.id)row.genome=structuredClone(o.genome);
 r.settings.motorExperiment='retained-head-v1';
 return createSnapshot(r.state,r.settings);
}
/** Read-only assertion projection, NEVER a save converter or simulation input. */
export function legacyComparisonSnapshot(snapshot:ReturnType<typeof createSnapshot>){
 const s=structuredClone(snapshot);s.schemaVersion='16.0.0';s.settings.motorExperiment='gated-torque-v1';
 const project=(g:typeof s.state.organisms[number]['genome'])=>{
  if(g.motorController?.version!=='retained-head-v1')return;
  const ix=g.outputKeys!.map((k,i)=>/:(Mode|DirectTorque|OscillatorStrength)$/.test(k)?-1:i).filter(i=>i>=0);
  g.weightsHO=ix.map(i=>g.weightsHO[i]);g.biasesO=ix.map(i=>g.biasesO[i]);g.outputKeys=ix.map(i=>g.outputKeys![i]);delete g.motorController;
 };
 for(const o of s.state.organisms){const keys=o.genome.outputKeys!;o.neuralOutputs=keys.flatMap((k,i)=>/:(Mode|DirectTorque|OscillatorStrength)$/.test(k)?[]:[o.neuralOutputs[i]]);project(o.genome);o.joints.forEach(j=>delete j.gateMode);}
 for(const e of s.state.eggs)project(e.genome);
 for(const [,entry] of s.state.lineage)project(entry.genome);
 return s;
}
