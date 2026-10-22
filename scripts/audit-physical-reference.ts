import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createFounderGenome, FEATURED_BLUEPRINTS} from '../founders';
import {CURRENT_COMMENT_REFERENCE, fixedDepthReference, inspectPart, inspectReference, reynolds} from '../physicalReferenceAudit';

// No simulation ticks, mutations, new selection or old report replacement.
const current = inspectReference(CURRENT_COMMENT_REFERENCE);
assert.ok(Math.abs(current.currentWorkFactorRatio - 1) < 1e-14);
const bodies = FEATURED_BLUEPRINTS.map(({id}) => ({id,
  parts: createFounderGenome(id).parts.map(p => inspectPart(p, .18, CURRENT_COMMENT_REFERENCE))}));
const parts = bodies.flatMap(b => b.parts);
const proposed = inspectReference(fixedDepthReference(.001, 1, 1000, .007));
const scenario = (label: string, metresPerPixel: number) => ({label, metresPerPixel,
  // Illustrative 35-pixel part at 50 px/s, NOT measured COM/face speed or selected law.
  lengthM: 35 * metresPerPixel, speedMS: 50 * metresPerPixel,
  reynolds: reynolds(35 * metresPerPixel, 50 * metresPerPixel, 1000, .001),
  oscillatoryInertiaRatioAt1Hz: 1000 * 2 * Math.PI * (35 * metresPerPixel) ** 2 / .001});
const report = {protocol: 'physical-reference-audit-v1',
  runtimeModelChanged: false, runtimeSourceCommit: 'd7a68144b02225db37bb6a9583b057458ff47d52',
  priorCausalAuditCommit: '73f73981b61f37db6a439e5802e11ff7d5efe44f', current, unapprovedFixedDepthExample: proposed,
  illustrativeWaterScales: [scenario('micrometre pixels', 1e-6), scenario('millimetre pixels', .001)],
  summary: {parts: parts.length, minWidthPx: Math.min(...parts.map(p => p.widthPx)),
    maxWidthPx: Math.max(...parts.map(p => p.widthPx)), minHeightPx: Math.min(...parts.map(p => p.heightPx)),
    maxHeightPx: Math.max(...parts.map(p => p.heightPx)),
    maxAngularRatioToSameFaceWeights: Math.max(...parts.map(p => p.angularRatioToSameFaceWeights!)),
    maxIsolatedEulerFraction: Math.max(...parts.flatMap(p => Object.values(p.isolatedEulerFractions))),
    massFloorParts: parts.filter(p => p.massFloorActive).length}, bodies};
writeFileSync(process.argv[2] ?? 'docs/experiments/physical-reference-v1.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({current, proposed, summary: report.summary, illustrativeWaterScales: report.illustrativeWaterScales}, null, 2));
