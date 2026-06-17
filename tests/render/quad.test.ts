import { describe, it, expect } from 'vitest';
import { worldQuadClip } from '../../src/render/quad';
import { createCamera } from '../../src/engine/camera';

describe('worldQuadClip', () => {
  it('maps a centered, exactly-fitting world to the full clip square', () => {
    const W = 100, H = 100, vw = 800, vh = 800;
    // zoom = vw / W makes the world exactly fill the viewport.
    const cam = createCamera(W / 2, H / 2, vw / W);
    const q = worldQuadClip(cam, W, H, vw, vh);
    expect(q[0]).toBeCloseTo(-1, 5); // TL x
    expect(q[1]).toBeCloseTo(1, 5);  // TL y (clip up)
    expect(q[2]).toBeCloseTo(1, 5);  // TR x
    expect(q[3]).toBeCloseTo(1, 5);  // TR y
    expect(q[4]).toBeCloseTo(-1, 5); // BL x
    expect(q[5]).toBeCloseTo(-1, 5); // BL y
    expect(q[6]).toBeCloseTo(1, 5);  // BR x
    expect(q[7]).toBeCloseTo(-1, 5); // BR y
  });

  it('zooming out to half shrinks the quad to the centre half of clip space', () => {
    const W = 100, H = 100, vw = 800, vh = 800;
    const cam = createCamera(W / 2, H / 2, (vw / W) / 2);
    const q = worldQuadClip(cam, W, H, vw, vh);
    expect(q[0]).toBeCloseTo(-0.5, 5); // TL x
    expect(q[1]).toBeCloseTo(0.5, 5);  // TL y
    expect(q[6]).toBeCloseTo(0.5, 5);  // BR x
    expect(q[7]).toBeCloseTo(-0.5, 5); // BR y
  });
});
