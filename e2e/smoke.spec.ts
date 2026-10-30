import { expect, test, type Page } from '@playwright/test';

type EpochDebug = {
  start(seed?: number, difficulty?: string, civ?: string): unknown;
  state(): {
    result: string;
    seed: number;
    tick: number;
    player: { stock: Record<string, number>; villagers: number; buildings: number; age: number };
    hash: string;
  } | null;
  command(command: Record<string, unknown>): void;
  step(ticks?: number): number | null;
  fastForward(seconds?: number): number | null;
  selection(ids: number[]): void;
  selectionIds(): number[];
  buildings(): Array<{ id: number; type: string; x: number; y: number; complete: boolean }>;
  villagers(): Array<{ id: number; x: number; y: number; order: string }>;
  nodes(): Array<{ id: number; node: string; x: number; y: number }>;
  project(x: number, y: number): { x: number; y: number };
  canPlace(type: string, x: number, y: number): boolean;
  showcase(): unknown;
  setPaused(paused: boolean): void;
};

declare global {
  interface Window {
    __epoch: EpochDebug;
  }
}

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#title-screen')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__epoch));
}

async function startMatch(page: Page): Promise<void> {
  await page.click('#start-button');
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#title-screen')).toBeHidden();
}

test('title screen offers three courts and a deterministic seed', async ({ page }) => {
  await boot(page);
  await expect(page.locator('h1')).toContainText('Epoch of');
  await expect(page.locator('.civ-card')).toHaveCount(3);
  await expect(page.locator('#seed-input')).toHaveValue('20261030');
  await expect(page.locator('#start-button')).toBeVisible();
});

test('starting a match reveals the HUD, resources, and town center commands', async ({ page }) => {
  await boot(page);
  await startMatch(page);
  await expect(page.locator('#resources .resource')).toHaveCount(4);
  await expect(page.locator('#map-seed')).toHaveText('seed 20261030');
  await expect(page.locator('#clock')).toHaveText(/^\d{2}:\d{2}$/);

  const tc = (await page.evaluate(() => window.__epoch.buildings())).find((b) => b.type === 'townCenter');
  expect(tc).toBeTruthy();
  await page.evaluate((id) => window.__epoch.selection([id]), tc!.id);
  await expect(page.locator('#selection-title')).toHaveText('Town Center');
  await expect(page.locator('#command-grid .cmd-name')).toContainText(['Villager', 'Advance: Feudal Age']);
});

test('a villager can be selected on the canvas and placed into build mode', async ({ page }) => {
  await boot(page);
  await startMatch(page);
  const villager = (await page.evaluate(() => window.__epoch.villagers()))[0]!;
  const point = await page.evaluate(({ x, y }) => window.__epoch.project(x, y), { x: villager.x, y: villager.y });
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#selection-title')).toHaveText('Villager');
  await page.locator('#command-grid button').first().click();
  await expect(page.locator('#command-context')).toHaveText('Place House');
  await expect(page.locator('#queue-summary')).toContainText('Left-click to place');
});

test('pause, controls, and resign modals are reachable', async ({ page }) => {
  await boot(page);
  await startMatch(page);
  await page.keyboard.press('p');
  await expect(page.locator('#modal-title')).toHaveText('Paused');
  await page.click('#resume-button');
  await expect(page.locator('#modal')).toBeHidden();
  await page.keyboard.press('F1');
  await expect(page.locator('#modal-title')).toHaveText('Controls');
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).toBeHidden();
  await page.keyboard.press('p');
  await page.click('#resign-button');
  await expect(page.locator('#modal-title')).toHaveText('Defeat');
});

test('the same seed and commands produce the same state hash', async ({ page }) => {
  await boot(page);
  const hashes = await page.evaluate(() => {
    const run = () => {
      window.__epoch.start(424242, 'normal', 'aurelians');
      window.__epoch.setPaused(true);
      window.__epoch.fastForward(30);
      return window.__epoch.state()!.hash;
    };
    return [run(), run()];
  });
  expect(hashes[0]).toBe(hashes[1]);
});

test('the showcase scene renders a populated castle-age base', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__epoch.start(20261030, 'normal', 'aurelians');
    window.__epoch.showcase();
  });
  await expect(page.locator('#age-label')).toHaveText('Castle Age');
  await expect(page.locator('#command-grid .cmd-name')).toContainText(['Attack-move', 'Stop', 'Hold']);
  await expect(page.locator('#selection-title')).toHaveText('War band');
});
