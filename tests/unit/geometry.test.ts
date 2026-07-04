/**
 * Crop geometry round-trip (guards the retouch/liquify coordinate fix). A brush
 * stroke captured in cropped-output space is mapped back to full-source space
 * via mapOutputToSource; it must be the exact inverse of mapSourceToOutput so
 * repairs land where the user painted, and must be identity when there's no crop.
 */
import { describe, expect, it } from 'vitest';
import { mapOutputToSource, mapSourceToOutput } from '@/engine/render/geometry';
import { defaultCrop } from '@/engine/editState';
import type { CropParams } from '@/engine/editState';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('crop coordinate mapping', () => {
  it('mapOutputToSource is identity for the default (no) crop', () => {
    const c = defaultCrop();
    for (const p of [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0.25, y: 0.9 }, { x: 1, y: 1 }]) {
      const s = mapOutputToSource(p, c);
      expect(near(s.x, p.x) && near(s.y, p.y), JSON.stringify({ p, s })).toBe(true);
    }
  });

  it('round-trips output -> source -> output across crops and 90° rotations', () => {
    const crops: CropParams[] = [
      { ...defaultCrop(), rect: { x: 0.25, y: 0.1, w: 0.5, h: 0.6 } },
      { ...defaultCrop(), rect: { x: 0.1, y: 0.2, w: 0.4, h: 0.7 }, rotate90: 1 },
      { ...defaultCrop(), rect: { x: 0.3, y: 0.3, w: 0.5, h: 0.5 }, rotate90: 2 },
      { ...defaultCrop(), rect: { x: 0.0, y: 0.4, w: 0.8, h: 0.5 }, rotate90: 3 },
    ];
    for (const c of crops) {
      for (const out of [{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.6 }, { x: 0.5, y: 0.5 }]) {
        const src = mapOutputToSource(out, c);
        const back = mapSourceToOutput(src, c);
        expect(near(back.x, out.x) && near(back.y, out.y), JSON.stringify({ c, out, src, back })).toBe(true);
      }
    }
  });
});
