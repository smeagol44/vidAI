import {TUBE_DEPTH} from './selfTubes';

/** Reusable observer-only world surface. Its universal mask covers decorations,
 * glow, entities and annotations, independent of physical window agreements.
 * It never changes organism opacity, vision, input handling or world records. */
export class WorldSceneLayer {
  private canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D;

  begin(target: CanvasRenderingContext2D): CanvasRenderingContext2D {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d')!;
    }
    const {canvas, context: ctx} = this;
    if (canvas.width !== target.canvas.width) canvas.width = target.canvas.width;
    if (canvas.height !== target.canvas.height) canvas.height = target.canvas.height;
    ctx!.setTransform(1, 0, 0, 1, 0, 0);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    ctx!.save(); ctx!.setTransform(target.getTransform());
    return ctx!;
  }

  finish(target: CanvasRenderingContext2D, width: number, height: number,
    viewLeft: number, viewRight: number, viewTop: number, viewBottom: number): void {
    const ctx = this.context!;
    ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'destination-out';
    // Above/below the tank is fully dark, including protruding mouths and glow.
    ctx.fillStyle = '#000';
    if (viewTop < 0) ctx.fillRect(viewLeft, viewTop, viewRight - viewLeft, -viewTop);
    if (viewBottom > height) ctx.fillRect(viewLeft, height, viewRight - viewLeft, viewBottom - height);
    for (const side of [-1, 1]) {
      const wall = side < 0 ? 0 : width;
      const left = side < 0 ? viewLeft : wall, right = side < 0 ? wall : viewRight;
      if (right <= left) continue;
      const mask = ctx.createLinearGradient(wall, 0, wall + side * TUBE_DEPTH, 0);
      // Same cubic observer fade, 65 stops with <0.0002 interpolation error.
      // Applied along the entire tank height, even beside closed windows.
      for (let i = 0; i <= 64; i++) {
        const fraction = i / 64, removed = 1 - (1 - fraction) ** 3;
        mask.addColorStop(fraction, `rgba(0, 0, 0, ${removed})`);
      }
      ctx.fillStyle = mask;
      // Cover the full visible column. Splitting this at the tank floor/ceiling
      // leaves antialiased seams between sequential destination-out fills.
      ctx.fillRect(left, viewTop, right - left, viewBottom - viewTop);
    }
    ctx.restore(); ctx.restore();
    target.save(); target.setTransform(1, 0, 0, 1, 0, 0);
    target.drawImage(this.canvas!, 0, 0); target.restore();
  }
}
