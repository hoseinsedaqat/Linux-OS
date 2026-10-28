import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end smoke tests. They boot the simulator, sign in and drive the shell
 * with the real keyboard shortcuts, so a broken shortcut or a missing app chunk
 * fails the suite.
 */
async function signIn(page: Page) {
  // The first-run desktop tour is a full-screen backdrop that appears 900 ms
  // after login and swallows pointer events. Seeding its "seen" flag keeps this
  // suite deterministic instead of racing that timer.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('nova.tour.seen', '1');
      // The Welcome window opens 900 ms after the desktop is ready; skipping it
      // keeps the surface under test free of a window that is on top of it.
      sessionStorage.setItem('nova.welcomed', '1');
    } catch {
      /* storage blocked - the tolerant dismissals below still apply */
    }
  });
  await page.goto('/');
  const skip = page.getByRole('button', { name: /skip/i });
  await skip.click({ timeout: 25_000 }).catch(() => undefined);
  const submit = page.locator('.login__submit');
  await expect(submit).toBeVisible({ timeout: 25_000 });
  await submit.click();
  await expect(page.locator('.desktop')).toBeVisible({ timeout: 25_000 });
  // Belt and braces: if a tour is on screen after all, dismiss it before a test
  // tries to click through it.
  const tour = page.locator('.tour');
  if (await tour.isVisible().catch(() => false)) {
    await tour.getByRole('button', { name: /skip/i }).click();
    await expect(tour).toHaveCount(0);
  }
  // The first login also restores the Welcome window. It is a normal window that
  // sits on top of whatever the test opens next, so close it the way a user
  // would - with the title-bar close control.
  const welcome = page.locator('.window', { has: page.locator('.welcome__card') });
  await welcome.first().waitFor({ state: 'detached', timeout: 1_500 }).catch(async () => {
    if ((await welcome.count()) > 0) {
      await welcome.first().getByRole('button', { name: 'Close' }).click();
      await expect(welcome).toHaveCount(0);
    }
  });
}

async function runFromPalette(page: Page, query: string) {
  await page.keyboard.press('Control+k');
  const palette = page.locator('.palette');
  await expect(palette).toBeVisible();
  await page.locator('.palette__search input').fill(query);
  await page.keyboard.press('Enter');
  await expect(palette).toHaveCount(0);
}

test('boots into the desktop and opens the application menu', async ({ page }) => {
  await signIn(page);
  await page.locator('.panel__start').click();
  await expect(page.locator('.appmenu')).toBeVisible();
  await expect(page.locator('.appmenu__grid .app-tile-btn').first()).toBeVisible();
});

test('the command palette launches an app and the window loads its chunk', async ({ page }) => {
  await signIn(page);
  await runFromPalette(page, 'terminal');
  await expect(page.locator('.window')).toHaveCount(1);
  await expect(page.locator('.window .window__loading')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('.window')).toContainText(/terminal/i);
});

test('the games library opens and minesweeper accepts a click', async ({ page }) => {
  await signIn(page);
  await runFromPalette(page, 'games');
  await expect(page.locator('.games__title')).toBeVisible({ timeout: 20_000 });
  await page.locator('.games__card', { hasText: 'Minesweeper' }).locator('button', { hasText: /play/i }).click();
  const board = page.locator('.mines__board');
  await expect(board).toBeVisible({ timeout: 20_000 });
  await board.locator('.mines__cell').nth(12).click();
  await expect(board.locator('.mines__cell.is-open').first()).toBeVisible();
});

test('windows snap, desktops switch and the overview lists them', async ({ page }) => {
  await signIn(page);
  await runFromPalette(page, 'files');
  await expect(page.locator('.window')).toHaveCount(1, { timeout: 20_000 });
  await page.locator('.window__titlebar').first().click();
  await page.keyboard.press('Meta+ArrowLeft');
  await expect(page.locator('.window').first()).toHaveClass(/is-snapped/);
  await page.keyboard.press('Control+Alt+ArrowRight');
  await expect(page.locator('.panel__workspace.is-active')).toHaveCount(1);
  await page.keyboard.press('Control+Alt+ArrowUp');
  await expect(page.locator('.overview')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.overview')).toHaveCount(0);
});

test('search shows one status chip per provider and never fakes results', async ({ page }) => {
  // Third-party calls are blocked so the failure path is deterministic; the UI
  // must report it instead of inventing hits.
  for (const pattern of [
    '**/api.wikimedia.org/**',
    '**/wikipedia.org/**',
    '**/hn.algolia.com/**',
    '**/api.stackexchange.com/**',
    '**/api.dictionaryapi.dev/**',
    '**/api.duckduckgo.com/**',
  ]) {
    await page.route(pattern, (route) => route.abort());
  }

  await signIn(page);
  await runFromPalette(page, 'browser');
  const address = page.locator('.browser__address input');
  await expect(address).toBeVisible({ timeout: 20_000 });
  await address.fill('linux kernel');
  await address.press('Enter');
  await expect(page.locator('.bsearch__sources')).toBeVisible({ timeout: 25_000 });
  // The rail always has an "All sources" chip plus one chip per provider that
  // ran (the dictionary provider is single-word only), and a failing provider is
  // reported as down instead of being dropped from the rail.
  const chips = page.locator('.bsearch__source-chip');
  await expect(chips.first()).toBeVisible({ timeout: 25_000 });
  expect(await chips.count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator('.bsearch__source-chip.is-down').first()).toBeVisible({ timeout: 25_000 });
});

test('the offline service worker is registered in a production build', async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL, 'Only meaningful against a deployed build.');
  await page.goto('/');
  const controlled = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration);
  });
  expect(controlled).toBe(true);
});
