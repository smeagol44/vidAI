const root=process.argv[2];
const sim=await import(root+'/simulation.ts'),p=await import(root+'/persistence.ts'),f=await import(root+'/founders.ts'),w=await import(root+'/world.ts');
const output={};
for(const mode of ['plain','masked','learned','masked-learned']){
 const config={...p.LEGACY_SETTINGS,targetNutrients:0,inflowRate:0,mutationSeverity:0};
 const state=w.createInitialWorld(config,711,'balanced','standard',0),g=f.createFounderGenome('FND-001');
 if(mode.includes('learned'))Object.assign(g,{plasticityRate:.8,sensoryPlasticityRate:.8,memoryConsolidationRate:2,plasticMotorScope:'all'});
 if(mode.includes('masked'))sim.mutateBrainTopology(g,'wire-retinal-turn',new sim.XoshiroPRNG(13));
 w.addExternalOrganism(state,g,config,1200,750,0);
 state.nutrients.push({id:'meal',x:1280,y:750,vx:0,vy:0,kind:'nutrient',energyValue:3000,radius:18,bottomTimer:0,pulseTimer:0});state.ledger.externalInflow+=3000;
 for(let t=0;t<120;t++)sim.stepSimulation(state,config,1/60);
 output[mode]=p.createSnapshot(state,config);
}
for(const id of ['CUR-001','CUR-006','CUR-003']){
 const config={...p.DEFAULT_SETTINGS,physicsRegime:id==='CUR-003'?'legacy-v0':'surface-work-v1',targetNutrients:0,inflowRate:0,mutationSeverity:0};
 let state=w.createInitialWorld(config,id==='CUR-003'?311:711,'balanced','standard',0);
 const g=f.createFounderGenome(id,'balanced',id==='CUR-003'?{locomotion:'catalogue'}:{});
 w.addExternalOrganism(state,g,config,1200,750,id==='CUR-003'?0:.37);
 for(let t=0;t<120;t++){
  if(t===40&&id==='CUR-003')state=p.restoreSnapshot(p.createSnapshot(state,config)).state;
  sim.stepSimulation(state,config,1/60);
 }
 output[id]=p.createSnapshot(state,config);
}
process.stdout.write(JSON.stringify(output));
