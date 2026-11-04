import type {Egg} from './simulation';

type ReserveState = Pick<Egg, 'fundedReserve' | 'initialFundedReserve'>;

/** Additive save metadata only. A missing historical reference is never inferred. */
export function eggReserveReference(egg: ReserveState) {
  return egg.initialFundedReserve === undefined
    ? {initialFundedReserve: egg.fundedReserve, initialReserveIsLegacy: true as const}
    : {};
}

/** Human display only; structural funding and hatch requirements are irrelevant. */
export function eggReserveLossFraction(egg: ReserveState): number {
  const current = egg.fundedReserve;
  const initial = egg.initialFundedReserve ?? current;
  // Invalid runtime data must not send NaN/Infinity into canvas geometry.
  // Snapshot validation rejects these states rather than changing real energy.
  if (!Number.isFinite(current) || !Number.isFinite(initial) || initial < 0) return 1;
  // No original usable reserve: empty is pink, positive existing uptake is white.
  if (initial === 0) return current > 0 ? 0 : 1;
  return Math.max(0, Math.min(1, 1 - current / initial));
}

export const EGG_RESERVE_LOSS_COLOR = '#f4a7c1';

/** Paint inside the existing shell; leave glow, texture and outer rings to the host. */
export function drawEggReserveLoss(ctx: CanvasRenderingContext2D, egg: ReserveState): void {
  const loss = eggReserveLossFraction(egg);
  if (loss === 0) return;
  ctx.beginPath();
  if (loss < 1) ctx.moveTo(0, 0);
  ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2 * loss, true);
  ctx.closePath();
  ctx.fillStyle = EGG_RESERVE_LOSS_COLOR;
  ctx.fill();
}
