/**
 * Per-feature reshape displacement functions (research R5 step 2, T062/T063).
 *
 * Each control (jaw, chin, nose, lips, brows, eyes) is a pure function
 * `params → per-landmark displacement vectors` acting only on its own region's
 * landmark indices, so a slider's effect stays confined to its feature and
 * everything else (and the anchor ring) stays at zero. Displacements are in
 * normalized [0,1] image units. This module is unit-tested (T064).
 */
import type { FaceReshapeParams, Point2D } from '@/engine/editState';
import type { FaceRegions } from '@/vision/types';

/** Sparse landmark-index → displacement map (absent = zero). */
export type DisplacementMap = Map<number, Point2D>;

export interface FaceFrame {
  /** Normalized [0,1] positions of all face landmarks. */
  points: Point2D[];
  regions: FaceRegions;
}

function add(map: DisplacementMap, i: number, dx: number, dy: number): void {
  const cur = map.get(i);
  if (cur) {
    cur.x += dx;
    cur.y += dy;
  } else {
    map.set(i, { x: dx, y: dy });
  }
}

function centroid(points: Point2D[], indices: number[]): Point2D {
  let x = 0;
  let y = 0;
  for (const i of indices) {
    x += points[i].x;
    y += points[i].y;
  }
  const n = indices.length || 1;
  return { x: x / n, y: y / n };
}

function bbox(points: Point2D[], indices: number[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const i of indices) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX || 1e-4, h: maxY - minY || 1e-4 };
}

function smooth(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Compute the reshape displacement map for one face. Only landmark indices in
 * the affected regions receive non-zero displacement.
 */
export function faceReshapeDisplacements(
  frame: FaceFrame,
  params: FaceReshapeParams,
): DisplacementMap {
  const { points, regions } = frame;
  const map: DisplacementMap = new Map();
  const face = bbox(points, regions.faceOval);
  const center = centroid(points, regions.faceOval);
  const fw = face.w;
  const fh = face.h;

  // Jaw (−1 slim … +1 wide): lower face-oval points move horizontally.
  if (params.jaw !== 0) {
    for (const i of regions.faceOval) {
      const p = points[i];
      const below = smooth((p.y - center.y) / (fh * 0.5));
      add(map, i, params.jaw * (p.x - center.x) * 0.22 * below, 0);
    }
  }

  // Chin (−1 shorter … +1 longer): lowest oval points move vertically.
  if (params.chin !== 0) {
    for (const i of regions.faceOval) {
      const p = points[i];
      const low = smooth((p.y - center.y) / (fh * 0.5) - 0.4);
      add(map, i, 0, params.chin * fh * 0.16 * low);
    }
  }

  // Cheek width: mid-height oval points move horizontally from center.
  if (params.cheekWidth !== 0) {
    for (const i of regions.faceOval) {
      const p = points[i];
      const mid = 1 - smooth(Math.abs(p.y - center.y) / (fh * 0.4));
      add(map, i, params.cheekWidth * (p.x - center.x) * 0.18 * mid, 0);
    }
  }

  // Forehead width: upper oval points move horizontally.
  if (params.foreheadWidth !== 0) {
    for (const i of regions.faceOval) {
      const p = points[i];
      const upper = smooth((center.y - p.y) / (fh * 0.5));
      add(map, i, params.foreheadWidth * (p.x - center.x) * 0.16 * upper, 0);
    }
  }

  // Nose bridge (narrow/widen upper nose) & tip (vertical + narrow lowest).
  if (params.noseBridge !== 0 || params.noseTip !== 0) {
    const nose = bbox(points, regions.nose);
    const cx = (nose.minX + nose.maxX) / 2;
    for (const i of regions.nose) {
      const p = points[i];
      const upper = 1 - smooth((p.y - nose.minY) / nose.h);
      const lower = smooth((p.y - nose.minY) / nose.h);
      add(map, i, -params.noseBridge * (p.x - cx) * 0.5 * upper, 0);
      add(map, i, -params.noseTip * (p.x - cx) * 0.5 * lower, params.noseTip * nose.h * 0.12 * lower);
    }
  }

  // Lips: fullness expands from lip center vertically; shape lifts the corners.
  if (params.lipFullness !== 0 || params.lipShape !== 0) {
    const lips = bbox(points, regions.lips);
    const lc = centroid(points, regions.lips);
    for (const i of regions.lips) {
      const p = points[i];
      add(map, i, 0, params.lipFullness * (p.y - lc.y) * 0.5);
      const cornerness = smooth(Math.abs(p.x - lc.x) / (lips.w * 0.5));
      add(map, i, 0, -params.lipShape * lips.h * 0.4 * cornerness);
    }
  }

  // Brows: position = vertical shift; shape = raise outer ends (arch).
  if (params.browPosition !== 0 || params.browShape !== 0) {
    for (const region of [regions.leftBrow, regions.rightBrow]) {
      const bb = bbox(points, region);
      const bc = centroid(points, region);
      for (const i of region) {
        const p = points[i];
        add(map, i, 0, -params.browPosition * fh * 0.06);
        const outer = smooth(Math.abs(p.x - bc.x) / (bb.w * 0.5));
        add(map, i, 0, -params.browShape * bb.h * 0.6 * outer);
      }
    }
  }

  // Eye size: scale each eye's points about its center.
  if (params.eyeSize !== 0) {
    for (const region of [regions.leftEye, regions.rightEye]) {
      const ec = centroid(points, region);
      for (const i of region) {
        const p = points[i];
        add(map, i, (p.x - ec.x) * params.eyeSize * 0.25, (p.y - ec.y) * params.eyeSize * 0.25);
      }
    }
  }

  // Eye spacing: move each eye's points horizontally away from / toward center.
  if (params.eyeSpacing !== 0) {
    for (const region of [regions.leftEye, regions.rightEye]) {
      const ec = centroid(points, region);
      const dir = Math.sign(ec.x - center.x) || 1;
      for (const i of region) {
        add(map, i, dir * params.eyeSpacing * fw * 0.05, 0);
      }
    }
  }

  return map;
}
