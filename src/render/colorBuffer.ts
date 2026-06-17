import type { WorldState } from '../sim/types';
import { strainColor } from '../colors';

export function fillColorBuffer(world: WorldState, buf: Uint8Array): void {
  const { width, height, food, microbes } = world;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const m = microbes[i];
    let r: number, g: number, b: number;
    if (m) {
      [r, g, b] = strainColor(m.strainId);
    } else {
      const f = food[i];
      r = 10;
      g = Math.round(30 + f * 120);
      b = 20;
    }
    const o = i * 4;
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
    buf[o + 3] = 255;
  }
}
