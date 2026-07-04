/**
 * Background effect pass (US2.7/US2.8, T076/T077, research R16).
 *
 * Segmentation-mask-confined background treatment: portrait blur, grayscale,
 * solid-color replace, or transparent cut-out. The person-vs-background
 * confidence mask (upscaled with LINEAR sampling for a feathered edge) gates a
 * subject-vs-background mix; `edgeRefine` tightens the transition. Transparent
 * mode writes alpha = subject so the PNG export path (T078) preserves it — the
 * geometry pass already passes alpha through untouched.
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import type { BackgroundEffectParams } from '@/engine/editState';
import type { SegmentationResult } from '@/vision/types';

const MODE_INDEX: Record<BackgroundEffectParams['mode'], number> = {
  blur: 0,
  grayscale: 1,
  replace: 2,
  transparent: 3,
};

const BLUR_FRAGMENT = buildFragment(`
uniform vec2 u_dir;
void main() {
  vec3 sum = texture(u_src, v_uv).rgb * 0.227027;
  sum += texture(u_src, v_uv + u_dir * 1.0).rgb * 0.194595;
  sum += texture(u_src, v_uv - u_dir * 1.0).rgb * 0.194595;
  sum += texture(u_src, v_uv + u_dir * 2.0).rgb * 0.121622;
  sum += texture(u_src, v_uv - u_dir * 2.0).rgb * 0.121622;
  sum += texture(u_src, v_uv + u_dir * 3.0).rgb * 0.054054;
  sum += texture(u_src, v_uv - u_dir * 3.0).rgb * 0.054054;
  fragColor = vec4(sum, 1.0);
}`);

const COMPOSITE_FRAGMENT = buildFragment(`
uniform sampler2D u_orig, u_blur, u_mask;
uniform int u_mode;      // 0 blur, 1 grayscale, 2 replace, 3 transparent
uniform vec3 u_color;
uniform float u_edge;    // 0…1 edge sharpness

void main() {
  vec3 orig = texture(u_orig, v_uv).rgb;
  float raw = texture(u_mask, v_uv).r;
  float e = mix(0.18, 0.02, u_edge);
  float m = smoothstep(0.5 - e, 0.5 + e, raw);  // 1 = subject

  vec3 bg;
  float a = 1.0;
  if (u_mode == 1) bg = vec3(luma(orig));
  else if (u_mode == 2) bg = u_color;
  else if (u_mode == 3) { bg = orig; a = m; }
  else bg = texture(u_blur, v_uv).rgb;

  vec3 outc = mix(bg, orig, m);
  fragColor = vec4(clampColor(outc), a);
}`);

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(n || '000000', 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

/** Pack the seg confidence mask (Float32, top-down) into an RGBA8 data texture. */
function packMask(seg: SegmentationResult): Uint8Array {
  const buf = new Uint8Array(seg.width * seg.height * 4);
  for (let i = 0; i < seg.confidenceMask.length; i++) {
    const v = Math.round(Math.max(0, Math.min(1, seg.confidenceMask[i])) * 255);
    buf[i * 4] = v;
    buf[i * 4 + 1] = v;
    buf[i * 4 + 2] = v;
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

/** The packed mask depends only on the segmentation result, so cache per result. */
const maskCache = new WeakMap<SegmentationResult, Uint8Array>();

export function buildBackgroundPass(seg: SegmentationResult, params: BackgroundEffectParams): RenderPass {
  let mask = maskCache.get(seg);
  if (!mask) {
    mask = packMask(seg);
    maskCache.set(seg, mask);
  }
  const color = hexToRgb(params.color);
  const mode = MODE_INDEX[params.mode];
  const iterations = params.mode === 'blur' ? 1 + Math.round(params.blurStrength * 3) : 0;
  const spread = 1 + params.blurStrength * 6;

  return {
    name: 'backgroundEffect',
    fragment: COMPOSITE_FRAGMENT,
    uniforms: () => ({}),
    execute: (gl, src, dst, texel) => {
      const w = dst.width;
      const h = dst.height;
      const maskTex = gl.createDataTexture(mask, seg.width, seg.height);

      // Two FIXED scratch targets. Each iteration reads the previous result
      // (blurTex) into `a` (H pass), then `a` into `b` (V pass), and treats
      // b.tex as the next input. Do NOT swap a/b: swapping made the next H pass
      // both sample and render `b`, aliasing a texture with the bound color
      // attachment (undefined behaviour → garbage blur). `blurTex` is only ever
      // src or b.tex, never a.tex, so no draw reads its own render target.
      let blurTex = src;
      const a = gl.createTarget(w, h);
      const b = gl.createTarget(w, h);
      const hx: [number, number] = [texel[0] * spread, 0];
      const vy: [number, number] = [0, texel[1] * spread];
      for (let i = 0; i < iterations; i++) {
        gl.draw(BLUR_FRAGMENT, { u_src: { t: 'tex', v: blurTex, unit: 0 }, u_dir: { t: '2f', v: hx } }, a);
        gl.draw(BLUR_FRAGMENT, { u_src: { t: 'tex', v: a.tex, unit: 0 }, u_dir: { t: '2f', v: vy } }, b);
        blurTex = b.tex;
      }

      gl.draw(
        COMPOSITE_FRAGMENT,
        {
          u_orig: { t: 'tex', v: src, unit: 0 },
          u_blur: { t: 'tex', v: blurTex, unit: 1 },
          u_mask: { t: 'tex', v: maskTex, unit: 2 },
          u_mode: { t: '1i', v: mode },
          u_color: { t: '3f', v: color },
          u_edge: { t: '1f', v: params.edgeRefine },
        },
        dst,
      );

      gl.deleteTarget(a);
      gl.deleteTarget(b);
      gl.deleteTexture(maskTex);
      return dst.tex;
    },
  };
}
