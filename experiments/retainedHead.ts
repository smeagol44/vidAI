/** Explicit offspring/offline construction, never a historical-save migration.
 * Keep old six-output policy under its OLD controller; no torque interpretation
 * is assigned to legacy weights. Each joint can inherit a separate signed head. */
import {remapBrain,type Genome} from '../simulation';
import {makeGatedGenome} from './gatedGenome';

export function makeRetainedGenome(parent:Genome,seed:number,signedJoints:string[]=[]):Genome {
 if(parent.motorController)throw new Error('Retained-head construction requires a legacy parent');
 if(new Set(signedJoints).size!==signedJoints.length || signedJoints.some(id=>!parent.parts.slice(1).some(p=>p.id===id)))
  throw new Error('Invalid retained joint selectors');
 const g=structuredClone(parent);
 g.motorController={version:'retained-head-v1',architecture:'three-output',hysteresisWidth:.06,signedJoints:[...signedJoints]};
 remapBrain(g,parent);
 // SAME pre-existing, unselected latent-head distribution/seed. No old row is
 // copied to a new semantic role; all old rows are preserved by identity.
 const latent=makeGatedGenome(parent,'three-output',.06,seed);
 for(let i=0;i<latent.outputKeys!.length;i++){
  const row=g.outputKeys!.indexOf(latent.outputKeys![i]);
  g.weightsHO[row]=[...latent.weightsHO[i]];g.biasesO[row]=latent.biasesO[i];
 }
 return g;
}
