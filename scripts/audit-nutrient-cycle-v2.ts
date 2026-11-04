/** Fixed follow-up protocol in #125; never repeat or overwrite recorded trials. */
import assert from 'node:assert/strict';
import {existsSync, writeFileSync, appendFileSync, openSync, fsyncSync, closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInitialWorld, collectWorldStats} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, totalAccountedEnergy} from '../persistence';
import {stepSimulation, type SimulationSettings} from '../simulation';
import {EcologyIntakeObserver} from '../ecologyAudit';
const output = 'docs/experiments/nutrient-cycle-v2.json';
const receipts = 'docs/experiments/nutrient-cycle-v2.jsonl';
if (existsSync(output) || existsSync(receipts)) throw new Error('Registered follow-up already started; preserve receipts and do not rerun');
const rows = [];
for (const seed of [17, 73]) for (const nutrientCycle of ['decay-v1', 'decay-v2'] as const) {
  const settings: SimulationSettings = {...DEFAULT_SETTINGS, physicsRegime: 'passive-work-v3',
    mouthContactModel: 'capsule-v1', ecologyRegime: 'closed-v1', nutrientLimit: null, nutrientCycle};
  const state = createInitialWorld(settings, seed, 'balanced', 'showcase'), intake = new EcologyIntakeObserver();
  const initialStateSHA256 = createHash('sha256').update(JSON.stringify(createSnapshot(state, settings).state)).digest('hex');
  const began = performance.now(); let maxErrorJ = 0;
  for (let i = 0; i < 3600; i++) {
    stepSimulation(state, settings, 1 / 60); intake.sample(state);
    maxErrorJ = Math.max(maxErrorJ, Math.abs(totalAccountedEnergy(state) - state.energyPool!.budget));
  }
  const row = {seed, nutrientCycle, seconds: 60, initialStateSHA256, ...collectWorldStats(state, settings.targetNutrients),
    absorbedJ: intake.totals(), reserveJ: state.energyPool!.reserve, maxErrorJ, kernelAndObservationMs: performance.now() - began};
  appendFileSync(receipts, JSON.stringify(row) + '\n'); const fd = openSync(receipts, 'r'); fsyncSync(fd); closeSync(fd);
  rows.push(row); console.log(JSON.stringify(row)); assert.ok(maxErrorJ < 1e-6);
}
writeFileSync(output, JSON.stringify({protocol: 'issue-125-v2-follow-up', base: '4fb0b0fa4da094c37e3b140920f1b6cacd1e9283', rows,
  limitations: ['One new pair per seed; no selection, reruns or baseline refresh. Original v1 evidence remains unchanged.',
    'Short paired outcomes and single sequential timing observations do not demonstrate sustainable ecology or controlled browser performance.']}, null, 2) + '\n');
