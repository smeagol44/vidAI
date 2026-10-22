import assert from 'node:assert/strict';
import {test} from 'node:test';
import {observeSolver} from '../solverPassivityAudit';

/** Diagnostic-only control: same fixed genes/pose, no motor torque. Never a
 * production setting or a baseline rewrite. Measures necessary actuation,
 * not the independent contribution of contact or pose feedback. */
test('bounded motor-off control distinguishes persistent solver guard dependence', () => {
  const recorded = [
    {id: 'CUR-004', guards: 352},
    {id: 'CUR-005', guards: 116},
    {id: 'CUR-006', guards: 1106},
  ];
  for (const {id, guards} of recorded) {
    const driven = observeSolver(id, 'passive-work-v3');
    const unpowered = observeSolver(id, 'passive-work-v3', 5, .37, .18, true);
    assert.equal(driven.guards, guards, id + ': frozen powered guard count changed');
    assert.ok(Math.abs(driven.chemicalErrorJ) < 1e-6);
    assert.ok(Math.abs(unpowered.chemicalErrorJ) < 1e-6);
    assert.equal(unpowered.phases['speed-guards']?.addedJ ?? 0, 0);
    // Do not assume that eliminating motor work also eliminates contacts.
    // Report observed guard losses and contact activity separately.
    console.log('GUARD_CAUSAL_CONTROL ' + JSON.stringify({
      id, driven: {guards: driven.guards,
        clampLossJ: driven.phases['speed-guards']?.removedJ ?? 0,
        contacts: driven.phases['contact-impulse']?.samples ?? 0,
        distancePx: driven.displacementPx},
      unpowered: {guards: unpowered.guards,
        clampLossJ: unpowered.phases['speed-guards']?.removedJ ?? 0,
        contacts: unpowered.phases['contact-impulse']?.samples ?? 0,
        distancePx: unpowered.displacementPx,
        positiveMotorWorkJ: 0},
    }));
  }
});
