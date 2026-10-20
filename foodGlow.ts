/** Three presentation-only glow sprites, reused at every size and pulse.
 * No visual asset participates in creature sensing or saved world state. */
const sprites = new Map<string, HTMLCanvasElement>();
export function drawFoodGlow(ctx: CanvasRenderingContext2D, radius: number,
  kind: 'carrion' | 'super' | 'nutrient'): void {
  let sprite = sprites.get(kind);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = 192;
    const paint = sprite.getContext('2d');
    if (!paint) return;
    const center = 96;
    const gradient = paint.createRadialGradient(center, center, center * .3 / 2.6,
      center, center, center);
    const colors = kind === 'carrion'
      ? ['rgba(240,120,106,.75)', 'rgba(190,75,60,.35)', 'rgba(190,75,60,0)']
      : kind === 'super'
        ? ['rgba(52,211,153,.9)', 'rgba(6,182,212,.5)', 'rgba(6,182,212,0)']
        : ['rgba(34,224,120,.75)', 'rgba(16,185,129,.35)', 'rgba(5,150,105,0)'];
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(kind === 'super' ? .4 : .45, colors[1]);
    gradient.addColorStop(1, colors[2]);
    paint.fillStyle = gradient;
    paint.fillRect(0, 0, 192, 192);
    sprites.set(kind, sprite);
  }
  ctx.drawImage(sprite, -radius, -radius, radius * 2, radius * 2);
}
