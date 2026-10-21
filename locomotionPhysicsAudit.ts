/** Offline physical checks for the EXISTING model. No alternate live physics. */
import assert from 'node:assert/strict';
import {createFounderGenome} from './founders';
import {createInitialWorld, addExternalOrganism} from './world';
import {LEGACY_SETTINGS, totalAccountedEnergy} from './persistence';
import {stepSimulation, remapBrain, calculateBodyCost, calculateMaxEnergyCapacity,
  BASE_PART_DENSITY, LONGITUDINAL_DRAG, type Genome} from './simulation';

const settings = {...LEGACY_SETTINGS, worldWidth: 12000, worldHeight: 12000,
  targetNutrients: 0, inflowRate: 0, gravity: 0, mutationSeverity: 0};
function body(parts: number, scale = 1): Genome {
  const g = createFounderGenome('FND-001');
  g.parts = g.parts.slice(0, parts); g.eyes = []; g.mouths = [];
  for (const p of g.parts) {p.dimN = 2 * scale; p.dimM = scale; p.width = p.dimN * 7; p.height = p.dimM * 7;}
  if (parts > 1) g.parts[1].cpgPhaseOffset = Math.PI / 2;
  g.bodyCost = calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier);
  remapBrain(g); g.weightsHO.forEach(row => row.fill(0)); g.biasesO.fill(0);
  return g;
}
function fixture(g: Genome, heading: number, viscosity: number) {
  const config = {...settings, waterViscosity: viscosity};
  const state = createInitialWorld(config, 97, 'balanced', 'standard', 0);
  state.caustics = [];
  const org = addExternalOrganism(state, g, config, 6000, 6000, heading)!;
  return {config, state, org};
}
function close(actual: number, expected: number, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

export function auditLocomotionPhysics() {
  const translation = [];
  // Rotated bodies verify local/world force conversion as well as both axes.
  for (const angle of [0, .73, -1.1]) {
    const {config, state, org} = fixture(body(1), angle, .18), p = org.segments[0], def = org.genome.parts[0];
    const u = 12, v = -4, c = Math.cos(angle), s = Math.sin(angle);
    p.vx = c * u - s * v; p.vy = s * u + c * v;
    const mass = Math.max(.35, def.dimN * def.dimM * BASE_PART_DENSITY);
    const initialKE = .5 * mass * (u * u + v * v);
    for (let tick = 0; tick < 30; tick++) stepSimulation(state, config, 1 / 60);
    const actualU = p.vx * c + p.vy * s, actualV = -p.vx * s + p.vy * c;
    const expectedU = u * (1 - LONGITUDINAL_DRAG * .18 * def.height / mass / 240) ** 120;
    const expectedV = v * (1 - 2 * .18 * def.width / mass / 240) ** 120;
    close(actualU, expectedU); close(actualV, expectedV);
    assert.ok(.5 * mass * (p.vx * p.vx + p.vy * p.vy) < initialKE);
    close(totalAccountedEnergy(state), state.ledger.externalInflow);
    translation.push({angle, actualU, expectedU, actualV, expectedV});
  }
  const spin = fixture(body(1), .5, .18), p = spin.org.segments[0], def = spin.org.genome.parts[0];
  const mass = Math.max(.35, def.dimN * def.dimM * BASE_PART_DENSITY);
  const inertia = mass * (def.width ** 2 + def.height ** 2) / 12;
  p.angVel = .3;
  for (let tick = 0; tick < 30; tick++) stepSimulation(spin.state, spin.config, 1 / 60);
  const expectedSpin = .3 * (1 - .18 * (def.width ** 3 + def.height ** 3) / 6 / inertia / 240) ** 120;
  close(p.angVel, expectedSpin); assert.ok(p.angVel > 0 && p.angVel < .3);
  close(p.vx, 0); close(p.vy, 0);
  const vacuum = fixture(body(1), .6, 0); vacuum.org.segments[0].vx = 12; vacuum.org.segments[0].vy = -4;
  vacuum.org.segments[0].angVel = .3;
  for (let tick = 0; tick < 30; tick++) stepSimulation(vacuum.state, vacuum.config, 1 / 60);
  close(vacuum.org.segments[0].vx, 12); close(vacuum.org.segments[0].vy, -4); close(vacuum.org.segments[0].angVel, .3);
  const small = fixture(body(2), 0, 0), large = fixture(body(2, 2), 0, 0);
  stepSimulation(small.state, small.config, 1 / 60); stepSimulation(large.state, large.config, 1 / 60);
  const torqueRatio = large.org.joints[0].appliedTorque / small.org.joints[0].appliedTorque;
  close(torqueRatio, 16, 1e-6);
  close(large.org.joints[0].currentRelAngVel, small.org.joints[0].currentRelAngVel, 1e-6);
  return {protocol: 'current-locomotion-physics-audit-v1', translation,
    rotation: {actual: p.angVel, expected: expectedSpin}, uniformDoubleSizeTorqueRatio: torqueRatio,
    drag: {longitudinalCoefficient: LONGITUDINAL_DRAG, transverseCoefficient: 2,
      longitudinalRelativeToFullNormalFaces: LONGITUDINAL_DRAG / 2},
    findings: [
      'Passive translation and rotation dissipate kinetic energy; zero viscosity preserves free momentum.',
      'Current lengthwise drag is 1/40 of the full four-normal-face rectangular reference; transverse drag and rotational damping use full-face coefficients.',
      'Uniformly doubling 2D dimensions yields 16x muscle torque: inertia scaling, not area/attachment muscle scaling.',
      'Chemical ledger closure does not establish total mechanical-energy conservation. Work is sampled from pre-update joint speed and capped per complete tick.',
      'Search preserves existing physics and rejects observed speed/work caps, hinge drift, accounting errors and depleted reserves. Substep spikes and all solver exploits are not ruled out.',
    ]};
}
