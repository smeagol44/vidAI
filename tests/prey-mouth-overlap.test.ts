import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as sim from '../simulation';
import {createInitialWorld, addExternalOrganism} from '../world';
import {DEFAULT_SETTINGS, totalAccountedEnergy} from '../persistence';

const def = {...sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(29)).parts[0],
  dimN: 7, dimM: 7, width: 7 * sim.UNIT_SIZE, height: 7 * sim.UNIT_SIZE};
const body = (angle: number): sim.PartPhys =>
  ({x: 120, y: 260, vx: 0, vy: 0, angle, angVel: 0});

test('predator mouth fully enclosed by rotated prey tissue counts as real physical contact', () => {
  for (const angle of [0, Math.PI / 5, Math.PI / 2, -Math.PI / 3]) {
    const part = body(angle);
    // Short aperture is wholly enclosed, >4.5px from every boundary.
    const hx = 8 * Math.cos(angle), hy = 8 * Math.sin(angle);
    const x1 = part.x - hx, y1 = part.y - hy, x2 = part.x + hx, y2 = part.y + hy;
    const corners = sim.getPartCornerVertices(part, def);
    assert.ok(corners.every((a, i) =>
      sim.distPointToSegment(part.x, part.y, a.x, a.y,
        corners[(i + 1) % 4].x, corners[(i + 1) % 4].y) > 4.5),
    'edge-only bite detection would miss this deep physical overlap');
    assert.equal(sim.mouthApertureContactsPart(part.x, part.y, x1, y1, x2, y2, 4.5, part, def), true);
  }
});

test('mouths outside tissue still require actual aperture-edge intersection or radius contact', () => {
  const part = body(.3);
  const ca = Math.cos(part.angle), sa = Math.sin(part.angle);
  const point = (localX: number, localY: number) => ({
    x: part.x + ca * localX - sa * localY,
    y: part.y + sa * localX + ca * localY,
  });
  const outside = point(70, 0);
  const outer1 = point(66, -6), outer2 = point(66, 6);
  assert.equal(sim.mouthApertureContactsPart(outside.x, outside.y,
    outer1.x, outer1.y, outer2.x, outer2.y, 4.5, part, def), false);
  const grazing = point(26, 0), graz1 = point(22, -5), graz2 = point(30, 5);
  assert.equal(sim.mouthApertureContactsPart(grazing.x, grazing.y,
    graz1.x, graz1.y, graz2.x, graz2.y, 4.5, part, def), true);
  // Mouthline crossing the boundary with center still outside the body.
  const crossing = point(30, 0), cross1 = point(17, 0), cross2 = point(43, 0);
  assert.equal(sim.mouthApertureContactsPart(crossing.x, crossing.y,
    cross1.x, cross1.y, cross2.x, cross2.y, 4.5, part, def), true);
});

test('corrected prey-contact geometry leaves native bite absorption finite and energy-conserving', () => {
  const settings = {...DEFAULT_SETTINGS, targetNutrients: 0, inflowRate: 0,
    mutationSeverity: 0, kinshipProtection: false};
  const g = sim.createReferenceNematodeGenome(new sim.XoshiroPRNG(31));
  g.parts = [g.parts[0]]; g.eyes = [];
  g.mouths = [{id: 'bite-mouth', partIndex: 0, direction: 'EAST',
    intakeWidth: 12, mouthType: 'carnivore'}];
  g.motorForce = 0;
  g.bodyCost = sim.calculateBodyCost(g.parts, g.eyes, g.mouths);
  g.maxEnergyCapacity = sim.calculateMaxEnergyCapacity(g.parts, g.storageTraitMultiplier);
  sim.remapBrain(g);

  const preyG = structuredClone(g);
  preyG.mouths = [];
  sim.remapBrain(preyG);
  preyG.bodyCost = sim.calculateBodyCost(preyG.parts, preyG.eyes, preyG.mouths);
  const world = createInitialWorld(settings, 33, 'unbiased', 'standard', 0);
  const predator = addExternalOrganism(world, g, settings, 1200, 750, 0)!;
  const prey = addExternalOrganism(world, preyG, settings,
    1200 + g.parts[0].width, 750, 0)!;
  const beforePrey = prey.energy, before = totalAccountedEnergy(world);
  sim.stepSimulation(world, settings, 1/60);
  assert.ok(prey.energy < beforePrey, 'real contact must transfer finite prey energy');
  assert.ok(predator.recentFeedings?.some(e => e.foodCategory === 'Prey'));
  assert.ok(Math.abs(totalAccountedEnergy(world) - before) < 1e-5);
});
