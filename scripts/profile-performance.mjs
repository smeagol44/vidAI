import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Session} from 'node:inspector/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root = resolve(process.argv[2] ?? '.');
const sim = await import(pathToFileURL(resolve(root, 'simulation.ts')).href);
const {createInitialWorld, addExternalOrganism} = await import(pathToFileURL(resolve(root, 'world.ts')).href);
const {createFounderGenome} = await import(pathToFileURL(resolve(root, 'founders.ts')).href);
const {DEFAULT_SETTINGS, createSnapshot} = await import(pathToFileURL(resolve(root, 'persistence.ts')).href);
// Pin historical founder alleles so new starter calibrations do not silently
// replace the worlds used to assert exact saved-kernel continuation.
function catalogueWorld(settings, count) {
  const state = createInitialWorld(settings, 711, 'balanced', 'standard', count);
  for (const org of state.organisms) {
    org.genome = createFounderGenome(org.genome.id, 'balanced', {locomotion: 'catalogue', foraging: 'catalogue'});
    org.joints.forEach((joint, i) => {joint.phase = org.genome.parts[i + 1].cpgPhaseOffset || 0;});
    state.lineage.get(org.id).genome = org.genome;
  }
  return state;
}
const golden = {
  'generation-6-34': '88884af87b30310bd79543fa2209012b0b4da03335cef9e7750c9232e08530ab',
  'founders-15': 'de3c9130159af23590db2b385c2d11c338f2882f5e64f0eb4c756db4fa71b672',
  'generation-2-30': 'd83bcecee1ce65b208cb901724071a9754f96ea65a3d33fcc1614dae43441cb0',
  'blocked-eggs': '895f4cc9937245e25344b2a2eb33cc92754b7d895e36b2bd388f81b3f1d4a28d',
};
const reports = [];
for (const scenario of ['founders-15', 'generation-2-30', 'blocked-eggs', 'generation-6-34']) {
  const generationSix = scenario === 'generation-6-34';
  const settings = {...DEFAULT_SETTINGS, targetNutrients: generationSix ? 272 : 200,
    inflowRate: 0, maxOrganisms: 100};
  const state = catalogueWorld(settings, scenario === 'founders-15' ? 15 : 0);
  if (scenario !== 'founders-15') {
    const donors = catalogueWorld(settings, generationSix ? 34 : 30).organisms;
    donors.forEach((donor, i) => {
      let genome = donor.genome;
      for (let generation = 0; generation < (generationSix ? 5 : 2); generation++) genome = sim.mutateGenome(genome, .25, state.prng);
      addExternalOrganism(state, genome, settings, 150 + i % 6 * 380, 150 + Math.floor(i / 6) * 260, 0);
    });
  }
  state.simTime = 100;
  for (const org of state.organisms) {org.age = org.genome.maturityAge + 1; org.lastReproductionTime = 100;}
  if (scenario === 'blocked-eggs' || generationSix) for (let i = 0; i < (generationSix ? 27 : 75); i++) {
    const org = state.organisms[i % state.organisms.length], g = structuredClone(org.genome);
    state.eggs.push({id: 'profile-egg-' + i, clutchId: 'profile', parentOrgId: org.id,
      x: org.segments[0].x, y: org.segments[0].y, vx: 0, vy: 0, genome: g,
      fundedStructural: g.bodyCost, fundedReserve: 10000, incubationProgress: generationSix && i % 3 ? .5 : 1,
      totalIncubationTime: 10, pulseTimer: 0, colorHue: g.hue, readyToHatch: true, hatchHeading: 0});
    state.ledger.externalInflow += g.bodyCost + 10000;
  }
  for (let i = 0; i < (generationSix ? 3 : 180); i++) {
    state.nutrients.push({id: 'profile-remains-' + i, kind: 'carrion',
      x: state.prng.range(40, 2360), y: state.prng.range(40, 1460), vx: 0, vy: 0,
      energyValue: 3000, radius: 18, decayTimeRemaining: 60, bottomTimer: 0, pulseTimer: 0});
    state.ledger.externalInflow += 3000;
  }
  const session = new Session(); session.connect();
  await session.post('Profiler.enable');
  await session.post('Profiler.setSamplingInterval', {interval: 500});
  for (let i = 0; i < 20; i++) sim.stepSimulation(state, settings, 1 / 60);
  await session.post('Profiler.start');
  const start = performance.now();
  for (let i = 0; i < 120; i++) sim.stepSimulation(state, settings, 1 / 60);
  const milliseconds = performance.now() - start;
  const {profile} = await session.post('Profiler.stop'); session.disconnect();
  const nodes = new Map(profile.nodes.map(n => [n.id, n])), parents = new Map();
  for (const n of profile.nodes) for (const child of n.children ?? []) parents.set(child, n.id);
  const totals = {}, self = {};
  for (const id of profile.samples ?? []) {
    const node = nodes.get(id), name = node?.callFrame.functionName || '(anonymous)';
    self[name] = (self[name] ?? 0) + 1;
    let current = id, category = 'other';
    while (current !== undefined) {
      const fn = nodes.get(current)?.callFrame.functionName;
      if (fn === 'evaluateOrganismBrain') {category = 'neural-evaluation'; break;}
      if (fn === 'resolveBodyContacts') {category = 'contacts'; break;}
      if (fn === 'advanceOrganismPhysics') {category = 'joint-and-drag-physics'; break;}
      if (fn === 'hatchPlacement') {category = 'hatch-clearance'; break;}
      if (fn === 'mutateGenome') {category = 'mutation'; break;}
      if (fn === 'stepSimulation') category = 'vision-brain-feeding-and-other-kernel';
      current = parents.get(current);
    }
    totals[category] = (totals[category] ?? 0) + 1;
  }
  const samples = profile.samples?.length || 1;
  const percentages = Object.fromEntries(Object.entries(totals).map(([name, n]) => [name, Math.round(1000 * n / samples) / 10]));
  const stateHash = createHash('sha256').update(JSON.stringify(createSnapshot(state, settings).state)).digest('hex');
  assert.equal(stateHash, golden[scenario], 'Complete v0.31 state continuation must remain exact');
  const report = {root, scenario, milliseconds: Math.round(milliseconds),
    stepsPerSecond: Math.round(120000 / milliseconds), creatures: state.organisms.length, eggs: state.eggs.length,
    stateHash, exactStateMatch: true,
    parts: state.organisms.reduce((n,o)=>n+o.segments.length,0),
    eyes: state.organisms.reduce((n,o)=>n+o.genome.eyes.length,0),
    hiddenNeurons: state.organisms.reduce((n,o)=>n+o.genome.hiddenIds.length,0),
    samplePercent: percentages,
    kernelLines: profile.nodes.filter(n => n.callFrame.functionName === 'stepSimulation')
      .flatMap(n => n.positionTicks ?? []).sort((a,b) => b.ticks-a.ticks).slice(0,10),
    topSelf: Object.entries(self).sort((a,b) => b[1]-a[1]).slice(0,12)};
  reports.push(report); console.log(JSON.stringify(report));
}

if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(reports));
