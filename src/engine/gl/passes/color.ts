/**
 * Color mixer (8-band HSL) and color grading / split-tone passes (US1.4, T044).
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import type { ColorGradeParams, ColorMixerParams, MixerBand } from '@/engine/editState';

const BANDS: MixerBand[] = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];

/* ------------------------------- mixer -------------------------------- */

export const MIXER_FRAGMENT = buildFragment(`
uniform float u_h[8];
uniform float u_s[8];
uniform float u_l[8];
const float centers[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 270.0, 300.0);

float bandWeight(float hueDeg, float center) {
  float d = abs(hueDeg - center);
  d = min(d, 360.0 - d);       // wrap-around distance
  return max(0.0, 1.0 - d / 45.0);
}

void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  vec3 hsl = rgb2hsl(clampColor(c));
  float hueDeg = hsl.x * 360.0;
  float dh = 0.0, ds = 0.0, dl = 0.0;
  for (int i = 0; i < 8; i++) {
    float w = bandWeight(hueDeg, centers[i]);
    dh += u_h[i] * w;
    ds += u_s[i] * w;
    dl += u_l[i] * w;
  }
  hsl.x = fract(hsl.x + dh / 360.0 * 30.0 / 100.0);
  hsl.y = clamp(hsl.y + ds / 100.0 * 0.5, 0.0, 1.0);
  hsl.z = clamp(hsl.z + dl / 100.0 * 0.5, 0.0, 1.0);
  fragColor = vec4(clampColor(hsl2rgb(hsl)), 1.0);
}`);

export function buildColorMixerPass(params: ColorMixerParams): RenderPass {
  const h = new Float32Array(8);
  const s = new Float32Array(8);
  const l = new Float32Array(8);
  BANDS.forEach((b, i) => {
    h[i] = params.bands[b].hue;
    s[i] = params.bands[b].sat;
    l[i] = params.bands[b].lum;
  });
  return {
    name: 'colorMixer',
    fragment: MIXER_FRAGMENT,
    uniforms: () => ({
      u_h: { t: '1fv', v: h },
      u_s: { t: '1fv', v: s },
      u_l: { t: '1fv', v: l },
    }),
  };
}

/* ----------------------------- color grade ---------------------------- */

export const GRADE_FRAGMENT = buildFragment(`
uniform vec3 u_shadow;
uniform vec3 u_mid;
uniform vec3 u_high;
uniform float u_balance;   // -1..1
uniform float u_blend;     // 0..1

void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  float l = luma(c);
  float pivot = 0.5 + u_balance * 0.3;
  float wS = 1.0 - smoothstep(0.0, pivot, l);
  float wH = smoothstep(pivot, 1.0, l);
  float wM = clamp(1.0 - wS - wH, 0.0, 1.0) * u_blend;
  c += u_shadow * wS + u_mid * wM + u_high * wH;
  fragColor = vec4(clampColor(c), 1.0);
}`);

/** hue(0..360)+sat(0..100) tone wheel → an additive rgb tint vector. */
function wheelTint(hue: number, sat: number): [number, number, number] {
  const h = (((hue % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  let r = 0,
    g = 0,
    b = 0;
  if (h < 1) [r, g, b] = [1, x, 0];
  else if (h < 2) [r, g, b] = [x, 1, 0];
  else if (h < 3) [r, g, b] = [0, 1, x];
  else if (h < 4) [r, g, b] = [0, x, 1];
  else if (h < 5) [r, g, b] = [x, 0, 1];
  else [r, g, b] = [1, 0, x];
  const k = (sat / 100) * 0.2;
  // center around 0 so a tint pushes toward its hue, away from complement
  return [(r - 0.33) * k, (g - 0.33) * k, (b - 0.33) * k];
}

export function buildColorGradePass(params: ColorGradeParams): RenderPass {
  const shadow = wheelTint(params.shadows.hue, params.shadows.sat);
  const mid = wheelTint(params.midtones.hue, params.midtones.sat);
  const high = wheelTint(params.highlights.hue, params.highlights.sat);
  return {
    name: 'colorGrade',
    fragment: GRADE_FRAGMENT,
    uniforms: () => ({
      u_shadow: { t: '3f', v: shadow },
      u_mid: { t: '3f', v: mid },
      u_high: { t: '3f', v: high },
      u_balance: { t: '1f', v: params.balance / 100 },
      u_blend: { t: '1f', v: params.blending / 100 },
    }),
  };
}
