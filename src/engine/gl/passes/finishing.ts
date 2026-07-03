/**
 * Creative finishing pass (US1.5, T047): vignette, grain, clarity/texture,
 * dehaze, fade/matte, bloom — all combinable, exported faithfully.
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import type { FinishingParams } from '@/engine/editState';

export const FINISHING_FRAGMENT = buildFragment(`
uniform float u_vignette;  // -1..1
uniform float u_grain;     // 0..1
uniform float u_clarity;   // -1..1
uniform float u_dehaze;    // -1..1
uniform float u_fade;      // 0..1
uniform float u_bloom;     // 0..1

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 c = texture(u_src, v_uv).rgb;

  // Clarity: local-contrast unsharp against a 2px box blur.
  if (abs(u_clarity) > 0.001) {
    vec2 t = u_texel * 2.0;
    vec3 blur =
      texture(u_src, v_uv + vec2(t.x, 0.0)).rgb +
      texture(u_src, v_uv - vec2(t.x, 0.0)).rgb +
      texture(u_src, v_uv + vec2(0.0, t.y)).rgb +
      texture(u_src, v_uv - vec2(0.0, t.y)).rgb;
    blur *= 0.25;
    c += (c - blur) * u_clarity * 0.8;
  }

  // Dehaze: contrast + a touch of saturation.
  if (abs(u_dehaze) > 0.001) {
    c = (c - 0.5) * (1.0 + u_dehaze * 0.4) + 0.5;
    float g = luma(c);
    c = mix(vec3(g), c, 1.0 + u_dehaze * 0.25);
  }

  // Bloom: bleed bright highlights (cheap 4-tap bright-pass).
  if (u_bloom > 0.001) {
    vec2 t = u_texel * 3.0;
    vec3 bloom = vec3(0.0);
    bloom += max(texture(u_src, v_uv + vec2(t.x, t.y)).rgb - 0.7, 0.0);
    bloom += max(texture(u_src, v_uv - vec2(t.x, t.y)).rgb - 0.7, 0.0);
    bloom += max(texture(u_src, v_uv + vec2(t.x, -t.y)).rgb - 0.7, 0.0);
    bloom += max(texture(u_src, v_uv - vec2(t.x, -t.y)).rgb - 0.7, 0.0);
    c += bloom * 0.25 * u_bloom;
  }

  // Fade / matte: lift blacks, soften contrast.
  if (u_fade > 0.001) {
    c = mix(c, c * 0.82 + 0.14, u_fade);
  }

  // Grain.
  if (u_grain > 0.001) {
    float n = hash(gl_FragCoord.xy) * 2.0 - 1.0;
    c += n * u_grain * 0.08;
  }

  // Vignette.
  if (abs(u_vignette) > 0.001) {
    vec2 p = v_uv - 0.5;
    float r = length(p) * 1.414;
    float mask = smoothstep(0.35, 0.9, r);
    c *= 1.0 - u_vignette * mask * 0.8;
  }

  fragColor = vec4(clampColor(c), 1.0);
}`);

export function buildFinishingPass(params: FinishingParams): RenderPass {
  return {
    name: 'finishing',
    fragment: FINISHING_FRAGMENT,
    uniforms: () => ({
      u_vignette: { t: '1f', v: params.vignette / 100 },
      u_grain: { t: '1f', v: params.grain / 100 },
      u_clarity: { t: '1f', v: params.clarity / 100 },
      u_dehaze: { t: '1f', v: params.dehaze / 100 },
      u_fade: { t: '1f', v: params.fade / 100 },
      u_bloom: { t: '1f', v: params.bloom / 100 },
    }),
  };
}
