/**
 * Geometry stage (US1.3, T040): crop rect + rotate90 + straighten angle +
 * perspective quad, applied as the final sampling into the output surface.
 * Runs after the pixel passes so adjustments compute on the whole frame and the
 * crop only reframes the result. Same math drives preview and tiled export.
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import type { CropParams } from '@/engine/editState';

export const GEOMETRY_FRAGMENT = buildFragment(`
uniform vec4 u_rect;      // crop x,y,w,h in 0..1 (rotated space)
uniform float u_angle;    // straighten radians
uniform int u_rot90;      // 0..3 quarter turns
uniform float u_srcAspect;// source w/h for aspect-correct straighten
uniform int u_hasQuad;
uniform vec2 u_q0, u_q1, u_q2, u_q3; // perspective quad corners (0..1)

vec2 applyRot90(vec2 uv, int k) {
  vec2 p = uv;
  for (int i = 0; i < 3; i++) {
    if (i >= k) break;
    p = vec2(p.y, 1.0 - p.x);
  }
  return p;
}

void main() {
  vec2 uv = v_uv;

  // Perspective quad: bilinear map of output uv across the 4 corners.
  if (u_hasQuad == 1) {
    vec2 top = mix(u_q0, u_q1, uv.x);
    vec2 bot = mix(u_q3, u_q2, uv.x);
    uv = mix(top, bot, uv.y);
  }

  // Window into the crop rect.
  uv = u_rect.xy + uv * u_rect.zw;

  // Straighten: rotate about center, aspect-corrected.
  if (abs(u_angle) > 0.0001) {
    vec2 p = uv - 0.5;
    p.x *= u_srcAspect;
    float s = sin(u_angle), c = cos(u_angle);
    p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    p.x /= u_srcAspect;
    uv = p + 0.5;
  }

  uv = applyRot90(uv, u_rot90);

  fragColor = texture(u_src, clamp(uv, 0.0, 1.0));
}`);

export function isIdentityCrop(c: CropParams): boolean {
  return (
    c.rect.x === 0 &&
    c.rect.y === 0 &&
    c.rect.w === 1 &&
    c.rect.h === 1 &&
    c.angle === 0 &&
    c.rotate90 === 0 &&
    c.quad === null
  );
}

/** Output pixel size for a crop over a source of given dimensions. */
export function croppedOutputSize(
  srcW: number,
  srcH: number,
  c: CropParams,
): { width: number; height: number } {
  const rotated = c.rotate90 % 2 === 1;
  const baseW = rotated ? srcH : srcW;
  const baseH = rotated ? srcW : srcH;
  return {
    width: Math.max(1, Math.round(baseW * c.rect.w)),
    height: Math.max(1, Math.round(baseH * c.rect.h)),
  };
}

export function buildGeometryPass(c: CropParams, srcAspect: number): RenderPass {
  const q = c.quad;
  return {
    name: 'geometry',
    fragment: GEOMETRY_FRAGMENT,
    uniforms: () => ({
      u_rect: { t: '4f', v: [c.rect.x, c.rect.y, c.rect.w, c.rect.h] },
      u_angle: { t: '1f', v: (c.angle * Math.PI) / 180 },
      u_rot90: { t: '1i', v: c.rotate90 },
      u_srcAspect: { t: '1f', v: srcAspect },
      u_hasQuad: { t: '1i', v: q ? 1 : 0 },
      u_q0: { t: '2f', v: q ? [q[0].x, q[0].y] : [0, 0] },
      u_q1: { t: '2f', v: q ? [q[1].x, q[1].y] : [1, 0] },
      u_q2: { t: '2f', v: q ? [q[2].x, q[2].y] : [1, 1] },
      u_q3: { t: '2f', v: q ? [q[3].x, q[3].y] : [0, 1] },
    }),
  };
}
