// Diagnostic replay of the existing fixtures, outside the production graph.
// Run from an installed checkout; the eight expanded placements are fixed.
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = resolve(process.argv[2]);
const scenario = process.argv[3];
const cases = {
  learning: ['learned-physical-outcome', "test('real learned", "console.log(JSON.stringify([{seed:711,side:0,d:120},{seed:711,side:-34,d:130},{seed:711,side:34,d:130},{seed:733,side:0,d:130}].map(x=>followup(x.seed,x.side,x.d))));"],
  expanded: ['learned-physical-outcome', "test('real learned", 'console.log(JSON.stringify([100,160].flatMap(d=>[-52,-16,16,52].map(side=>followup(711,side,d)))));'],
  hunter: ['moving-hunter', "test('a mobile", "console.log(JSON.stringify({mobile:[1,1.5,2.2].flatMap(s=>[82,94,106,118,130].flatMap(d=>['connected','disconnected'].map(r=>trial(r,s,d)))),multi:['FND-001','FND-006','FND-021','FND-031','FND-051'].flatMap(id=>[3,6,9].flatMap(d=>['connected','disconnected'].map(r=>trial(r,1.5,d,0,id,120,true))))}));"],
};
let source;
if (scenario === 'foraging') {
  source = `import {runTwinOarApproach,TWIN_OAR_APPROACH_CONDITIONS} from '${pathToFileURL(join(root, 'foragingAudit.ts'))}';\nconsole.log(JSON.stringify(TWIN_OAR_APPROACH_CONDITIONS.map(c=>['current','catalogue','gait-only','retinal-disconnected'].map(m=>runTwinOarApproach(m as any,c)))));`;
} else {
  if (!cases[scenario]) throw new Error('Expected learning, expanded, hunter or foraging');
  const [file, marker, ending] = cases[scenario];
  const original = readFileSync(join(root, 'tests', file + '.test.ts'), 'utf8').replaceAll('test.skip(', 'test(');
  if (!original.includes(marker)) throw new Error('Fixture marker changed; inspect before replay');
  source = original.split(marker)[0].split('\n').filter(line => !line.startsWith('// PAUSED')).join('\n');
  source = source.replace(/from '\.\.\/([^']+)'/g, (_, file) => `from '${pathToFileURL(join(root, file))}'`);
  if (scenario === 'hunter') {
    source = source.replace('let biteJ=0,hitTicks=0,peakSignal=0,headDelta=0;', 'let biteJ=0,hitTicks=0,peakSignal=0,headDelta=0,maxDx=0,motorJ=0;');
    source = source.replace('const taken=prey.biteFeedbackJ??0;', 'maxDx=Math.max(maxDx,Math.abs(sim.calculateOrganismCOM(hunter).x-hunterStart.x));motorJ+=(hunter.motorEnergyRate??0)/60;const taken=prey.biteFeedbackJ??0;');
    source = source.replace('return {response,hunterSpeed,', 'return {maxDx,motorJ,bodyCost:hunter.genome.bodyCost,biomass:hunter.structuralBiomass,initialReserve:10000,finalParts:hunter.segments,finalJoints:hunter.joints,response,hunterSpeed,');
  }
  source += '\n' + ending;
}
const scratch = mkdtempSync(join(tmpdir(), 'vida-test-diagnosis-'));
try {
  const file = join(scratch, 'replay.ts');
  writeFileSync(file, source);
  const run = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), file], {cwd: root, encoding: 'utf8'});
  process.stdout.write(run.stdout ?? '');
  process.stderr.write(run.stderr ?? '');
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(scratch, {recursive: true, force: true});
}
