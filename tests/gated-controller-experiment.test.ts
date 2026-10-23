import assert from 'node:assert/strict';
import {test} from 'node:test';
import {evaluateMotorWave} from '../simulation';
import {
  gatedTorque, gateTrace, selectGateMode, HYSTERESIS_TRIAL_WIDTH,
  type GateArchitecture, type GateMode, type GateSignals,
} from '../experiments/gatedMotor';

const architectures: GateArchitecture[] = ['two-output', 'three-output'];
const signal = (architecture: GateArchitecture, mode: number, command: number): GateSignals =>
  architecture === 'two-output'
    ? {architecture, mode, command}
    : {architecture, mode, direct: command, strength: command};

test('near-boundary mode chatter is suppressed without any timed cooldown, for both architectures', () => {
  const noisyMode = Array.from({length: 120}, (_, i) => i % 2 === 0 ? .29 : .31);
  for (const architecture of architectures) {
    const inputs = noisyMode.map(mode => signal(architecture, mode, .8));
    const waves = noisyMode.map((_, i) => Math.sin(i / 4));
    const ungated = gateTrace(inputs, waves, 10);
    const stable = gateTrace(inputs, waves, 10, HYSTERESIS_TRIAL_WIDTH);
    assert.equal(ungated.transitions, 119, architecture);
    assert.equal(stable.transitions, 0, architecture);
    assert.ok(stable.modes.every(m => m === 'direct'));
  }
});

test('OFF-DIRECT boundary also rejects small fluctuations with hysteresis', () => {
  const samples = Array.from({length: 100}, (_, i) => i % 2 ? -.31 : -.29);
  const inputs = samples.map(mode => signal('two-output', mode, .5));
  assert.equal(gateTrace(inputs, samples.map(() => 1), 10).transitions, 99);
  assert.equal(gateTrace(inputs, samples.map(() => 1), 10, HYSTERESIS_TRIAL_WIDTH).transitions, 0);
});

test('a decisive emergency input can jump between ANY modes in one update', () => {
  for (const architecture of architectures) {
    let last: GateMode = 'direct';
    for (const [nextInput, expected] of [
      [-1, 'off'], [1, 'oscillator'], [-1, 'off'], [0, 'direct'], [1, 'oscillator'],
    ] as const) {
      const result = gatedTorque(signal(architecture, nextInput, 1), last, 1, 200, HYSTERESIS_TRIAL_WIDTH);
      assert.equal(result.mode, expected, architecture);
      last = result.mode;
    }
  }
  // Previous mode is sufficient state; no countdown or minimum dwell.
  assert.equal(selectGateMode(-1, 'oscillator', HYSTERESIS_TRIAL_WIDTH), 'off');
  assert.equal(selectGateMode(1, 'off', HYSTERESIS_TRIAL_WIDTH), 'oscillator');
});

test('OFF is exact zero active torque, not a position lock or hidden tiny command', () => {
  for (const architecture of architectures) {
    const off = gatedTorque(signal(architecture, -1, 1), 'direct', 1, 5, HYSTERESIS_TRIAL_WIDTH);
    assert.deepEqual(off, {mode: 'off', torque: 0, normalizedTorque: 0, oscillatorStrength: 0});
    const rest = gatedTorque(signal(architecture, -.7, -1), 'off', -.7, 5, HYSTERESIS_TRIAL_WIDTH);
    assert.equal(rest.torque, 0);
  }
});

test('reversed neural signed commands reverse joint torque immediately in DIRECT mode', () => {
  for (const architecture of architectures) {
    const forward = gatedTorque(signal(architecture, 0, 1), 'direct', 0, 10, HYSTERESIS_TRIAL_WIDTH);
    const reverse = gatedTorque(signal(architecture, 0, -1), 'direct', 0, 10, HYSTERESIS_TRIAL_WIDTH);
    assert.equal(forward.torque, 10);
    assert.equal(reverse.torque, -10);
  }
});

