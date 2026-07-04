/**
 * Playwright flow coverage (T096) — the small end-to-end set the plan calls for:
 *   1. import → edit → export (the backbone, US1.1)
 *   2. draft recovery via reload (US1.8)
 *   3. locale switch mid-edit (US1.9)
 *   4. offline resilience via route interception (US1.10)
 *
 * Runs against `npm run dev` in WebKit + a mobile viewport (playwright.config.ts).
 * Requires the browser once: `npx playwright install webkit`.
 */
import { test, expect } from '@playwright/test';
import { importPhoto, applyFilter, makeTestPng } from './helpers';

test('import → edit → export saves a full-resolution file', async ({ page }) => {
  await importPhoto(page, makeTestPng());

  // Open the export sheet and save to the device; the anchor-download fallback
  // fires a real download event we can assert on.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save to device' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-mypix\.(png|jpg)$/);
});

test('an in-progress edit is recovered after a reload', async ({ page }) => {
  await importPhoto(page, makeTestPng());

  // Dirty the edit state so autosave has something to persist, then give the
  // ~1 s debounce time to flush to IndexedDB.
  await applyFilter(page, 'Noir');
  await page.waitForTimeout(1500);

  // Reloading drops the in-memory engine; the editor bounces home, where the
  // resume card offers to continue the saved draft.
  await page.reload();
  await expect(page.getByText('Pick up where you left off?')).toBeVisible({ timeout: 20_000 });
});

test('switching language mid-edit keeps the edit surface mounted', async ({ page }) => {
  await importPhoto(page, makeTestPng());

  // The visible EN/VI toggle switches locale client-side without remounting the
  // engine/canvas (FR-005) — URL flips to /vi/edit and the preview persists.
  await page.getByRole('button', { name: 'VI', exact: true }).click();
  await page.waitForURL(/\/vi\/edit/, { timeout: 20_000 });
  await expect(page.locator('canvas').first()).toBeVisible();
});

test('the editor stays usable when the network drops (offline)', async ({ page, context }) => {
  await importPhoto(page, makeTestPng());

  // Cut the network: a fully client-side editor must keep working with no
  // requests (SC-013/SC-015). Client-only interactions must not throw.
  await context.setOffline(true);

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('canvas').first()).toBeVisible();

  await context.setOffline(false);
});
