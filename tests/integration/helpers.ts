/**
 * Shared Playwright helpers for the flow + golden specs (T096/T097).
 *
 * These specs drive the *real* app (WebGL2 pipeline, IndexedDB, tiled export)
 * against `npm run dev` in WebKit — the closest desktop engine to iOS Safari.
 * They therefore need the browser installed once:  `npx playwright install webkit`.
 */
import { expect, type Page } from '@playwright/test';
import { encode } from 'fast-png';

/**
 * A deterministic test image with a strong hue sweep across x and a value ramp
 * across y, so desaturating/adjusting it produces a verifiable change.
 */
export function makeTestPng(w = 24, h = 24): Buffer {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = Math.round((x / (w - 1)) * 255); // R sweeps left→right
      data[i + 1] = Math.round((y / (h - 1)) * 255); // G sweeps top→bottom
      data[i + 2] = Math.round((1 - x / (w - 1)) * 255); // B sweeps right→left
      data[i + 3] = 255;
    }
  }
  return Buffer.from(encode({ width: w, height: h, data, channels: 4, depth: 8 }));
}

/** A uniform mid-grey image — value survives any adjustment-free round trip. */
export function makeGreyPng(w = 24, h = 24, v = 128): Buffer {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return Buffer.from(encode({ width: w, height: h, data, channels: 4, depth: 8 }));
}

/**
 * Home → pick a photo → land on the editor with a live preview canvas.
 * Uses the native file chooser the intake opens (no live camera; Constitution III).
 */
export async function importPhoto(page: Page, buffer: Buffer, name = 'test.png'): Promise<void> {
  await page.goto('/en');
  const choose = page.getByRole('button', { name: 'Choose a photo' });
  await expect(choose).toBeVisible();

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), choose.click()]);
  await chooser.setFiles({ name, mimeType: 'image/png', buffer });

  await page.waitForURL(/\/en\/edit/, { timeout: 30_000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
}

/** Open a tool by its (localized) toolbar label and tap a chip within its panel. */
export async function applyFilter(page: Page, chipLabel: string): Promise<void> {
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('button', { name: chipLabel, exact: true }).click();
}
