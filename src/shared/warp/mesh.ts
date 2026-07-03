/**
 * Landmark-driven mesh-warp geometry (research R5, T062).
 *
 * A triangulated mesh is built over the photo from facial control points plus a
 * ring of border/anchor points (Delaunay). Each reshape control produces a
 * per-vertex displacement; anchors stay at zero so warping falls off smoothly
 * and the background is pinned. The per-vertex displacement is rasterized into a
 * low-resolution field via barycentric interpolation across each triangle — the
 * GPU then samples that field, so the "barycentric coordinate interpolation"
 * requirement is met by construction. Manual liquify (T073) accumulates into the
 * same field. All positions here are normalized [0,1] image space.
 */
import type { Point2D } from '@/engine/editState';

export interface Triangle {
  a: number;
  b: number;
  c: number;
}

const EPS = 1e-9;

/** Signed area × 2 of (a,b,c); >0 when counter-clockwise. */
function orient(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** True when p lies strictly inside the circumcircle of triangle (a,b,c). */
function inCircumcircle(a: Point2D, b: Point2D, c: Point2D, p: Point2D): boolean {
  // Ensure CCW so the determinant sign is meaningful.
  if (orient(a, b, c) < 0) {
    const t = b;
    b = c;
    c = t;
  }
  const ax = a.x - p.x;
  const ay = a.y - p.y;
  const bx = b.x - p.x;
  const by = b.y - p.y;
  const cx = c.x - p.x;
  const cy = c.y - p.y;
  const det =
    (ax * ax + ay * ay) * (bx * cy - cx * by) -
    (bx * bx + by * by) * (ax * cy - cx * ay) +
    (cx * cx + cy * cy) * (ax * by - bx * ay);
  return det > EPS;
}

/**
 * Bowyer–Watson Delaunay triangulation. Returns index triples into `pts`.
 * Robust for the small point counts (≤ ~200) used by the warp mesh.
 */
export function delaunay(pts: Point2D[]): Triangle[] {
  const n = pts.length;
  if (n < 3) return [];

  // Super-triangle enclosing all points.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  const dmax = Math.max(dx, dy) * 20;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const ext: Point2D[] = pts.slice();
  const s0 = n;
  const s1 = n + 1;
  const s2 = n + 2;
  ext.push({ x: midX - dmax, y: midY - dmax });
  ext.push({ x: midX, y: midY + dmax });
  ext.push({ x: midX + dmax, y: midY - dmax });

  let tris: Triangle[] = [{ a: s0, b: s1, c: s2 }];

  for (let i = 0; i < n; i++) {
    const p = ext[i];
    const bad: Triangle[] = [];
    const good: Triangle[] = [];
    for (const t of tris) {
      if (inCircumcircle(ext[t.a], ext[t.b], ext[t.c], p)) bad.push(t);
      else good.push(t);
    }

    // Boundary of the bad-triangle cavity = edges that appear exactly once.
    const edgeCount = new Map<string, { u: number; v: number; n: number }>();
    const addEdge = (u: number, v: number) => {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      const e = edgeCount.get(key);
      if (e) e.n++;
      else edgeCount.set(key, { u, v, n: 1 });
    };
    for (const t of bad) {
      addEdge(t.a, t.b);
      addEdge(t.b, t.c);
      addEdge(t.c, t.a);
    }

    tris = good;
    for (const e of edgeCount.values()) {
      if (e.n === 1) tris.push({ a: e.u, b: e.v, c: i });
    }
  }

  // Drop triangles touching the super-triangle vertices.
  return tris.filter((t) => t.a < n && t.b < n && t.c < n);
}

/** Barycentric weights of p w.r.t triangle (a,b,c). Sum to 1. */
export function barycentric(
  p: Point2D,
  a: Point2D,
  b: Point2D,
  c: Point2D,
): [number, number, number] {
  const v0x = b.x - a.x;
  const v0y = b.y - a.y;
  const v1x = c.x - a.x;
  const v1y = c.y - a.y;
  const v2x = p.x - a.x;
  const v2y = p.y - a.y;
  const den = v0x * v1y - v1x * v0y;
  if (Math.abs(den) < EPS) return [1, 0, 0];
  const v = (v2x * v1y - v1x * v2y) / den;
  const w = (v0x * v2y - v2x * v0y) / den;
  const u = 1 - v - w;
  return [u, v, w];
}

/** True when all barycentric weights are non-negative (p inside the triangle). */
export function inTriangle(w: [number, number, number]): boolean {
  return w[0] >= -1e-6 && w[1] >= -1e-6 && w[2] >= -1e-6;
}

/** A ring of anchor points (corners + edge samples) pinning the image border. */
export function borderAnchors(): Point2D[] {
  const anchors: Point2D[] = [];
  const steps = 4; // per edge, inclusive of corners via de-dup below
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    anchors.push({ x: t, y: 0 });
    anchors.push({ x: t, y: 1 });
    anchors.push({ x: 0, y: t });
    anchors.push({ x: 1, y: t });
  }
  // De-dup coincident points (corners) to avoid degenerate triangles.
  const seen = new Set<string>();
  return anchors.filter((p) => {
    const k = `${p.x.toFixed(4)}_${p.y.toFixed(4)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface WarpMesh {
  /** Vertex positions, normalized [0,1]. Face verts first, then anchors. */
  points: Point2D[];
  triangles: Triangle[];
  /** Source landmark index per face vertex; -1 for anchors (displacement 0). */
  landmarkIndex: number[];
  faceVertexCount: number;
}

/**
 * Assemble the warp mesh for one face: the given normalized landmark subset as
 * movable vertices plus a border anchor ring, Delaunay-triangulated. Topology
 * depends only on positions (fixed per detection), so it is built once and only
 * the per-vertex displacements change while scrubbing.
 */
export function assembleWarpMesh(
  facePoints: Point2D[],
  faceLandmarkIndices: number[],
): WarpMesh {
  const anchors = borderAnchors();
  const points: Point2D[] = [...facePoints, ...anchors];
  const landmarkIndex: number[] = [
    ...faceLandmarkIndices,
    ...anchors.map(() => -1),
  ];
  const triangles = delaunay(points);
  return { points, triangles, landmarkIndex, faceVertexCount: facePoints.length };
}

/**
 * Assemble a generic warp mesh from arbitrary movable points (body reshape) plus
 * the border anchor ring. The first `movableCount` vertices are the movable
 * points; the rest are anchors (displacement 0).
 */
export function assembleMesh(movablePoints: Point2D[]): {
  points: Point2D[];
  triangles: Triangle[];
  movableCount: number;
} {
  const anchors = borderAnchors();
  const points: Point2D[] = [...movablePoints, ...anchors];
  return { points, triangles: delaunay(points), movableCount: movablePoints.length };
}

/**
 * Rasterize a displacement field into an RGBA8 buffer (res×res). R,G encode the
 * forward displacement (dx,dy) in normalized units, scaled by `maxOffset`:
 * `byte = (clamp(d,-max,max)/max * 0.5 + 0.5) * 255`. B carries a freeze mask
 * (255 = protected → shader zeroes displacement). Texels outside every triangle
 * decode to zero displacement (the anchor ring guarantees hull coverage).
 */
export function rasterizeDisplacementField(
  points: Point2D[],
  disp: Point2D[],
  triangles: Triangle[],
  res: number,
  maxOffset: number,
  freeze?: (nx: number, ny: number) => boolean,
): Uint8Array {
  const buf = new Uint8Array(res * res * 4);
  const encode = (v: number): number => {
    const c = Math.max(-maxOffset, Math.min(maxOffset, v));
    return Math.round((c / maxOffset) * 0.5 * 255 + 127.5);
  };

  for (let y = 0; y < res; y++) {
    const ny = (y + 0.5) / res;
    for (let x = 0; x < res; x++) {
      const nx = (x + 0.5) / res;
      const idx = (y * res + x) * 4;
      let dx = 0;
      let dy = 0;
      const p = { x: nx, y: ny };
      for (const t of triangles) {
        const w = barycentric(p, points[t.a], points[t.b], points[t.c]);
        if (!inTriangle(w)) continue;
        dx = w[0] * disp[t.a].x + w[1] * disp[t.b].x + w[2] * disp[t.c].x;
        dy = w[0] * disp[t.a].y + w[1] * disp[t.b].y + w[2] * disp[t.c].y;
        break;
      }
      buf[idx] = encode(dx);
      buf[idx + 1] = encode(dy);
      buf[idx + 2] = freeze && freeze(nx, ny) ? 255 : 0;
      buf[idx + 3] = 255;
    }
  }
  return buf;
}
