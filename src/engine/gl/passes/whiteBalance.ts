/**
 * White balance pass (US1.4, T045). Applies temp/tint channel gains. The
 * eyedropper (panel) samples a picked neutral pixel and converts it to
 * temp/tint before dispatch, so this pass stays pure.
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import type { WhiteBalanceParams } from '@/engine/editState';

export const WB_FRAGMENT = buildFragment(`
uniform float u_temp;   // -1..1
uniform float u_tint;   // -1..1
void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  // Temperature: warm (+r, -b). Tint: green<->magenta.
  c.r *= 1.0 + u_temp * 0.20;
  c.b *= 1.0 - u_temp * 0.20;
  c.g *= 1.0 + u_tint * 0.15;
  fragColor = vec4(clampColor(c), 1.0);
}`);

export function buildWhiteBalancePass(params: WhiteBalanceParams): RenderPass {
  return {
    name: 'whiteBalance',
    fragment: WB_FRAGMENT,
    uniforms: () => ({
      u_temp: { t: '1f', v: params.temp / 100 },
      u_tint: { t: '1f', v: params.tint / 100 },
    }),
  };
}
