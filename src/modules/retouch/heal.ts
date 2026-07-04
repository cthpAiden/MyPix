/**
 * Clone/heal stroke construction (US3.5, T086). Both modes build the same
 * RetouchStroke shape; the difference is `mode`, which the retouch GL pass
 * honors — `clone` copies the source patch verbatim, `heal` copies its texture
 * but re-matches the destination's low-frequency tone so a blemish blends in
 * (a manual, no-AI heal).
 */
import type { Point2D, RetouchStroke } from '@/engine/editState';

export type RetouchMode = 'clone' | 'heal';

/** Radius maps a 0…1 brush-size slider to a fraction of the image width. */
export const MIN_RADIUS = 0.01;
export const RADIUS_SPAN = 0.15;

export function radiusFor(sizeSlider: number): number {
  return MIN_RADIUS + sizeSlider * RADIUS_SPAN;
}

/** Begin a stroke anchored at (nx,ny); the source offset stays constant so the
 * copy stays aligned as the brush moves (standard aligned clone/heal). */
export function makeStroke(
  mode: RetouchMode,
  source: Point2D,
  nx: number,
  ny: number,
  radius: number,
  hardness: number,
): RetouchStroke {
  return {
    mode,
    sourceOffset: { x: source.x - nx, y: source.y - ny },
    path: [{ x: nx, y: ny }],
    radius,
    hardness,
  };
}

/** Deep-copy strokes so a mutable in-progress stroke never aliases the store. */
export function cloneStrokes(strokes: RetouchStroke[]): RetouchStroke[] {
  return strokes.map((s) => ({
    ...s,
    sourceOffset: { ...s.sourceOffset },
    path: s.path.map((p) => ({ ...p })),
  }));
}
