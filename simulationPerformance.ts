import type {SimulationSpeed} from './simulationSpeed';

export const VISUAL_MAX_REFERENCE = 50;
export const MEASUREMENT_WINDOW_MS = 250;
export const MEASUREMENT_EXPIRY_MS = 1250;
export const PERFORMANCE_COLORS = ['#FF0000', '#FF8000', '#FFFF00', '#00FF00', '#00FFFF', '#FFFFFF'] as const;
const anchors = [.1, .3, .6, 1, 1.3, 1.5];

export function pulseFrequency(actual: number): number {
  return Number.isFinite(actual) && actual > 0 ? 2.5 * Math.log1p(Math.min(actual, 50)) / Math.log(51) : 0;
}

/** CSS performs perceptual Oklab interpolation; endpoints stay exact sRGB colors. */
export function performanceColor(actual: number, requested: number | 'max'): string {
  const ratio = Math.max(0, actual) / (requested === 'max' ? VISUAL_MAX_REFERENCE : requested);
  const upper = requested === 'max' ? 5 : 3;
  if (ratio <= anchors[0]) return PERFORMANCE_COLORS[0];
  if (ratio >= anchors[upper]) return PERFORMANCE_COLORS[upper];
  for (let i = 1; i <= upper; i++) {
    if (ratio === anchors[i]) return PERFORMANCE_COLORS[i];
    if (ratio < anchors[i]) {
      const percent = (ratio - anchors[i - 1]) / (anchors[i] - anchors[i - 1]) * 100;
      return `color-mix(in oklab, ${PERFORMANCE_COLORS[i - 1]}, ${PERFORMANCE_COLORS[i]} ${percent}%)`;
    }
  }
  return PERFORMANCE_COLORS[upper];
}

export type ThroughputReading = {state: 'paused' | 'warming' | 'valid' | 'unavailable'; speed: number | null; version: number};

/** Constant-size observer of authoritative cumulative time, not render FPS or requested multipliers. */
export class ThroughputMeter {
  private requested: SimulationSpeed = 0;
  private epoch = -1;
  private base: {simulation: number; wall: number} | null = null;
  private lastSource = -Infinity;
  private lastMeasurement = -Infinity;
  private actual: number | null = null;
  private version = 0;

  configure(requested: SimulationSpeed, epoch: number): void {
    if (requested === this.requested && epoch === this.epoch) return;
    this.requested = requested; this.epoch = epoch;
    this.base = null; this.actual = null;
    this.lastSource = this.lastMeasurement = -Infinity; this.version++;
  }
  observe(simulation: number, wall: number): void {
    if (this.requested === 0 || !Number.isFinite(simulation) || !Number.isFinite(wall)) return;
    if (!this.base || simulation < this.base.simulation || wall < this.base.wall || wall - this.lastSource > MEASUREMENT_EXPIRY_MS) {
      this.base = {simulation, wall}; this.actual = null; this.version++;
    }
    this.lastSource = wall;
    const elapsed = wall - this.base.wall;
    if (elapsed < MEASUREMENT_WINDOW_MS) return;
    const raw = (simulation - this.base.simulation) * 1000 / elapsed;
    const alpha = 1 - Math.exp(-elapsed / 350);
    this.actual = this.actual === null ? raw : this.actual + alpha * (raw - this.actual);
    this.lastMeasurement = wall; this.base = {simulation, wall}; this.version++;
  }
  read(wall: number): ThroughputReading {
    if (this.requested === 0) return {state: 'paused', speed: null, version: this.version};
    if (this.actual === null) return {state: 'warming', speed: null, version: this.version};
    if (wall - this.lastSource > MEASUREMENT_EXPIRY_MS || wall - this.lastMeasurement > MEASUREMENT_EXPIRY_MS)
      return {state: 'unavailable', speed: null, version: this.version};
    return {state: 'valid', speed: this.actual, version: this.version};
  }
}

export function performanceDescription(reading: ThroughputReading, requested: SimulationSpeed): string {
  if (requested === 0) return 'Simulation advancement paused (0x).';
  const mode = requested === 'max' ? 'MAX mode. x50 is a visual reference, not an execution limit.' : `Requested: x${requested}.`;
  if (reading.speed === null) return `${mode} Actual speed: ${reading.state === 'unavailable' ? 'unavailable' : 'measuring'}.`;
  const actual = `Actual: x${reading.speed.toFixed(2)}.`;
  return requested === 'max' ? `${mode} ${actual} Performance relative to the x50 visual reference: ${(reading.speed / 50 * 100).toFixed(1)}%.`
    : `${mode} ${actual} Achievement: ${(Math.min(1, reading.speed / requested) * 100).toFixed(1)}%.`;
}
