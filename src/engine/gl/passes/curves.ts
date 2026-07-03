/**
 * Tone curves pass (US1.4, T043). Per-channel control points evaluated as a
 * piecewise-linear curve in the shader (points passed as uniform arrays — no
 * LUT texture needed since curves cap at 16 points). Master 'rgb' curve is
 * applied first, then per-channel r/g/b.
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import type { CurvesParams, CurveChannel, Point2D } from '@/engine/editState';

const MAX_PTS = 16;
const STRIDE = MAX_PTS * 2;

export const CURVES_FRAGMENT = buildFragment(`
uniform float u_rgb[${STRIDE}]; uniform int u_nRgb;
uniform float u_r[${STRIDE}];   uniform int u_nR;
uniform float u_g[${STRIDE}];   uniform int u_nG;
uniform float u_b[${STRIDE}];   uniform int u_nB;

float evalCurve(float x, float p[${STRIDE}], int n) {
  if (n <= 1) return x;
  if (x <= p[0]) return p[1];
  for (int i = 0; i < ${MAX_PTS - 1}; i++) {
    if (i + 1 >= n) break;
    float ax = p[i * 2],       ay = p[i * 2 + 1];
    float bx = p[(i + 1) * 2], by = p[(i + 1) * 2 + 1];
    if (x <= bx) {
      float t = (x - ax) / max(bx - ax, 1e-5);
      return mix(ay, by, clamp(t, 0.0, 1.0));
    }
  }
  return p[(n - 1) * 2 + 1];
}

void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  c = vec3(evalCurve(c.r, u_rgb, u_nRgb), evalCurve(c.g, u_rgb, u_nRgb), evalCurve(c.b, u_rgb, u_nRgb));
  c.r = evalCurve(c.r, u_r, u_nR);
  c.g = evalCurve(c.g, u_g, u_nG);
  c.b = evalCurve(c.b, u_b, u_nB);
  fragColor = vec4(clampColor(c), 1.0);
}`);

function flatten(points: Point2D[]): { arr: Float32Array; n: number } {
  const arr = new Float32Array(STRIDE);
  const n = Math.min(points.length, MAX_PTS);
  for (let i = 0; i < n; i++) {
    arr[i * 2] = points[i].x;
    arr[i * 2 + 1] = points[i].y;
  }
  return { arr, n };
}

export function buildCurvesPass(params: CurvesParams): RenderPass {
  const ch = (c: CurveChannel) => flatten(params.points[c]);
  const rgb = ch('rgb');
  const r = ch('r');
  const g = ch('g');
  const b = ch('b');
  return {
    name: 'curves',
    fragment: CURVES_FRAGMENT,
    uniforms: () => ({
      u_rgb: { t: '1fv', v: rgb.arr },
      u_nRgb: { t: '1i', v: rgb.n },
      u_r: { t: '1fv', v: r.arr },
      u_nR: { t: '1i', v: r.n },
      u_g: { t: '1fv', v: g.arr },
      u_nG: { t: '1i', v: g.n },
      u_b: { t: '1fv', v: b.arr },
      u_nB: { t: '1i', v: b.n },
    }),
  };
}