test('OSCILLATOR produces bounded genetic waveform torque, not a target angle', () => {
  const phases = [0, Math.PI / 4, Math.PI / 2, Math.PI, 5 * Math.PI / 4];
  for (const architecture of architectures) {
    for (const phase of phases) {
      const wave = evaluateMotorWave(phase, [.2, -.3, .1, 0]);
      const result = gatedTorque(signal(architecture, 1, 1), 'direct', wave, 13, HYSTERESIS_TRIAL_WIDTH);
      assert.equal(result.mode, 'oscillator');
      assert.ok(Math.abs(result.torque - wave * 13) < 1e-12);
      assert.ok(Math.abs(result.torque) <= 13);
    }
  }
});

test('two shared outputs and three independent outputs agree on equal input traces', () => {
  const modes = [-1, -.6, 0, .5, 1, .29, .31, -.31, -.29, -1, 1];
  const commands = modes.map((_, i) => Math.sin(i * 1.2));
  const waves = modes.map((_, i) => Math.sin(i / 3));
  for (const width of [0, HYSTERESIS_TRIAL_WIDTH]) {
    const two = gateTrace(modes.map((m, i) => signal('two-output', m, commands[i])), waves, 20, width);
    const three = gateTrace(modes.map((m, i) => signal('three-output', m, commands[i])), waves, 20, width);
    assert.deepEqual(two, three);
  }
});

test('three outputs decouple oscillator strength from direct torque, unlike two shared outputs', () => {
  const independent = gatedTorque({
    architecture: 'three-output', mode: 1, direct: -1, strength: 1,
  }, 'direct', 1, 10, HYSTERESIS_TRIAL_WIDTH);
  const shared = gatedTorque({
    architecture: 'two-output', mode: 1, command: -1,
  }, 'direct', 1, 10, HYSTERESIS_TRIAL_WIDTH);
  assert.equal(independent.torque, 10);
  assert.equal(shared.torque, 0);
  const neutral = gatedTorque({
    architecture: 'two-output', mode: 1, command: 0,
  }, 'direct', 1, 10, HYSTERESIS_TRIAL_WIDTH);
  assert.equal(neutral.oscillatorStrength, .5, 'centered command activates half oscillator strength in this candidate');
});

test('trial torque is equal-and-opposite on two inertias; inertia limits instantaneous speed', () => {
  const torques = architectures.map(architecture =>
    gatedTorque(signal(architecture, 0, 1), 'direct', 0, 24, HYSTERESIS_TRIAL_WIDTH).torque);
  const dt = 1 / 60;
  for (const torque of torques) {
    const parentInertia = 2, childInertia = 8;
    const parentAngularVelocity = -torque * dt / parentInertia;
    const childAngularVelocity = torque * dt / childInertia;
    assert.ok(Math.abs(parentInertia * parentAngularVelocity + childInertia * childAngularVelocity) < 1e-12);
    assert.ok(Number.isFinite(parentAngularVelocity) && Number.isFinite(childAngularVelocity));
    assert.equal(parentAngularVelocity, -0.2);
    assert.equal(childAngularVelocity, 0.05);
  }
  // This is an isolated two-inertia mechanical sanity check, not the full
  // articulated Worker solver nor a proof of conserved ecosystem energy.
});

test('mode state and rejected nonfinite input are deterministic', () => {
  for (const raw of [Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => selectGateMode(raw, 'off'), /Non-finite/);
  }
  assert.throws(() => gatedTorque(signal('two-output', 1, 0), 'direct', 0, -1), /Invalid maximum/);
  assert.throws(() => selectGateMode(0, 'direct', .31), /Invalid experimental hysteresis/);
  const a = gateTrace([signal('two-output', 1, 1)], [1], 4, HYSTERESIS_TRIAL_WIDTH, 'off');
  const b = gateTrace([signal('two-output', 1, 1)], [1], 4, HYSTERESIS_TRIAL_WIDTH, 'off');
  assert.deepEqual(a, b);
});
