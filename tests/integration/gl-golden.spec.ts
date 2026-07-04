/**
 * GL golden-image tile-render spot-checks (T097). Rather than commit binary
 * baselines, these assert *invariants* of a full round trip through the real GL
 * pipeline → tiled export → PNG encoder, decoded back with fast-png:
 *
 *   - an unedited export preserves the source pixel dimensions exactly (the
 *     tiler stitches without drift) and a neutral grey stays neutral and mid-
 *     range (no colour cast, no gamma blow-out through the P3 pipeline);
 *   - the Noir filter (saturation −100) drives every pixel onto the grey axis
 *     (R≈G≈B), proving the adjust shader pass runs at export scale (FR-309).
 *
 * WebKit only (matches iOS Safari). Requires: `npx playwright install webkit`.
 */
import { test, expect, type Download } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { decode } from 'fast-png';
import { importPhoto, applyFilter, makeGreyPng, makeTestPng } from './helpers';

const SIZE = 24;

async function exportPng(download: Promise<Download>): Promise<ReturnType<typeof decode>> {
  const path = await (await download).path();
  expect(path, 'download should produce a file').toBeTruthy();
  return decode(readFileSync(path as string));
}

/** Read a pixel's [r,g,b] regardless of 3- vs 4-channel decode. */
function px(img: ReturnType<typeof decode>, x: number, y: number): [number, number, number] {
  const c = img.channels;
  const i = (y * img.width + x) * c;
  return [Number(img.data[i]), Number(img.data[i + 1]), Number(img.data[i + 2])];
}

async function saveAsPng(page: import('@playwright/test').Page): Promise<ReturnType<typeof decode>> {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();
  await page.getByRole('button', { name: 'PNG', exact: true }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save to device' }).click();
  return exportPng(dl);
}

test('unedited export preserves dimensions and neutral tone', async ({ page }) => {
  await importPhoto(page, makeGreyPng(SIZE, SIZE, 128));
  const img = await saveAsPng(page);

  expect(img.width).toBe(SIZE);
  expect(img.height).toBe(SIZE);

  const [r, g, b] = px(img, SIZE >> 1, SIZE >> 1);
  // Neutral in → neutral out, still mid-range (generous P3-tolerant bounds).
  expect(Math.abs(r - g)).toBeLessThanOrEqual(8);
  expect(Math.abs(g - b)).toBeLessThanOrEqual(8);
  expect(r).toBeGreaterThan(80);
  expect(r).toBeLessThan(180);
});

test('Noir filter renders every pixel onto the grey axis', async ({ page }) => {
  await importPhoto(page, makeTestPng(SIZE, SIZE));
  await applyFilter(page, 'Noir');
  const img = await saveAsPng(page);

  expect(img.width).toBe(SIZE);
  expect(img.height).toBe(SIZE);

  // Sample a grid; a desaturated result has R≈G≈B everywhere.
  for (const y of [2, SIZE >> 1, SIZE - 3]) {
    for (const x of [2, SIZE >> 1, SIZE - 3]) {
      const [r, g, b] = px(img, x, y);
      expect(Math.abs(r - g), `pixel ${x},${y} r-g`).toBeLessThanOrEqual(12);
      expect(Math.abs(g - b), `pixel ${x},${y} g-b`).toBeLessThanOrEqual(12);
    }
  }
});
