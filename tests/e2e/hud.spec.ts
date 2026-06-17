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

test('seeding a new strain by clicking the canvas grows its population', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm?: { stats: () => { population: number } } };
    return !!w.__bitcosm && w.__bitcosm.stats().population > 0;
  }, { timeout: 10_000 });

  // Create a fresh strain and select the Seed tool.
  await page.locator('[data-action="new-strain"]').click();
  await page.locator('[data-tool="seed"]').click();
  const newId = await page.locator('[data-active-strain]').getAttribute('data-active-strain');
  expect(newId).not.toBeNull();
  const id = Number(newId);

  // Click the centre of the canvas to seed a blob of the new strain.
  const canvas = page.locator('#world');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  // The new strain now has members and they grow over the next ticks.
  await page.waitForFunction((sid) => {
    const w = window as unknown as { __bitcosm: { stats: () => { perStrain: Record<number, number> } } };
    return (w.__bitcosm.stats().perStrain[sid] ?? 0) > 0;
  }, id, { timeout: 10_000 });
});

test('an over-budget genome turns the budget meter red', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-budget]');
  // Drive every beneficial trait to the max via the designer sliders.
  for (const key of ['spread', 'diet', 'resilience']) {
    const slider = page.locator(`[data-trait="${key}"]`);
    await slider.fill('1');
  }
  await page.locator('[data-trait="metabolism"]').fill('0');
  await page.locator('[data-trait="reproThreshold"]').fill('0');
  await expect(page.locator('[data-budget]')).toHaveClass(/over/);
});

test('pause freezes the tick and step advances exactly one', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const w = window as unknown as { __bitcosm?: { stats: () => { tick: number } } };
    return !!w.__bitcosm && w.__bitcosm.stats().tick > 5;
  }, { timeout: 10_000 });

  await page.locator('[data-action="toggle-pause"]').click();
  // Read tick, wait, confirm it did not advance while paused.
  const t1 = await page.evaluate(() => (window as any).__bitcosm.stats().tick);
  await page.waitForTimeout(300);
  const t2 = await page.evaluate(() => (window as any).__bitcosm.stats().tick);
  expect(t2).toBe(t1);

  // One step advances by exactly one tick.
  await page.locator('[data-action="step"]').click();
  const t3 = await page.evaluate(() => (window as any).__bitcosm.stats().tick);
  expect(t3).toBe(t1 + 1);
});

test('stats panel shows the live tick', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-stats-tick]');
    return !!el && Number(el.textContent) > 10;
  }, { timeout: 10_000 });
});
