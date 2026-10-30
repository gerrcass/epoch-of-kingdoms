import { expect, test } from '@playwright/test';

test('capture the README screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await expect(page.locator('#title-screen')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__epoch));
  await page.click('#start-button');
  await page.evaluate(() => window.__epoch.showcase());
  await expect(page.locator('#age-label')).toHaveText('Castle Age');
  // Let the opening notification fade before the still.
  await page.waitForTimeout(5200);
  await page.screenshot({ path: 'docs/media/game.png' });
});
