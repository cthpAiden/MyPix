/**
 * Collage document model (US3.7, T088). A CollageProject composes several source
 * images into a laid-out grid — it composes Projects rather than being a Layer in
 * one (data-model.md). Cells and layouts are normalized [0,1] over a square
 * output; the same render function drives the on-screen preview and the high-res
 * export.
 */
export interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CollageLayout {
  id: string;
  cellCount: number;
  cells: Cell[];
}

export const LAYOUTS: CollageLayout[] = [
  { id: '2h', cellCount: 2, cells: [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ] },
  { id: '2v', cellCount: 2, cells: [
    { x: 0, y: 0, w: 1, h: 0.5 },
    { x: 0, y: 0.5, w: 1, h: 0.5 },
  ] },
  { id: '3l', cellCount: 3, cells: [
    { x: 0, y: 0, w: 0.6, h: 1 },
    { x: 0.6, y: 0, w: 0.4, h: 0.5 },
    { x: 0.6, y: 0.5, w: 0.4, h: 0.5 },
  ] },
  { id: '4', cellCount: 4, cells: [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ] },
];

export interface CollageProject {
  layoutId: string;
  spacing: number; // 0…1 → gap
  radius: number; // 0…1 → corner rounding
  background: string;
  /** Object URL per cell index, or null for an empty cell. */
  cells: (string | null)[];
}

export function layoutById(id: string): CollageLayout {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

export function defaultCollage(): CollageProject {
  return { layoutId: '2h', spacing: 0.25, radius: 0.15, background: '#0d0d0f', cells: [null, null] };
}
