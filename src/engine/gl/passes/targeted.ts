/**
 * Targeted facial enhancements (US2.3, T069): teeth whitening, eye brightening,
 * under-eye reduction — each confined to its landmark region. The three region
 * masks are packed into one RGBA data texture (R=teeth, G=eyes, B=under-eye) so
 * a single fragment applies all three, each scaled by its own strength.
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import { maskChannel, rasterizeFilledMask, rasterizeMultiFilledMask } from '@/shared/mask';
import { facePolygons } from '@/vision/facePolygons';
import type { TargetedEnhanceParams } from '@/engine/editState';
import type { FaceLandmarks } from '@/vision/types';

const MASK_RES = 128;

export const TARGETED_FRAGMENT = buildFragment(`
uniform sampler2D u_masks;  // r=teeth, g=eyes, b=under-eye
uniform float u_teeth, u_eyeBrighten, u_underEye;

void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  vec3 m = texture(u_masks, v_uv).rgb;

  // Teeth: remove yellow cast + lift toward a brighter neutral.
  float tw = m.r * u_teeth;
  float y = luma(c);
  c = mix(c, vec3(min(1.0, y + 0.08)), tw * 0.35);
  c.b += tw * 0.04;

  // Eyes: brighten + a touch of local sparkle.
  float eb = m.g * u_eyeBrighten;
  c += eb * 0.12;

  // Under-eye: lift only the darker pixels (reduce the shadow).
  float ue = m.b * u_underEye;
  c += ue * 0.12 * (1.0 - luma(c));

  fragColor = vec4(clampColor(c), 1.0);
}`);

/** Region masks depend only on the face geometry, so cache per detected face. */
const maskCache = new WeakMap<FaceLandmarks, Uint8Array>();

export function buildTargetedPass(
  face: FaceLandmarks,
  params: TargetedEnhanceParams,
  imageW: number,
  imageH: number,
): RenderPass {
  let packed = maskCache.get(face);
  if (!packed) {
    const poly = facePolygons(face, imageW, imageH);
    const teeth = maskChannel(rasterizeFilledMask(MASK_RES, poly.teeth, 2));
    const eyes = maskChannel(rasterizeMultiFilledMask(MASK_RES, poly.eyes, 2));
    const under = maskChannel(rasterizeMultiFilledMask(MASK_RES, poly.underEye, 3));

    packed = new Uint8Array(MASK_RES * MASK_RES * 4);
    for (let i = 0; i < teeth.length; i++) {
      packed[i * 4] = Math.round(teeth[i] * 255);
      packed[i * 4 + 1] = Math.round(eyes[i] * 255);
      packed[i * 4 + 2] = Math.round(under[i] * 255);
      packed[i * 4 + 3] = 255;
    }
    maskCache.set(face, packed);
  }

  return {
    name: 'targetedEnhance',
    fragment: TARGETED_FRAGMENT,
    uniforms: () => ({
      u_teeth: { t: '1f', v: params.teethWhiten },
      u_eyeBrighten: { t: '1f', v: params.eyeBrighten },
      u_underEye: { t: '1f', v: params.underEyeReduce },
    }),
    textures: [{ name: 'u_masks', unit: 1, data: packed, width: MASK_RES, height: MASK_RES }],
  };
}
