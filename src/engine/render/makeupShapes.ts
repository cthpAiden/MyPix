/**
 * Landmark-anchored makeup geometry (US3.1, T079). Given a detected face, derive
 * the polygons / strokes / soft blobs a makeup layer paints — lips, blush,
 * eyeshadow, liner, brow — in *original-image normalized* [0,1] coordinates.
 *
 * A makeup Layer stores intent (type/color/intensity/finish), never baked
 * pixels; the compositor calls this every render so the makeup tracks the face
 * (contracts/edit-state.md — LandmarkAnchor re-derives geometry at render time).
 */
import { facePolygons } from '@/vision/facePolygons';
import type { BlendMode, MakeupType, Point2D } from '@/engine/editState';
import type { FaceLandmarks } from '@/vision/types';

/**
 * Largest feather (softRel) any makeup type uses — blush. The export band
 * compositor sizes its band overlap from this so a feathered blob never seams
 * at a band boundary. Keep in sync with the max softRel returned below.
 */
export const MAX_MAKEUP_SOFT_REL = 0.02;

export interface MakeupShape {
  /** Filled polygons (normalized original space). */
  fills: Point2D[][];
  /** Stroked polylines (e.g. eyeliner). */
  strokes: { path: Point2D[]; widthRel: number }[];
  /** Soft radial blobs (blush) — center + radii as fractions of image dims. */
  blobs: { cx: number; cy: number; rx: number; ry: number }[];
  /** Feather amount as a fraction of the image min-dimension. */
  softRel: number;
}

/** The tasteful default composite mode for each makeup type. */
export function makeupDefaultBlend(type: MakeupType): BlendMode {
  switch (type) {
    case 'lipstick':
    case 'brow':
    case 'liner':
      return 'multiply';
    case 'blush':
    case 'eyeshadow':
      return 'softLight';
  }
}

function centroid(pts: Point2D[]): Point2D {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

function bbox(pts: Point2D[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Upper-lid band + centerline for one eye ring (points above the eye center). */
function eyeUpper(ring: Point2D[]): { lid: Point2D[]; band: Point2D[] } {
  const c = centroid(ring);
  const upper = ring.filter((p) => p.y <= c.y).sort((a, b) => a.x - b.x);
  const lid = upper.length >= 2 ? upper : ring.slice().sort((a, b) => a.x - b.x);
  const eyeH = Math.max(...ring.map((p) => p.y)) - Math.min(...ring.map((p) => p.y));
  // Lift the lid upward to make a shadow band that hugs the crease.
  const lifted = lid.map((p) => ({ x: p.x, y: p.y - eyeH * 1.1 }));
  const band = [...lid, ...lifted.reverse()];
  return { lid, band };
}

export function makeupShapes(
  type: MakeupType,
  face: FaceLandmarks,
  imgW: number,
  imgH: number,
): MakeupShape {
  const poly = facePolygons(face, imgW, imgH);
  const empty: MakeupShape = { fills: [], strokes: [], blobs: [], softRel: 0.01 };

  switch (type) {
    case 'lipstick':
      return { ...empty, fills: [poly.lipsOuter], softRel: 0.006 };

    case 'brow':
      return { ...empty, fills: poly.brows, softRel: 0.004 };

    case 'eyeshadow': {
      const bands = poly.eyes.map((e) => eyeUpper(e).band);
      return { ...empty, fills: bands, softRel: 0.012 };
    }

    case 'liner': {
      const strokes = poly.eyes.map((e) => ({ path: eyeUpper(e).lid, widthRel: 0.004 }));
      return { ...empty, strokes, softRel: 0.003 };
    }

    case 'blush': {
      const face2 = bbox(poly.faceOval);
      const faceW = face2.maxX - face2.minX;
      const cx = (face2.minX + face2.maxX) / 2;
      const eyeY = centroid([...poly.eyes[0], ...poly.eyes[1]]).y;
      const mouthY = centroid(poly.lipsOuter).y;
      const cheekY = eyeY + (mouthY - eyeY) * 0.55;
      const offX = faceW * 0.24;
      const rx = faceW * 0.16;
      const ry = rx * 1.15;
      return {
        ...empty,
        blobs: [
          { cx: cx - offX, cy: cheekY, rx, ry },
          { cx: cx + offX, cy: cheekY, rx, ry },
        ],
        softRel: 0.02,
      };
    }
  }
}
