/**
 * Derive normalized [0,1] region polygons from a detected face (used by the
 * skin, targeted-enhance, and mask builders). Landmarks are image-space pixels;
 * these helpers rescale to normalized space and slice the contour sub-rings.
 */
import type { Point2D } from '@/engine/editState';
import type { FaceLandmarks } from './types';

function ring(face: FaceLandmarks, indices: number[], w: number, h: number): Point2D[] {
  return indices.map((i) => ({ x: face.points[i].x / w, y: face.points[i].y / h }));
}

export interface FacePolygons {
  /** Outer face contour. */
  faceOval: Point2D[];
  /** Eye rings [left, right]. */
  eyes: Point2D[][];
  /** Brow rings [left, right]. */
  brows: Point2D[][];
  /** Outer lip contour. */
  lipsOuter: Point2D[];
  /** Inner mouth ring (teeth-whitening target). */
  teeth: Point2D[];
  /** Under-eye pockets [left, right]. */
  underEye: Point2D[][];
}

export function facePolygons(face: FaceLandmarks, w: number, h: number): FacePolygons {
  const r = face.regions;
  return {
    faceOval: ring(face, r.faceOval, w, h),
    eyes: [ring(face, r.leftEye, w, h), ring(face, r.rightEye, w, h)],
    brows: [ring(face, r.leftBrow, w, h), ring(face, r.rightBrow, w, h)],
    lipsOuter: ring(face, r.lips.slice(0, 20), w, h),
    teeth: ring(face, r.teethInner, w, h),
    underEye: [ring(face, r.underEyeLeft, w, h), ring(face, r.underEyeRight, w, h)],
  };
}
