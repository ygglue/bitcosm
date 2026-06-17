import { test, expect } from '@playwright/test';

test('viewer renders an evolving colony', async ({ page }) => {
  await page.goto('/');

  // Wait until the sim is live and has a living population.
  await page.waitForFunction(() => {
    const w = window as unknown as { __microcosm?: { state: { microbes: (unknown | null)[] } } };
    if (!w.__microcosm) return false;
    return w.__microcosm.state.microbes.some((m) => m !== null);
  }, { timeout: 10_000 });

  // Let evolution run a bit.
  await page.waitForFunction(() => {
    const w = window as unknown as { __microcosm: { state: { tick: number } } };
    return w.__microcosm.state.tick > 60;
  }, { timeout: 10_000 });

  // Population is alive.
  const pop = await page.evaluate(() => {
    const w = window as unknown as { __microcosm: { state: { microbes: (unknown | null)[] } } };
    return w.__microcosm.state.microbes.filter((m) => m !== null).length;
  });
  expect(pop).toBeGreaterThan(0);

  // Canvas has non-background (microbe) pixels: red or blue channel above the
  // background floor (bg is r=10, b=20; microbe colors push these higher).
  const coloredPixels = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 40 || data[i + 2] > 40) n++;
    }
    return n;
  });
  expect(coloredPixels).toBeGreaterThan(0);

  await page.screenshot({ path: 'test-results/microcosm-smoke.png' });
});
