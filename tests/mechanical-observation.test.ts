import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSnapshot, restoreSnapshot} from '../persistence';
import {enableClosedEconomy} from '../energyEconomy';
import {stepSimulation, BASE_PART_DENSITY} from '../simulation';
import {mechanicalFixture, mechanicalRecorder, placeChildBeyondLimit} from '../mechanicalAudit';
import {organismKineticEnergy} from '../mechanicalObservation';

test('mechanical observation preserves exact snapshots in all physics and ecology regimes', () => {
  for (const physicsRegime of ['legacy-v0', 'surface-work-v1', 'paid-work-v2'] as const) {
    for (const closed of [false, true]) {
      const original = mechanicalFixture(); original.config.physicsRegime = physicsRegime;
      original.org.genome.motorForce = 20;
      original.org.segments[1].x += .25;
      if (closed) enableClosedEconomy(original.state);
      const copy = restoreSnapshot(createSnapshot(original.state, original.config));
      const recorder = mechanicalRecorder();
      for (let i = 0; i < 12; i++) {
        stepSimulation(original.state, original.config, 1 / 60);
        stepSimulation(copy.state, copy.settings, 1 / 60, undefined, recorder.observe);
      }
      assert.deepEqual(createSnapshot(copy.state, copy.settings).state,
        createSnapshot(original.state, original.config).state);
      assert.ok(recorder.phases['anchor-constraint']!.samples > 0);
      const netJ = Object.values(recorder.phases).reduce((sum, p) => sum + p.netJ, 0);
      assert.ok(Math.abs(netJ - organismKineticEnergy(copy.state.organisms[0], BASE_PART_DENSITY)) < 1e-10,
        'all kinetic-changing stages are attributed in each regime');
    }
  }
});

test('isolated kinetic audit attributes anchor/limit energy creation without charging a motor', () => {
  for (const mode of ['anchor', 'limit'] as const) {
    const {state, config, org} = mechanicalFixture();
    if (mode === 'anchor') org.segments[1].x += 1;
    else placeChildBeyondLimit(org);
    const recorder = mechanicalRecorder();
    stepSimulation(state, config, 1 / 60, undefined, recorder.observe);
    const phase = mode === 'anchor' ? 'anchor-constraint' : 'angular-limit';
    assert.ok(recorder.phases[phase]!.addedJ > 1e-5, 'detect the existing velocity-bias defect');
    assert.equal(state.ledger.mechanicalWorkHeat, 0);
    const sum = Object.values(recorder.phases).reduce((s, value) => s + value.netJ, 0);
    assert.ok(Math.abs(sum - organismKineticEnergy(org, BASE_PART_DENSITY)) < 1e-12);
  }
});

test('aligned unpowered body stays still with zero recorded kinetic change', () => {
  const {state, config, org} = mechanicalFixture(), recorder = mechanicalRecorder();
  for (let i = 0; i < 6; i++) stepSimulation(state, config, 1 / 60, undefined, recorder.observe);
  assert.equal(organismKineticEnergy(org, BASE_PART_DENSITY), 0);
  assert.ok(Object.values(recorder.phases).every(p => p.addedJ === 0 && p.removedJ === 0));
});
