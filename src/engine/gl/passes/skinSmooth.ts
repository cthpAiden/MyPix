/**
 * Frequency-separation skin smoothing (US2.2, T067, research R6).
 *
 * Texture-preserving retouch as GPU shader passes:
 *   low  = blur(src)              — tone/color, blemishes
 *   high = src − low              — pores, fine detail (preserved untouched)
 *   low' = blur(low)              — even out the low layer
 *   out  = mix(src, low' + high, strength · skinMask)
 * The skin mask (face-oval minus eyes/brows/lips, feathered) is refined by a
 * YCbCr chroma test in the recombine shader so it stays off hair/clothes. Tone
 * lightness/tint (FR-205) shift within the same mask. Runs via the custom
 * multi-pass executor since it needs several scratch targets at once.
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import { rasterizePolygonMask } from '@/shared/mask';
import { facePolygons } from '@/vision/facePolygons';
import type { SkinSmoothParams } from '@/engine/editState';
import type { FaceLandmarks } from '@/vision/types';

const MASK_RES = 128;

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

const RECOMBINE_FRAGMENT = buildFragment(`
uniform sampler2D u_orig, u_low, u_lowSmooth, u_mask;
uniform float u_strength, u_toneLightness, u_toneTint;

float skinChroma(vec3 c) {
  float cb = -0.169 * c.r - 0.331 * c.g + 0.5 * c.b + 0.5;
  float cr = 0.5 * c.r - 0.419 * c.g - 0.081 * c.b + 0.5;
  float fcb = smoothstep(0.28, 0.34, cb) * (1.0 - smoothstep(0.50, 0.56, cb));
  float fcr = smoothstep(0.50, 0.54, cr) * (1.0 - smoothstep(0.66, 0.72, cr));
  return fcb * fcr;
}

void main() {
  vec3 orig = texture(u_orig, v_uv).rgb;
  vec3 low = texture(u_low, v_uv).rgb;
  vec3 lowS = texture(u_lowSmooth, v_uv).rgb;
  vec3 high = orig - low;
  vec3 result = lowS + high;

  float maskV = texture(u_mask, v_uv).r;
  maskV *= (0.4 + 0.6 * skinChroma(orig));

  vec3 outc = mix(orig, result, clamp(maskV * u_strength, 0.0, 1.0));
  outc += (u_toneLightness * 0.15) * maskV;
  outc.r += u_toneTint * 0.05 * maskV;
  outc.b -= u_toneTint * 0.05 * maskV;
  fragColor = vec4(clampColor(outc), 1.0);
}`);

/** Skin masks depend only on the face geometry, so cache per detected face. */
const maskCache = new WeakMap<FaceLandmarks, Uint8Array>();

export function buildSkinSmoothPass(
  face: FaceLandmarks,
  params: SkinSmoothParams,
  imageW: number,
  imageH: number,
): RenderPass {
  let mask = maskCache.get(face);
  if (!mask) {
    const poly = facePolygons(face, imageW, imageH);
    mask = rasterizePolygonMask(
      MASK_RES,
      poly.faceOval,
      [...poly.eyes, ...poly.brows, poly.lipsOuter],
      4,
    );
    maskCache.set(face, mask);
  }

  return {
    name: 'skinSmooth',
    fragment: RECOMBINE_FRAGMENT,
    uniforms: () => ({}),
    execute: (gl, src, dst, texel) => {
      const w = dst.width;
      const h = dst.height;
      const t1 = gl.createTarget(w, h);
      const t2 = gl.createTarget(w, h);
      const t3 = gl.createTarget(w, h);
      const maskTex = gl.createDataTexture(mask, MASK_RES, MASK_RES);
      const hx: [number, number] = [texel[0] * 2, 0];
      const vy: [number, number] = [0, texel[1] * 2];

      // low = blur(src): H then V.
      gl.draw(BLUR_FRAGMENT, { u_src: { t: 'tex', v: src, unit: 0 }, u_dir: { t: '2f', v: hx } }, t1);
      gl.draw(BLUR_FRAGMENT, { u_src: { t: 'tex', v: t1.tex, unit: 0 }, u_dir: { t: '2f', v: vy } }, t2);
      // low' = blur(low): H then V (t2 -> t3 -> t1); t2 keeps `low`.
      gl.draw(BLUR_FRAGMENT, { u_src: { t: 'tex', v: t2.tex, unit: 0 }, u_dir: { t: '2f', v: hx } }, t3);
      gl.draw(BLUR_FRAGMENT, { u_src: { t: 'tex', v: t3.tex, unit: 0 }, u_dir: { t: '2f', v: vy } }, t1);

      gl.draw(
        RECOMBINE_FRAGMENT,
        {
          u_orig: { t: 'tex', v: src, unit: 0 },
          u_low: { t: 'tex', v: t2.tex, unit: 1 },
          u_lowSmooth: { t: 'tex', v: t1.tex, unit: 2 },
          u_mask: { t: 'tex', v: maskTex, unit: 3 },
          u_strength: { t: '1f', v: params.strength },
          u_toneLightness: { t: '1f', v: params.toneLightness },
          u_toneTint: { t: '1f', v: params.toneTint },
        },
        dst,
      );

      gl.deleteTarget(t1);
      gl.deleteTarget(t2);
      gl.deleteTarget(t3);
      gl.deleteTexture(maskTex);
      return dst.tex;
    },
  };
}
