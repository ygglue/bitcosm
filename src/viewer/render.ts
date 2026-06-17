import type { WorldState } from '../sim/index';

// Distinct, stable color per strain via the golden-ratio hue trick.
export function strainColor(strainId: number): [number, number, number] {
  const hue = (strainId * 0.61803398875) % 1;
  return hslToRgb(hue, 0.7, 0.55);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  const seg = Math.floor(h * 6);
  if (seg === 0) [r, g, b] = [c, x, 0];
  else if (seg === 1) [r, g, b] = [x, c, 0];
  else if (seg === 2) [r, g, b] = [0, c, x];
  else if (seg === 3) [r, g, b] = [0, x, c];
  else if (seg === 4) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function render(state: WorldState, ctx: CanvasRenderingContext2D): void {
  const { width, height, food, microbes } = state;
  const img = ctx.createImageData(width, height);
  const d = img.data;
  for (let i = 0; i < width * height; i++) {
    const m = microbes[i];
    let r: number, g: number, b: number;
    if (m) {
      [r, g, b] = strainColor(m.strainId);
    } else {
      const f = food[i]; // 0..1
      r = 10;
      g = Math.round(30 + f * 120);
      b = 20;
    }
    const o = i * 4;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
