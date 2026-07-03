/**
 * Pose-driven body reshape displacement (US2.5, T072, research R5).
 *
 * A coarse mesh is seeded from visible pose landmarks + limb-axis / border
 * anchors and Delaunay-triangulated (assembleMesh). Each control (waist, legs,
 * arms, height) is a pure function producing per-vertex displacement so the
 * subject reshapes while the anchor ring keeps straight background lines intact.
 * Returns a FaceWarp (generic mesh + displacement) the warp field composes, or
 * null when there is no usable pose (manual-warp fallback).
 */
import type { BodyReshapeParams, Point2D } from '@/engine/editState';
import type { PoseLandmarks } from '@/vision/types';
import { assembleMesh } from './mesh';
import type { FaceWarp } from './field';

// MediaPipe Pose landmark indices.
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;
const L_ELBOW = 13;
const R_ELBOW = 14;
const L_WRIST = 15;
const R_WRIST = 16;

const KEY = [
  L_SHOULDER, R_SHOULDER, L_HIP, R_HIP, L_KNEE, R_KNEE,
  L_ANKLE, R_ANKLE, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST,
];

const VIS_THRESHOLD = 0.4;

export function bodyReshapeWarp(
  pose: PoseLandmarks,
  params: BodyReshapeParams,
  w: number,
  h: number,
): FaceWarp | null {
  const pts = pose.points;
  // Normalized positions + index lookup for the movable vertices we keep.
  const kept: number[] = KEY.filter((i) => pts[i] && pts[i].visibility >= VIS_THRESHOLD);
  if (kept.length < 4) return null;

  const norm = (i: number): Point2D => ({ x: pts[i].x / w, y: pts[i].y / h });
  const movable = kept.map(norm);
  const mesh = assembleMesh(movable);

  // Body reference frame.
  const centerX =
    (pts[L_HIP].x + pts[R_HIP].x + pts[L_SHOULDER].x + pts[R_SHOULDER].x) / 4 / w;
  const hipY = (pts[L_HIP].y + pts[R_HIP].y) / 2 / h;
  const shoulderY = (pts[L_SHOULDER].y + pts[R_SHOULDER].y) / 2 / h;
  const torsoH = Math.max(1e-3, hipY - shoulderY);

  const disp: Point2D[] = mesh.points.map(() => ({ x: 0, y: 0 }));
  kept.forEach((idx, v) => {
    const p = movable[v];
    let dx = 0;
    let dy = 0;

    // Waist slim: hips move horizontally toward center.
    if (idx === L_HIP || idx === R_HIP) {
      dx += -params.waistSlim * (p.x - centerX) * 0.35;
    }
    // Leg lengthen: knees + ankles move downward.
    if (idx === L_KNEE || idx === R_KNEE) dy += params.legLengthen * torsoH * 0.25;
    if (idx === L_ANKLE || idx === R_ANKLE) dy += params.legLengthen * torsoH * 0.5;
    // Arm slim: elbows/wrists move toward the vertical body axis.
    if (idx === L_ELBOW || idx === R_ELBOW || idx === L_WRIST || idx === R_WRIST) {
      dx += -params.armSlim * (p.x - centerX) * 0.3;
    }
    // Height illusion: everything below the hips stretches downward.
    if (p.y > hipY) dy += params.heightIllusion * (p.y - hipY) * 0.4;

    disp[v] = { x: dx, y: dy };
  });

  return { points: mesh.points, disp, triangles: mesh.triangles };
}
