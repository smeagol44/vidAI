import type {ActuationObserver} from '../actuationObservation';
/** Read-only measurements around ordinary fixed authoritative ticks. No score,
 * target coordinates, selection, force edits or neural intervention here. */
import type {SimulationHost} from '../simulationHost';
import {calculateOrganismCOM, getCardinalAnchor, getChildAnchorForParentDir} from '../simulation';
import {totalAccountedEnergy} from '../persistence';

export function measureWorkerTrial(host: SimulationHost, ticks: number, actuation?: ActuationObserver, afterTick?: (tick:number)=>void) {
  const initial = host.state.organisms.map(o => ({id: o.id, com: calculateOrganismCOM(o), energy: o.energy}));
  const lateStarts = new Map(initial.map(a => [a.id, a.com]));
  let boundaryTicks = 0;
  const previous = new Map(host.state.organisms.map(o => [o.id, {com: calculateOrganismCOM(o),
    modes: o.joints.map(j => j.gateMode), torque: o.joints.map(j => j.appliedTorque)}]));
  let pathPx = 0, switches = 0, torqueVariation = 0, positiveWorkJ = 0, negativeWorkJ = 0;
  let guards = 0, energyLimited = 0, maxAnchorPx = 0, maxLimitRad = 0, maxConstraintGainJ = 0;
  let latePathPx = 0, finite = true, maxEnergyErrorJ = 0;
  const initialHeat = host.state.ledger.mechanicalWorkHeat;
  for (let tick = 0; tick < ticks; tick++) {
    host.tick((phase, before, after) => {
      if (phase === 'constraint-batch') maxConstraintGainJ = Math.max(maxConstraintGainJ, after - before);
    }, actuation);
    afterTick?.(tick);
    const s = host.state;
    if (tick === Math.floor(ticks * 2 / 3)) for (const o of s.organisms) lateStarts.set(o.id, calculateOrganismCOM(o));
    if (s.organisms.some(o => o.segments.some(p => p.x < 100 || p.y < 100
      || p.x > host.settings.worldWidth - 100 || p.y > host.settings.worldHeight - 100))) boundaryTicks++;
    maxEnergyErrorJ = Math.max(maxEnergyErrorJ, Math.abs(totalAccountedEnergy(s) - (s.energyPool?.budget ?? s.ledger.externalInflow)));
    for (const o of s.organisms) {
      const p = previous.get(o.id), com = calculateOrganismCOM(o);
      finite &&= o.segments.every(b => Object.values(b).every(Number.isFinite)) && Number.isFinite(o.energy);
      if (p) {
        const travel = Math.hypot(com.x - p.com.x, com.y - p.com.y);
        pathPx += travel; if (tick >= Math.floor(ticks * 2 / 3)) latePathPx += travel;
        o.joints.forEach((j, i) => {switches += Number(j.gateMode !== p.modes[i]); torqueVariation += Math.abs(j.appliedTorque - p.torque[i]);});
      }
      previous.set(o.id, {com, modes: o.joints.map(j => j.gateMode), torque: o.joints.map(j => j.appliedTorque)});
      const d = o.motorDiagnostics;
      positiveWorkJ += d?.positiveWorkJ ?? 0; negativeWorkJ += d?.negativeWorkJ ?? 0;
      guards += d?.numericalGuardEvents ?? 0; energyLimited += d?.energyLimitedImpulses ?? 0;
      for (let i = 1; i < o.segments.length; i++) {
        const def = o.genome.parts[i], pd = o.genome.parts[def.parentIndex];
        const a = o.segments[def.parentIndex], b = o.segments[i];
        const pa = getCardinalAnchor(def.attachmentPoint, pd.width, pd.height);
        const pb = getChildAnchorForParentDir(def.attachmentPoint, def.width, def.height);
        maxAnchorPx = Math.max(maxAnchorPx, Math.hypot(
          b.x + Math.cos(b.angle) * pb.x - Math.sin(b.angle) * pb.y - a.x - Math.cos(a.angle) * pa.x + Math.sin(a.angle) * pa.y,
          b.y + Math.sin(b.angle) * pb.x + Math.cos(b.angle) * pb.y - a.y - Math.sin(a.angle) * pa.x - Math.cos(a.angle) * pa.y));
        const relative = b.angle - a.angle - def.baseAngleOffset;
        maxLimitRad = Math.max(maxLimitRad, Math.abs(Math.atan2(Math.sin(relative), Math.cos(relative))) - def.maxAngle);
      }
    }
  }
  const founders = initial.map(a => {
    const o = host.state.organisms.find(o => o.id === a.id);
    const end = o ? calculateOrganismCOM(o) : a.com;
    const late = lateStarts.get(a.id)!;
    return {id: a.id, lateDisplacementPx: Math.hypot(end.x - late.x, end.y - late.y), alive: !!o && !o.dissolving, dx: end.x - a.com.x, dy: end.y - a.com.y,
      displacementPx: Math.hypot(end.x - a.com.x, end.y - a.com.y), reserveSpentJ: a.energy - (o?.energy ?? 0)};
  });
  return {ticks, boundaryTicks, founders, pathPx, latePathPx, switches, torqueVariation, positiveWorkJ, negativeWorkJ,
    motorJ: host.state.ledger.mechanicalWorkHeat - initialHeat, guards, energyLimited, maxAnchorPx,
    maxLimitRad, maxConstraintGainJ, maxEnergyErrorJ, finite};
}
