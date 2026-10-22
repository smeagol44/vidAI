import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FEATURED_BLUEPRINTS} from '../founders';
import {passiveConstraintScale} from '../foundationPhysics';
import {mechanicalFixture, mechanicalRecorder, placeChildBeyondLimit} from '../mechanicalAudit';
import {jointErrors, observeSolver} from '../solverPassivityAudit';
import {stepSimulation, calculateOrganismCOM, BASE_PART_DENSITY} from '../simulation';
import {organismKineticEnergy} from '../mechanicalObservation';
import {createSnapshot, restoreSnapshot} from '../persistence';
import {enableClosedEconomy} from '../energyEconomy';
import {SimulationHost} from '../simulationHost';
import {runControlledGrazing} from '../ecologyBaseline';
import {runTwinOarApproach} from '../foragingAudit';

test('passive batch keeps dissipative corrections and bounds the complete quadratic work', () => {
  assert.equal(passiveConstraintScale(-3, 2), 1);
  assert.equal(passiveConstraintScale(0, 2), 0);
  assert.equal(passiveConstraintScale(1, 2), 0);
  assert.ok(Math.abs(passiveConstraintScale(-1, 2) - .5) < 1e-14);
  for (const linear of [-100, -1, -1e-12, 0, 1, 100]) for (const quadratic of [0, 1e-12, 1, 100]) {
    const scale = passiveConstraintScale(linear, quadratic);
    assert.ok(scale >= 0 && scale <= 1);
    assert.ok(scale * linear + scale * scale * quadratic <= 1e-12);
  }
});

test('resting and coasting invalid joints repair without generating kinetic energy or paying motor work', () => {
  for (const kind of ['anchor', 'limit']) for (const coast of [0, 12]) {
    const {state, config, org} = mechanicalFixture(); config.physicsRegime = 'passive-work-v3';
    if (kind === 'anchor') org.segments[1].x += 1; else placeChildBeyondLimit(org);
    for (const p of org.segments) {p.vx = coast; p.vy = coast * -.3;}
    const before = organismKineticEnergy(org, BASE_PART_DENSITY), com = calculateOrganismCOM(org);
    const recorder = mechanicalRecorder();
    for (let i = 0; i < 6; i++) stepSimulation(state, config, 1 / 60, undefined, recorder.observe);
    assert.ok(Math.abs(organismKineticEnergy(org, BASE_PART_DENSITY) - before) < 1e-12);
    assert.ok(jointErrors(org).anchorPx < 1e-5); assert.ok(jointErrors(org).limitRad < 1e-5);
    assert.equal(state.ledger.mechanicalWorkHeat, 0);
    assert.ok(Math.abs(calculateOrganismCOM(org).vxCOM - com.vxCOM) < 1e-8);
    assert.ok((recorder.phases['constraint-batch']?.addedJ ?? 0) < 1e-12);
  }
});

test('unpowered perturbed bodies and contact never gain kinetic energy through the accepted solve', () => {
  for (let n = 0; n < 24; n++) {
    const {state, config, org} = mechanicalFixture(); config.physicsRegime = 'passive-work-v3';
    org.segments[1].x += Math.sin(n) * 2; org.segments[1].y += Math.cos(n) * 2;
    for (let i = 0; i < org.segments.length; i++) {
      const p = org.segments[i]; p.vx = Math.sin(n * 3 + i) * 20; p.vy = Math.cos(n + i) * 20; p.angVel = Math.sin(n + 2 * i);
    }
    const before = organismKineticEnergy(org, BASE_PART_DENSITY);
    for (let i = 0; i < 6; i++) stepSimulation(state, config, 1 / 60, undefined, (phase, a, b) => {
      if (phase !== 'forces-and-motors') assert.ok(b - a < 1e-12, `${phase} added ${b - a} J`);
    });
    assert.ok(organismKineticEnergy(org, BASE_PART_DENSITY) <= before + 1e-12);
    assert.ok(org.segments.every(p => Object.values(p).every(Number.isFinite)));
  }
});

test('all nine frozen swims retain movement/expenditure bands without added speed-clamp dependence', () => {
  for (const d of FEATURED_BLUEPRINTS) {
    const old = observeSolver(d.id, 'paid-work-v2'), fixed = observeSolver(d.id, 'passive-work-v3');
    assert.ok(fixed.displacementPx >= .9 * old.displacementPx && fixed.displacementPx <= 1.1 * old.displacementPx, d.id);
    assert.ok(fixed.reserveSpentJ >= .9 * old.reserveSpentJ && fixed.reserveSpentJ <= 1.1 * old.reserveSpentJ, d.id);
    assert.ok(fixed.guards <= old.guards, d.id + ': added guards');
    assert.ok(fixed.maxConstraintGainJ < 1e-12); assert.ok(Math.abs(fixed.chemicalErrorJ) < 1e-6);
    assert.ok(fixed.maxAnchorErrorPx < .5, d.id + ': hinge drift');
  }
});

test('v15 solver saves continue exactly across both ecology/contact choices; old schemas reject smuggled v3', () => {
  for (const closed of [false, true]) for (const mouthContactModel of [undefined, 'capsule-v1'] as const) {
    const f = mechanicalFixture(); f.config.physicsRegime = 'passive-work-v3'; f.config.mouthContactModel = mouthContactModel;
    if (closed) {enableClosedEconomy(f.state); f.config.ecologyRegime = 'closed-v1'; f.config.nutrientLimit = null;}
    f.org.genome.motorForce = 20;
    for (let i = 0; i < 4; i++) stepSimulation(f.state, f.config, 1 / 60);
    const saved = createSnapshot(f.state, f.config), restored = restoreSnapshot(saved), host = new SimulationHost();
    assert.equal(saved.schemaVersion, '15.0.0'); assert.deepEqual(createSnapshot(restored.state, restored.settings), saved);
    host.reset(saved, 1);
    for (let i = 0; i < 12; i++) {host.tick(); stepSimulation(restored.state, restored.settings, 1 / 60);}
    assert.deepEqual(host.snapshot().state, createSnapshot(restored.state, restored.settings).state);
    for (const schemaVersion of ['12.0.0', '13.0.0', '14.0.0']) {
      assert.throws(() => restoreSnapshot({...saved, schemaVersion}), /physics regime/);
    }
    const bad = structuredClone(saved); bad.settings.physicsRegime = 'paid-work-v2';
    assert.throws(() => restoreSnapshot(bad), /physics regime/);
  }
});

test('solver correction retains the existing real Darter and Twin Oar food acquisition checks', () => {
  const old = runControlledGrazing(17, -1, 135, true, 'paid-work-v2');
  const fixed = runControlledGrazing(17, -1, 135, true, 'passive-work-v3');
  assert.ok(old.absorbedJ.Nutrient > 0); assert.ok(fixed.absorbedJ.Nutrient >= .9 * old.absorbedJ.Nutrient);
  const setup = {side: -1, distance: 135, heading: .8, viscosity: .15};
  assert.equal(runTwinOarApproach('current', setup, 'passive-work-v3').absorbedJ, 2400);
});
