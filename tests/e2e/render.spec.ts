import { test, expect } from '@playwright/test';

test('WebGL sandbox renders an evolving world', async ({ page }) => {
  await page.goto('/');

  // The engine is live and the founders are seeded.
  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm?: { stats: () => { population: number } } };
    return !!w.__bitcosm && w.__bitcosm.stats().population > 0;
  }, { timeout: 10_000 });

  // Let evolution run past tick 60.
  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm: { stats: () => { tick: number } } };
    return w.__bitcosm.stats().tick > 60;
  }, { timeout: 10_000 });

  const pop = await page.evaluate(() => {
    const w = window as unknown as { __bitcosm: { stats: () => { population: number } } };
    return w.__bitcosm.stats().population;
  });
  expect(pop).toBeGreaterThan(0);

  // The WebGL canvas has non-background pixels: microbe colors push the red or
  // blue channel above the dark background floor (bg ≈ r=10, b=13).
  const coloredPixels = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const gl = c.getContext('webgl') as WebGLRenderingContext;
    const w = c.width, h = c.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > 40 || px[i + 2] > 40) n++;
    }
    return n;
  });
  expect(coloredPixels).toBeGreaterThan(0);

  await page.screenshot({ path: 'test-results/bitcosm-render.png' });
});
