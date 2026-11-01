export const MAX_BATCH_TICKS = 256;
export const FIXED_TICK_SECONDS = 1 / 60;

/** Time until a tick is due, including time spent computing the last batch.
 * Zero means yield through the message queue, without a nested timer delay.
 * Positive delays pace light worlds and avoid a busy loop while paused. */
export function workerWakeDelay(accumulator: number, speed: number | 'max', elapsedMilliseconds: number,
  running: boolean): number {
  if (!running || speed === 0) return 16;
  if (speed === 'max') return 0;
  return Math.max(0, (FIXED_TICK_SECONDS - accumulator) * 1000 / speed - elapsedMilliseconds);
}
