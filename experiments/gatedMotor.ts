/**
 * Experimental motor-gate semantics for issue #59.
 *
 * Opt-in testing-only genomes use this in the authoritative Worker. Legacy
 * genomes keep their original six-channel servo.
 * The caller must provide actual oscillator output and externally justified
 * max torque; this code does not derive a biological muscle-strength law.
 * Deliberately no timer, ramp, dwell or arbitrary activation-rate limit.
 */
export type GateMode = 'off' | 'direct' | 'oscillator';
export type GateArchitecture = 'two-output' | 'three-output';

export type GateSignals =
  | { architecture: 'two-output'; mode: number; command: number }
  | { architecture: 'three-output'; mode: number; direct: number; strength: number };

export interface GateResult {
  mode: GateMode;
  torque: number;
  normalizedTorque: number;
  oscillatorStrength: number;
}

/** These are *experimental*, arbitrary selector boundaries, not physical units. */
export const MODE_BOUNDARY = 0.3;
export const HYSTERESIS_TRIAL_WIDTH = 0.06;

function bounded(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Non-finite experimental motor input');
  return Math.max(-1, Math.min(1, value));
}

/**
 * Select all three modes in a single controller update.
 * With hysteresis, exiting a mode requires crossing a different threshold.
 * Even OFF -> OSCILLATOR or OSCILLATOR -> OFF can occur in one update.
 * No activation slowdown is imposed.
 */
export function selectGateMode(
  rawSignal: number,
  previous: GateMode,
  hysteresisWidth = 0,
): GateMode {
  const signal = bounded(rawSignal);
  if (!Number.isFinite(hysteresisWidth) || hysteresisWidth < 0 || hysteresisWidth >= MODE_BOUNDARY) {
    throw new Error('Invalid experimental hysteresis width');
  }
  const low = -MODE_BOUNDARY;
  const high = MODE_BOUNDARY;
  if (previous === 'off') {
    if (signal > high + hysteresisWidth) return 'oscillator';
    if (signal > low + hysteresisWidth) return 'direct';
    return 'off';
  }
  if (previous === 'oscillator') {
    if (signal < low - hysteresisWidth) return 'off';
    if (signal < high - hysteresisWidth) return 'direct';
    return 'oscillator';
  }
  if (previous === 'direct') {
    if (signal < low - hysteresisWidth) return 'off';
    if (signal > high + hysteresisWidth) return 'oscillator';
    return 'direct';
  }
  throw new Error('Invalid experimental previous mode');
}

/** Signed command drives direct torque; oscillator amplitude uses [0,1].
 * A centered, zero-valued oscillator-strength output requests 50% activation.
 * That baseline is an explicit candidate trade-off, not assumed optimal.
 */
export function gatedTorque(
  signals: GateSignals,
  previous: GateMode,
  oscillatorWave: number,
  maxTorque: number,
  hysteresisWidth = 0,
): GateResult {
  if (!Number.isFinite(maxTorque) || maxTorque < 0) throw new Error('Invalid maximum torque');
  const wave = bounded(oscillatorWave);
  const mode = selectGateMode(signals.mode, previous, hysteresisWidth);
  if (mode === 'off') return {mode, torque: 0, normalizedTorque: 0, oscillatorStrength: 0};

  if (mode === 'direct') {
    const command = signals.architecture === 'two-output' ? signals.command : signals.direct;
    const normalizedTorque = bounded(command);
    return {mode, torque: normalizedTorque * maxTorque, normalizedTorque, oscillatorStrength: 0};
  }

  const strengthCommand = signals.architecture === 'two-output' ? signals.command : signals.strength;
  const oscillatorStrength = (bounded(strengthCommand) + 1) / 2;
  const normalizedTorque = wave * oscillatorStrength;
  return {mode, torque: normalizedTorque * maxTorque, normalizedTorque, oscillatorStrength};
}

/** Repeatable instrumented gate trace. This is NOT a real-Worker swim trial. */
export function gateTrace(
  signals: GateSignals[],
  waves: number[],
  maxTorque: number,
  hysteresisWidth = 0,
  initialMode: GateMode = 'direct',
): {modes: GateMode[]; torques: number[]; transitions: number; totalAbsTorque: number} {
  if (signals.length !== waves.length) throw new Error('Mismatched gate/wave lengths');
  const modes: GateMode[] = [], torques: number[] = [];
  let previous = initialMode, transitions = 0, totalAbsTorque = 0;
  for (let i = 0; i < signals.length; i++) {
    const result = gatedTorque(signals[i], previous, waves[i], maxTorque, hysteresisWidth);
    if (result.mode !== previous) transitions++;
    previous = result.mode;
    modes.push(previous);
    torques.push(result.torque);
    totalAbsTorque += Math.abs(result.torque);
  }
  return {modes, torques, transitions, totalAbsTorque};
}
