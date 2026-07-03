/**
 * Mesh-warp GL pass (US2.1/US2.6, T062/T073, research R5).
 *
 * The heavy geometry (Delaunay mesh + per-vertex displacement + barycentric
 * rasterization + liquify accumulation) is done on the CPU into a low-res
 * displacement field (shared/warp), uploaded as a data texture. This fragment
 * just samples that field and inverse-samples the source — smooth falloff and
 * background pinning come from the anchor ring baked into the field. The field
 * is memoized so scrubbing an unrelated tool never rebuilds it.
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import { assembleWarpMesh } from '@/shared/warp/mesh';
import { faceReshapeDisplacements } from '@/shared/warp/displacement';
import { composeWarpField, FIELD_RES, MAX_OFFSET, type FaceWarp } from '@/shared/warp/field';
import { bodyReshapeWarp } from '@/shared/warp/bodyDisplacement';
import { warpVertexIndices } from '@/vision/regions';
import type {
  AnyOperation,
  BodyReshapeParams,
  EditState,
  FaceReshapeParams,
  LiquifyParams,
  Point2D,
} from '@/engine/editState';
import type { RenderContext } from '@/engine/render/renderContext';
import type { FaceLandmarks } from '@/vision/types';

export const WARP_FRAGMENT = buildFragment(`
uniform sampler2D u_field;
uniform float u_maxOffset;

void main() {
  vec4 fd = texture(u_field, v_uv);
  float frozen = step(0.5, fd.b);
  vec2 disp = (fd.rg * 2.0 - 1.0) * u_maxOffset * (1.0 - frozen);
  vec2 uv = clamp(v_uv - disp, 0.0, 1.0);
  fragColor = texture(u_src, uv);
}`);

/** Build a FaceWarp (normalized mesh + per-vertex displacement) for one face. */
function faceWarpFor(face: FaceLandmarks, params: FaceReshapeParams, w: number, h: number): FaceWarp {
  const norm: Point2D[] = face.points.map((p) => ({ x: p.x / w, y: p.y / h }));
  const indices = warpVertexIndices();
  const subset = indices.map((i) => norm[i]);
  const mesh = assembleWarpMesh(subset, indices);
  const dispMap = faceReshapeDisplacements({ points: norm, regions: face.regions }, params);
  const disp: Point2D[] = mesh.landmarkIndex.map((li) =>
    li >= 0 ? dispMap.get(li) ?? { x: 0, y: 0 } : { x: 0, y: 0 },
  );
  return { points: mesh.points, disp, triangles: mesh.triangles };
}

function findEnabled(ops: AnyOperation[], type: string): AnyOperation | undefined {
  return ops.find((o) => o.type === type && o.enabled);
}

/* Memoize the composed field so unrelated re-renders don't recompute it. */
let cache: { sig: string; field: Uint8Array } | null = null;

/**
 * Build the warp pass for the current state, or null when nothing warps or the
 * required face isn't detected (landmark-dependent ops render as a no-op then).
 */
export function buildWarpPass(state: EditState, ctx: RenderContext): RenderPass | null {
  const reshapeOp = findEnabled(state.operations, 'faceReshape');
  const bodyOp = findEnabled(state.operations, 'bodyReshape');
  const liquifyOp = findEnabled(state.operations, 'liquify');
  if (!reshapeOp && !bodyOp && !liquifyOp) return null;

  const warps: FaceWarp[] = [];
  const sigParts: string[] = [];
  if (reshapeOp) {
    const params = reshapeOp.params as FaceReshapeParams;
    const set = ctx.landmarks;
    const face = set?.faces[params.faceIndex] ?? set?.faces[set?.selectedFaceIndex ?? 0];
    if (face) {
      warps.push(faceWarpFor(face, params, ctx.imageWidth, ctx.imageHeight));
      sigParts.push(`f${params.faceIndex}:${JSON.stringify(params)}`);
    }
  }
  if (bodyOp) {
    const params = bodyOp.params as BodyReshapeParams;
    const pose = ctx.landmarks?.pose;
    if (pose) {
      const body = bodyReshapeWarp(pose, params, ctx.imageWidth, ctx.imageHeight);
      if (body) {
        warps.push(body);
        sigParts.push(`b:${JSON.stringify(params)}`);
      }
    }
  }

  const liquify = liquifyOp ? (liquifyOp.params as LiquifyParams).strokes : null;
  const liquifySig = liquify ? `l${liquify.length}:${JSON.stringify(liquify[liquify.length - 1] ?? null)}` : '';
  if (warps.length === 0 && (!liquify || liquify.length === 0)) return null;

  const photoSig = ctx.landmarks?.computedFor.fingerprint.sampleHash ?? 'none';
  const sig = `${photoSig}#${sigParts.join('|')}#${liquifySig}#${ctx.imageWidth}x${ctx.imageHeight}`;
  if (!cache || cache.sig !== sig) {
    const field = composeWarpField(warps, liquify, FIELD_RES);
    if (!field) return null;
    cache = { sig, field };
  }

  return {
    name: 'warp',
    fragment: WARP_FRAGMENT,
    uniforms: () => ({ u_maxOffset: { t: '1f', v: MAX_OFFSET } }),
    textures: [{ name: 'u_field', unit: 1, data: cache.field, width: FIELD_RES, height: FIELD_RES }],
  };
}
