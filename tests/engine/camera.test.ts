import { describe, it, expect } from 'vitest';
import { createCamera, screenToWorld, worldToScreen, panCamera, zoomCameraAt, clampCamera } from '../../src/engine/camera';

describe('camera coordinate mapping', () => {
  it('screenToWorld and worldToScreen are inverses', () => {
    const cam = createCamera(50, 40, 4);
    const vw = 800, vh = 600;
    const { wx, wy } = screenToWorld(cam, 123, 456, vw, vh);
    const { sx, sy } = worldToScreen(cam, wx, wy, vw, vh);
    expect(sx).toBeCloseTo(123, 6);
    expect(sy).toBeCloseTo(456, 6);
  });
  it('viewport center maps to the camera position', () => {
    const cam = createCamera(50, 40, 4);
    const { wx, wy } = screenToWorld(cam, 400, 300, 800, 600);
    expect(wx).toBeCloseTo(50, 6);
    expect(wy).toBeCloseTo(40, 6);
  });
});

describe('panCamera', () => {
  it('moves the camera opposite to the drag, scaled by zoom', () => {
    const cam = createCamera(50, 40, 4);
    const out = panCamera(cam, 8, -4); // dragged right 8px, up 4px
    expect(out.x).toBeCloseTo(50 - 8 / 4, 6);
    expect(out.y).toBeCloseTo(40 - -4 / 4, 6);
    expect(out.zoom).toBe(4);
  });
});

describe('zoomCameraAt', () => {
  it('keeps the world point under the cursor fixed', () => {
    const cam = createCamera(50, 40, 4);
    const vw = 800, vh = 600, sx = 600, sy = 200;
    const before = screenToWorld(cam, sx, sy, vw, vh);
    const out = zoomCameraAt(cam, 2, sx, sy, vw, vh);
    expect(out.zoom).toBeCloseTo(8, 6);
    const after = screenToWorld(out, sx, sy, vw, vh);
    expect(after.wx).toBeCloseTo(before.wx, 6);
    expect(after.wy).toBeCloseTo(before.wy, 6);
  });
});

describe('clampCamera', () => {
  it('clamps zoom and center into range', () => {
    const out = clampCamera(createCamera(-10, 999, 0.1), 256, 256, 1, 40);
    expect(out.zoom).toBe(1);
    expect(out.x).toBe(0);
    expect(out.y).toBe(256);
  });
});
