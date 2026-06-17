import { test, expect } from '@playwright/test';

test('controller boots, exposes stats, and the world evolves', async ({ page }) => {
  await page.goto('/');

  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm?: { stats: () => { population: number } } };
    return !!w.__bitcosm && w.__bitcosm.stats().population > 0;
  }, { timeout: 10_000 });

  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm: { stats: () => { tick: number } } };
    return w.__bitcosm.stats().tick > 30;
  }, { timeout: 10_000 });

  // The HUD root is mounted.
  await expect(page.locator('[data-hud]')).toBeVisible();

  // Controller methods work: a new strain gets a fresh id.
  const newId = await page.evaluate(() => {
    const w = window as unknown as { __bitcosm: { controller: { newStrain: () => number } } };
    return w.__bitcosm.controller.newStrain();
  });
  expect(newId).toBeGreaterThan(5); // 5 founders already exist
});
