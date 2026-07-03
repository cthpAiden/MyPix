/**
 * Canonical social aspect-ratio preset set (FR-113), shared by the crop module
 * (US1.3) and export delivery (US1.1). `ratio` is width/height; null = freeform.
 */
import type { AspectRatioId } from '@/engine/editState';

export interface AspectRatioDef {
  id: AspectRatioId;
  ratio: number | null;
}

export const ASPECT_RATIOS: AspectRatioDef[] = [
  { id: 'free', ratio: null },
  { id: '1:1', ratio: 1 },
  { id: '4:5', ratio: 4 / 5 },
  { id: '9:16', ratio: 9 / 16 },
  { id: '16:9', ratio: 16 / 9 },
  { id: '4:3', ratio: 4 / 3 },
  { id: '3:2', ratio: 3 / 2 },
];

export function aspectRatioLabelKey(id: AspectRatioId): string {
  return `aspect.${id}`;
}

export function ratioFor(id: AspectRatioId): number | null {
  return ASPECT_RATIOS.find((r) => r.id === id)?.ratio ?? null;
}

/**
 * Given a source width/height and a target ratio, compute the centered crop
 * rect (normalized 0…1) that yields that ratio without upscaling.
 */
export function centeredRectForRatio(
  srcW: number,
  srcH: number,
  ratio: number | null,
): { x: number; y: number; w: number; h: number } {
  if (ratio == null) return { x: 0, y: 0, w: 1, h: 1 };
  const srcRatio = srcW / srcH;
  if (ratio > srcRatio) {
    // target is wider → full width, crop height
    const h = srcRatio / ratio;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  const w = ratio / srcRatio;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}
