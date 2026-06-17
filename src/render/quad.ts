import type { Camera } from '../engine/camera';
import { worldToScreen } from '../engine/camera';

// Clip-space positions (x,y in [-1,1]) for the world's bounding quad under the
// camera, in TRIANGLE_STRIP order: TL(0,0), TR(W,0), BL(0,H), BR(W,H).
// Screen y grows downward; clip y grows upward, so we flip y.
export function worldQuadClip(
  cam: Camera,
  worldW: number,
  worldH: number,
  vw: number,
  vh: number,
): Float32Array {
  const corners: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [worldW, 0],
    [0, worldH],
    [worldW, worldH],
  ];
  const out = new Float32Array(8);
  for (let k = 0; k < 4; k++) {
    const [wx, wy] = corners[k];
    const { sx, sy } = worldToScreen(cam, wx, wy, vw, vh);
    out[k * 2] = (sx / vw) * 2 - 1;
    out[k * 2 + 1] = 1 - (sy / vh) * 2;
  }
  return out;
}
