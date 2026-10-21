import {readFileSync, writeFileSync} from 'node:fs';
import {enableClosedEconomy} from '../energyEconomy';
import {DEFAULT_SETTINGS, totalAccountedEnergy} from '../persistence';
import {createInitialWorld, collectWorldStats} from '../world';
import {stepSimulation, type SimulationSettings} from '../simulation';

const seconds = 60;
const rows = [];
for (const seed of process.argv.includes('--isolate') ? [] : [17, 73]) for (const regime of ['open', 'closed'] as const) {
  const settings: SimulationSettings = {...DEFAULT_SETTINGS,
    ...(regime === 'closed' ? {ecologyRegime: 'closed-v1', nutrientLimit: null} as const : {})};
  const s = createInitialWorld(settings, seed, 'balanced', 'showcase');
  const initialEnergyJ = s.energyPool?.budget ?? s.ledger.externalInflow;
  let maxErrorJ = 0, expiredEggs = 0;
  const started = performance.now();
  for (let i = 0; i < seconds * 60; i++) {
    stepSimulation(s, settings, 1 / 60, event => {if (event === 'egg_loss') expiredEggs++;});
    maxErrorJ = Math.max(maxErrorJ, Math.abs(totalAccountedEnergy(s) - (s.energyPool?.budget ?? s.ledger.externalInflow)));
  }
  rows.push({seed, regime, seconds, initialEnergyJ,
    ...collectWorldStats(s, settings.targetNutrients),
    reserveJ: s.energyPool?.reserve ?? null, budgetJ: s.energyPool?.budget ?? null,
    maxErrorJ, expiredEggs, runtimeMs: Math.round(performance.now() - started)});
  console.log(JSON.stringify(rows.at(-1)));
}
const path = 'docs/experiments/closed-energy-v1.json';
const result = process.argv.includes('--isolate') ? JSON.parse(readFileSync(path, 'utf8')) : {seconds,
  note: 'Unassisted paired showcase observations, not proof of sustained ecology. Timings are diagnostic, not performance gates.', rows};
const isolated = [];
for (let repeat = 0; repeat < 3; repeat++) for (const closed of repeat % 2 ? [true, false] : [false, true]) {
  // Same physical state and food, no replenishment or reproduction during 10s.
  const cfg = {...DEFAULT_SETTINGS, inflowRate: 0, nutrientLimit: 0};
  const s = createInitialWorld(cfg, 17, 'balanced', 'showcase');
  if (closed) enableClosedEconomy(s);
  const start = performance.now(), cpu = process.cpuUsage();
  for (let i = 0; i < 600; i++) stepSimulation(s, cfg, 1 / 60);
  const used = process.cpuUsage(cpu);
  isolated.push({repeat, closed, wallMs: Math.round(performance.now() - start),
    cpuMs: Math.round((used.user + used.system) / 1000),
    distancePx: s.organisms.reduce((n, o) => n + o.distanceTraveled, 0)});
}
result.isolatedTiming = isolated;
console.log(JSON.stringify({isolatedTiming: isolated}));
writeFileSync(path, JSON.stringify(result, null, 2) + '\n');
