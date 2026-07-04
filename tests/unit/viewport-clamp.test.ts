/**
 * Viewport clamp math (US3 / contracts/viewport.md Verification): the default
 * fit frames the whole photo with a margin, zoom stays in [1, ~4× actual], pan
 * can't drag the image out of view, and fit recomputes on container resize.
 */
import { describe, expect, it } from 'vitest';
import {
  VIEWPORT_MARGIN,
  MAX_ACTUAL_PIXELS,
  computeFit,
  maxScale,
  clampScale,
  clampTranslate,
} from '@/ui/useViewport';

describe('computeFit', () => {
  it('frames the whole photo with the comfortable margin (never edge-to-edge)', () => {
    // Landscape photo in a portrait-ish container → width-constrained.
    const fit = computeFit(400, 800, 2000, 1000);
    expect(fit).toBeCloseTo((400 / 2000) * VIEWPORT_MARGIN, 6);
    // Rendered size is strictly inside the container on the constraining axis.
    expect(2000 * fit).toBeLessThan(400);
  });

  it('picks the constraining axis (min of width/height ratios)', () => {
    // Tall photo in a wide container → height-constrained.
    const fit = computeFit(1000, 500, 1000, 2000);
    expect(fit).toBeCloseTo((500 / 2000) * VIEWPORT_MARGIN, 6);
  });

  it('recomputes when the container resizes', () => {
    const before = computeFit(400, 800, 2000, 1000);
    const after = computeFit(800, 800, 2000, 1000); // container widened
    expect(after).toBeGreaterThan(before);
    expect(after).toBeCloseTo((800 / 2000) * VIEWPORT_MARGIN, 6);
  });

  it('is safe for degenerate sizes', () => {
    expect(computeFit(0, 0, 100, 100)).toBe(1);
    expect(computeFit(100, 100, 0, 0)).toBe(1);
  });
});

describe('scale bounds', () => {
  it('sMax equals 4× actual pixels relative to the fit', () => {
    const fit = 0.2;
    expect(maxScale(fit)).toBeCloseTo(MAX_ACTUAL_PIXELS / fit, 6);
  });

  it('clamps scale into [1, sMax] and never zooms out past the whole photo', () => {
    const fit = 0.25; // sMax = 16
    expect(clampScale(0.3, fit)).toBe(1); // can't go below the default view
    expect(clampScale(1, fit)).toBe(1);
    expect(clampScale(8, fit)).toBe(8);
    expect(clampScale(999, fit)).toBe(maxScale(fit));
  });
});

describe('clampTranslate', () => {
  const cW = 400;
  const cH = 800;
  const outW = 2000;
  const outH = 1000;
  const fit = computeFit(cW, cH, outW, outH); // 0.18

  it('pins to center at the default view (image smaller than the container)', () => {
    const c = clampTranslate(120, -90, 1, fit, cW, cH, outW, outH);
    expect(Math.abs(c.tx)).toBe(0);
    expect(Math.abs(c.ty)).toBe(0);
  });

  it('allows pan within bounds once the scaled image exceeds the container', () => {
    const scale = 8;
    const renderedW = outW * fit * scale;
    const maxX = (renderedW - cW) / 2;
    // A request beyond the bound is clamped to the bound…
    expect(clampTranslate(99999, 0, scale, fit, cW, cH, outW, outH).tx).toBeCloseTo(maxX, 6);
    expect(clampTranslate(-99999, 0, scale, fit, cW, cH, outW, outH).tx).toBeCloseTo(-maxX, 6);
    // …and a request inside the bound is preserved.
    const inside = maxX / 2;
    expect(clampTranslate(inside, 0, scale, fit, cW, cH, outW, outH).tx).toBeCloseTo(inside, 6);
  });

  it('never lets the image be dragged completely out of the viewport', () => {
    const scale = 8;
    const c = clampTranslate(1e6, 1e6, scale, fit, cW, cH, outW, outH);
    const renderedW = outW * fit * scale;
    const renderedH = outH * fit * scale;
    // The clamped edge still covers the viewport edge.
    expect(Math.abs(c.tx)).toBeLessThanOrEqual((renderedW - cW) / 2 + 1e-6);
    expect(Math.abs(c.ty)).toBeLessThanOrEqual((renderedH - cH) / 2 + 1e-6);
  });
});
