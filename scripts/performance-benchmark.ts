import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as simulation from '../simulation';
import {createInitialWorld} from '../world';
import {DEFAULT_SETTINGS, createSnapshot, restoreSnapshot} from '../persistence';

const args = process.argv.slice(2), baselineIndex = args.indexOf('--baseline');
const settings = {...DEFAULT_SETTINGS, targetNutrients: 78, inflowRate: 0, mutationSeverity: 0};
const source = createInitialWorld(settings, 82, 'balanced', 'standard', 15);
for (const org of source.organisms) {
  // Exercise the evolved-mask path without changing any connection's value.
  org.genome.disabledConnections!.push(simulation.brainEdgeKey('ih', org.genome.hiddenIds![0], 'body:injury'));
}
for (let i = 0; i < 221; i++) {
  source.nutrients.push({id: `benchmark-remains-${i}`, kind: 'carrion',
    x: source.prng.range(40, 2360), y: source.prng.range(40, 1460), vx: 0, vy: 0,
    energyValue: 3000, radius: 18, decayTimeRemaining: 60, bottomTimer: 0, pulseTimer: 0});
  source.ledger.externalInflow += 3000;
}
const checkpoint = createSnapshot(source, settings);
const implementations = [{name: 'current', step: simulation.stepSimulation, restore: restoreSnapshot}];
if (baselineIndex >= 0) {
  if (!args[baselineIndex + 1]) throw new Error('--baseline requires a local checkout path');
  const root = resolve(args[baselineIndex + 1]);
  const previous = await import(pathToFileURL(resolve(root, 'simulation.ts')).href);
  const persistence = await import(pathToFileURL(resolve(root, 'persistence.ts')).href);
  implementations.unshift({name: 'baseline', step: previous.stepSimulation, restore: persistence.restoreSnapshot});
}
let expected: unknown;
for (let round = 0; round < 2; round++) {
  for (const implementation of round ? [...implementations].reverse() : implementations) {
    const {state} = implementation.restore(checkpoint);
    for (let i = 0; i < 10; i++) implementation.step(state, settings, 1 / 60);
    const start = performance.now();
    for (let i = 0; i < 120; i++) implementation.step(state, settings, 1 / 60);
    const milliseconds = performance.now() - start;
    const final = createSnapshot(state, settings).state;
    if (expected === undefined) expected = final; else assert.deepEqual(final, expected);
    console.log(JSON.stringify({implementation: implementation.name, round: round + 1,
      creatures: 15, plantFood: 78, remains: 221, ticks: 120,
      milliseconds: Math.round(milliseconds), exactStateMatch: true}));
  }
}
