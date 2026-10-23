/** Diagnostic-only unilateral angular stop. Clamp the accumulated impulse,
 * not each iteration's increment: later iterations may release prior pressure. */
export function unilateralLimitStep(relativeSpeed:number,bias:number,inverseInertia:number,previous:number,upper:boolean) {
  const proposed=previous-(relativeSpeed+bias)/inverseInertia;
  const total=upper?Math.min(0,proposed):Math.max(0,proposed);
  return {impulse:total-previous,total};
}
