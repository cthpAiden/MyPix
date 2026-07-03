/**
 * Warp displacement math (T064). Verifies per-feature confinement (a control
 * only moves its own region's landmarks), anchor-ring zero falloff (border stays
 * pinned), and the barycentric/Delaunay primitives the mesh warp relies on.
 */
import { describe, expect, it } from 'vitest';
import {
  assembleMesh,
  barycentric,
  borderAnchors,
  delaunay,
  inTriangle,
} from '@/shared/warp/mesh';
import { faceReshapeDisplacements, type FaceFrame } from '@/shared/warp/displacement';
import { composeWarpField, MAX_OFFSET } from '@/shared/warp/field';
import { FACE_REGIONS, warpVertexIndices } from '@/vision/regions';
import { defaultFaceReshape } from '@/engine/editState';
import type { Point2D } from '@/engine/editState';

/** A deterministic synthetic 478-point face in normalized [0,1] space. */
function syntheticFrame(): FaceFrame {
  const points: Point2D[] = [];
  for (let i = 0; i < 478; i++) {
    points.push({ x: ((i * 0.6180339887) % 1) * 0.6 + 0.2, y: ((i * 0.3819660112) % 1) * 0.6 + 0.2 });
  }
  return { points, regions: FACE_REGIONS };
}

describe('faceReshapeDisplacements — per-feature confinement', () => {
  it('jaw only moves face-oval landmarks, leaving eyes untouched', () => {
    const frame = syntheticFrame();
    const map = faceReshapeDisplacements(frame, { ...defaultFaceReshape(0), jaw: 1 });
    const oval = new Set(FACE_REGIONS.faceOval);
    for (const key of map.keys()) expect(oval.has(key)).toBe(true);
    for (const i of FACE_REGIONS.leftEye) expect(map.has(i)).toBe(false);
    for (const i of FACE_REGIONS.rightEye) expect(map.has(i)).toBe(false);
  });

  it('eyeSize only moves eye landmarks, leaving the jaw untouched', () => {
    const frame = syntheticFrame();
    const map = faceReshapeDisplacements(frame, { ...defaultFaceReshape(0), eyeSize: 1 });
    const eyes = new Set([...FACE_REGIONS.leftEye, ...FACE_REGIONS.rightEye]);
    for (const key of map.keys()) expect(eyes.has(key)).toBe(true);
    // A face-oval-only landmark must be unaffected.
    const ovalOnly = FACE_REGIONS.faceOval.find((i) => !eyes.has(i))!;
    expect(map.has(ovalOnly)).toBe(false);
  });

  it('zero params produce no displacement', () => {
    const frame = syntheticFrame();
    const map = faceReshapeDisplacements(frame, defaultFaceReshape(0));
    for (const d of map.values()) {
      expect(d.x).toBe(0);
      expect(d.y).toBe(0);
    }
  });
});

describe('barycentric interpolation', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 1, y: 0 };
  const c = { x: 0, y: 1 };

  it('weights sum to 1 and are non-negative inside the triangle', () => {
    const w = barycentric({ x: 0.25, y: 0.25 }, a, b, c);
    expect(w[0] + w[1] + w[2]).toBeCloseTo(1, 6);
    expect(inTriangle(w)).toBe(true);
  });

  it('detects points outside the triangle', () => {
    const w = barycentric({ x: 2, y: 2 }, a, b, c);
    expect(inTriangle(w)).toBe(false);
  });
});

describe('Delaunay + mesh assembly', () => {
  it('triangulates the border anchor ring with valid indices', () => {
    const anchors = borderAnchors();
    const tris = delaunay(anchors);
    expect(tris.length).toBeGreaterThan(0);
    for (const t of tris) {
      for (const idx of [t.a, t.b, t.c]) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(anchors.length);
      }
    }
  });

  it('assembleMesh keeps movable points first and adds anchors', () => {
    const mesh = assembleMesh([{ x: 0.5, y: 0.5 }]);
    expect(mesh.movableCount).toBe(1);
    expect(mesh.points.length).toBeGreaterThan(1);
    expect(mesh.triangles.length).toBeGreaterThan(0);
  });
});

describe('composeWarpField — anchor-ring zero falloff', () => {
  it('pins the border to zero displacement while moving the interior', () => {
    const mesh = assembleMesh([{ x: 0.5, y: 0.5 }]);
    const disp = mesh.points.map((_, i) => (i === 0 ? { x: 0.1, y: 0 } : { x: 0, y: 0 }));
    const res = 32;
    const field = composeWarpField([{ points: mesh.points, disp, triangles: mesh.triangles }], null, res)!;
    expect(field).not.toBeNull();

    // Corner texel (0,0) → border anchor → ~zero (encoded ≈ 128).
    expect(field[0]).toBeGreaterThanOrEqual(126);
    expect(field[0]).toBeLessThanOrEqual(129);

    // Center texel → displaced toward +x → encoded well above the zero midpoint.
    const center = (16 * res + 16) * 4;
    expect(field[center]).toBeGreaterThan(140);
  });

  it('returns null when there is nothing to warp', () => {
    expect(composeWarpField([], null, 16)).toBeNull();
  });
});

describe('warpVertexIndices', () => {
  it('is a sorted, de-duplicated subset within the 478-point mesh', () => {
    const idx = warpVertexIndices();
    expect(new Set(idx).size).toBe(idx.length);
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
    expect(Math.max(...idx)).toBeLessThan(478);
    expect(MAX_OFFSET).toBeGreaterThan(0);
  });
});
