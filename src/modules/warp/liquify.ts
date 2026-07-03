/**
 * Liquify stroke helpers (US2.6, T073). Brush size maps to a normalized radius;
 * strokes carry their mode (push/freeze/reconstruct), radius, and strength so the
 * warp field (shared/warp/field) can accumulate them in order. Freehand push
 * strokes give push/pull; the drag direction is the pull direction.
 */
import type { LiquifyStroke } from '@/engine/editState';

/** Brush size 0…1 → normalized radius (fraction of the image). */
export function sizeToRadius(size: number): number {
  return 0.03 + size * 0.22;
}

export function makeStroke(
  mode: LiquifyStroke['mode'],
  size: number,
  strength: number,
  nx: number,
  ny: number,
): LiquifyStroke {
  return { mode, radius: sizeToRadius(size), strength, path: [{ x: nx, y: ny }] };
}

/** Deep-copy the stroke list so live edits never mutate committed edit-state. */
export function cloneStrokes(strokes: LiquifyStroke[]): LiquifyStroke[] {
  return strokes.map((s) => ({ ...s, path: s.path.map((p) => ({ ...p })) }));
}
