export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function key(x, y) { return `${x},${y}`; }

export function insideEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return (dx*dx + dy*dy) <= 1;
}

export function drawPixelRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x|0, y|0, w|0, h|0);
}

export function drawDitheredRect(ctx, x, y, w, h, cA, cB, step = 2) {
  for (let yy = 0; yy < h; yy += step) {
    for (let xx = 0; xx < w; xx += step) {
      ctx.fillStyle = (((xx/step + yy/step) | 0) % 2 === 0) ? cA : cB;
      ctx.fillRect((x+xx)|0, (y+yy)|0, step, step);
    }
  }
}

// Simple deterministic RNG (LCG)
export class RNG {
  constructor(seed = 123456789) {
    this.seed = seed >>> 0;
  }
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
}
