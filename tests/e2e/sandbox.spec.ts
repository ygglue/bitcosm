import { test, expect } from '@playwright/test';

test('design → seed → grow → save → reload → load', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm?: { stats: () => { population: number } } };
    return !!w.__bitcosm && w.__bitcosm.stats().population > 0;
  }, { timeout: 10_000 });

  // Design: lower diet so the new strain is a fast herbivore, within budget.
  await page.locator('[data-trait="diet"]').fill('0.05');

  // New strain + Seed tool, then paint a short drag across the canvas centre.
  await page.locator('[data-action="new-strain"]').click();
  await page.locator('[data-tool="seed"]').click();
  const id = Number(await page.locator('[data-active-strain]').getAttribute('data-active-strain'));

  const box = (await page.locator('#world').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 30, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 30, cy, { steps: 8 });
  await page.mouse.up();

  // The new strain establishes and grows.
  await page.waitForFunction((sid) => {
    const w = window as unknown as { __bitcosm: { stats: () => { perStrain: Record<number, number> } } };
    return (w.__bitcosm.stats().perStrain[sid] ?? 0) >= 1;
  }, id, { timeout: 10_000 });

  // Save, reload, load, and confirm the strain survived the round-trip.
  await page.locator('[data-action="toggle-pause"]').click();
  await page.locator('[data-save="slot-2"]').click();
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __bitcosm?: unknown }).__bitcosm, { timeout: 10_000 });
  await page.locator('[data-load="slot-2"]').click();

  const restored = await page.evaluate((sid) => {
    const w = window as unknown as { __bitcosm: { stats: () => { perStrain: Record<number, number> } } };
    return w.__bitcosm.stats().perStrain[sid] ?? 0;
  }, id);
  expect(restored).toBeGreaterThan(0);

  await page.screenshot({ path: 'test-results/bitcosm-sandbox.png' });
});
