/**
 * Global light/color adjustment pass — 12 params (US1.2, T038).
 *
 * The same fragment is reused by the filter pass (a filter is just this pass
 * with preset params × intensity), so filters and manual adjustments are
 * pixel-identical in math.
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import type { AdjustParams } from '@/engine/editState';

export const ADJUST_FRAGMENT = buildFragment(`
uniform float u_brightness, u_contrast, u_exposure;
uniform float u_highlights, u_shadows, u_whites, u_blacks;
uniform float u_saturation, u_vibrance;
uniform float u_temperature, u_tint, u_sharpness;

void main() {
  vec3 c = texture(u_src, v_uv).rgb;

  // Exposure (stops-ish) then brightness (linear lift).
  c *= pow(2.0, u_exposure / 100.0);
  c += u_brightness / 100.0 * 0.25;

  // White balance: temperature warms r / cools b; tint shifts green<->magenta.
  float temp = u_temperature / 100.0;
  float tint = u_tint / 100.0;
  c.r += temp * 0.10;
  c.b -= temp * 0.10;
  c.g += tint * 0.10;

  // Blacks / whites move the end points; shadows / highlights bend the curve.
  c += u_blacks / 100.0 * 0.15 * (1.0 - smoothstep(0.0, 0.5, luma(c)));
  c += u_whites / 100.0 * 0.15 * smoothstep(0.5, 1.0, luma(c));
  float l = luma(c);
  c += u_shadows / 100.0 * 0.30 * (1.0 - smoothstep(0.0, 0.6, l));
  c -= u_highlights / 100.0 * 0.30 * smoothstep(0.4, 1.0, l);

  // Contrast around mid-grey.
  c = (c - 0.5) * (1.0 + u_contrast / 100.0) + 0.5;

  // Saturation and vibrance (vibrance protects already-saturated pixels).
  float g = luma(c);
  c = mix(vec3(g), c, 1.0 + u_saturation / 100.0);
  vec3 hsl = rgb2hsl(clampColor(c));
  float vibAmount = u_vibrance / 100.0 * (1.0 - hsl.y);
  c = mix(vec3(luma(c)), c, 1.0 + vibAmount);

  // Sharpness: unsharp mask against a 4-neighbour box blur.
  if (abs(u_sharpness) > 0.001) {
    vec3 blur =
      texture(u_src, v_uv + vec2(u_texel.x, 0.0)).rgb +
      texture(u_src, v_uv - vec2(u_texel.x, 0.0)).rgb +
      texture(u_src, v_uv + vec2(0.0, u_texel.y)).rgb +
      texture(u_src, v_uv - vec2(0.0, u_texel.y)).rgb;
    blur *= 0.25;
    c += (c - blur) * (u_sharpness / 100.0) * 1.5;
  }

  fragColor = vec4(clampColor(c), 1.0);
}`);

/** Uniform set for the adjust fragment (also used by the filter pass). */
export function adjustUniforms(p: AdjustParams) {
  return {
    u_brightness: { t: '1f' as const, v: p.brightness },
    u_contrast: { t: '1f' as const, v: p.contrast },
    u_exposure: { t: '1f' as const, v: p.exposure },
    u_highlights: { t: '1f' as const, v: p.highlights },
    u_shadows: { t: '1f' as const, v: p.shadows },
    u_whites: { t: '1f' as const, v: p.whites },
    u_blacks: { t: '1f' as const, v: p.blacks },
    u_saturation: { t: '1f' as const, v: p.saturation },
    u_vibrance: { t: '1f' as const, v: p.vibrance },
    u_temperature: { t: '1f' as const, v: p.temperature },
    u_tint: { t: '1f' as const, v: p.tint },
    u_sharpness: { t: '1f' as const, v: p.sharpness },
  };
}

export function buildAdjustPass(params: AdjustParams): RenderPass {
  return {
    name: 'adjust',
    fragment: ADJUST_FRAGMENT,
    uniforms: () => adjustUniforms(params),
  };
}
