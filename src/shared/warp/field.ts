/**
 * Warp displacement-field composition (research R5 steps 3–4).
 *
 * Merges landmark-driven face reshape (barycentric mesh interpolation) and
 * manual liquify (accumulated brush strokes) into a single RGBA8 field the warp
 * GL pass samples. R,G encode forward displacement (dx,dy) in normalized units
 * scaled by `maxOffset`; B carries the liquify freeze mask (255 = protected).
 * Anchors keep the border at zero so the background stays pinned.
 */
import type { LiquifyStroke, Point2D } from '@/engine/editState';
import { barycentric, inTriangle, type Triangle } from './mesh';

export const FIELD_RES = 96;
export const MAX_OFFSET = 0.25;

export interface FaceWarp {
  /** Normalized mesh vertex positions (face verts + anchors). */
  points: Point2D[];
  /** Per-vertex displacement, normalized units (anchors are {0,0}). */
  disp: Point2D[];
  triangles: Triangle[];
}

function smooth(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

function encode(v: number): number {
  const c = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, v));
  return Math.round((c / MAX_OFFSET) * 0.5 * 255 + 127.5);
}

/** Distance from point p to segment (a,b). */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Compose the combined warp field. Returns null when there is nothing to warp.
 * `res` field texels sampled at their centers; per texel we barycentric-sample
 * each face mesh, then apply liquify strokes in order (push adds displacement,
 * freeze protects, reconstruct eases the field back toward zero).
 */
export function composeWarpField(
  faces: FaceWarp[],
  liquify: LiquifyStroke[] | null,
  res: number = FIELD_RES,
): Uint8Array | null {
  const hasLiquify = !!liquify && liquify.length > 0;
  if (faces.length === 0 && !hasLiquify) return null;

  const buf = new Uint8Array(res * res * 4);
  for (let y = 0; y < res; y++) {
    const ny = (y + 0.5) / res;
    for (let x = 0; x < res; x++) {
      const nx = (x + 0.5) / res;
      const idx = (y * res + x) * 4;
      let dx = 0;
      let dy = 0;
      let frozen = false;

      // Face reshape: barycentric interpolation across each face mesh.
      for (const f of faces) {
        for (const t of f.triangles) {
          const w = barycentric({ x: nx, y: ny }, f.points[t.a], f.points[t.b], f.points[t.c]);
          if (!inTriangle(w)) continue;
          dx += w[0] * f.disp[t.a].x + w[1] * f.disp[t.b].x + w[2] * f.disp[t.c].x;
          dy += w[0] * f.disp[t.a].y + w[1] * f.disp[t.b].y + w[2] * f.disp[t.c].y;
          break;
        }
      }

      // Liquify strokes, in order.
      if (liquify) {
        for (const s of liquify) {
          const r = s.radius;
          if (r <= 0) continue;
          const path = s.path;
          for (let k = 1; k < path.length; k++) {
            const d = distToSegment(nx, ny, path[k - 1].x, path[k - 1].y, path[k].x, path[k].y);
            if (d > r) continue;
            const f = 1 - smooth(d / r);
            if (s.mode === 'freeze') {
              frozen = true;
            } else if (frozen) {
              continue;
            } else if (s.mode === 'push') {
              const vx = path[k].x - path[k - 1].x;
              const vy = path[k].y - path[k - 1].y;
              dx += vx * s.strength * f;
              dy += vy * s.strength * f;
            } else if (s.mode === 'reconstruct') {
              const keep = 1 - s.strength * f;
              dx *= keep;
              dy *= keep;
            }
          }
        }
      }

      buf[idx] = encode(dx);
      buf[idx + 1] = encode(dy);
      buf[idx + 2] = frozen ? 255 : 0;
      buf[idx + 3] = 255;
    }
  }
  return buf;
}
