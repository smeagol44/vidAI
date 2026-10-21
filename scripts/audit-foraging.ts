import {writeFile} from 'node:fs/promises';
import {runTwinOarApproach, runTwinOarScatteredPair, TWIN_OAR_APPROACH_CONDITIONS,
  type TwinOarCondition} from '../foragingAudit';
import {BUILD_VERSION} from '../persistence';
const modes: TwinOarCondition[] = ['catalogue', 'current', 'gait-only', 'retinal-disconnected'];
const approach = modes.flatMap(mode => TWIN_OAR_APPROACH_CONDITIONS.map(c => runTwinOarApproach(mode, c)));
const scattered = [17, 29, 41].map(runTwinOarScatteredPair);
const report = {protocol: 'twin-oar-foraging-v1', build: BUILD_VERSION, approach, scattered,
  limitations: 'Controlled food approach plus three short scattered-food worlds. Natural intake varies by seed; no demonstrated robust ecology, earned Twin Oar reproduction or learning benefit. Physics and food economics unchanged.'};
for (const mode of modes) {
  const rows = approach.filter(r => r.condition === mode);
  console.log(JSON.stringify({condition: mode, fed: rows.filter(r => r.absorbedJ > 0).length,
    trials: rows.length, totalAbsorbedJ: rows.reduce((s, r) => s + r.absorbedJ, 0)}));
}
console.log(JSON.stringify({scattered}));
const output = process.argv.indexOf('--output');
if (output >= 0) {
  if (!process.argv[output + 1]) throw new Error('--output requires a file path');
  await writeFile(process.argv[output + 1], JSON.stringify(report, null, 2) + '\n');
}
