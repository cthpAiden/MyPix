/**
 * Clone-stamp & heal GL pass (US3.5, T085/T086). Manual, no-AI retouch: strokes
 * copy pixels from a source offset over the destination. Like the warp pass, the
 * per-pixel work is baked on the CPU into a low-res field texture (offset + blend
 * weight + mode) and sampled in the fragment, so preview and tiled export share
 * identical math (SC-003). Heal additionally re-matches the copied patch's
 * low-frequency tone to its destination so a blemish repair blends in.
 *
 * Coordinates follow the liquify convention: strokes are captured in the display
 * (≈ source) UV space; the pass runs before the geometry stage.
 */
import { buildFragment, type RenderPass } from '@/engine/gl/pass';
import type { Point2D, RetouchParams, RetouchStroke } from '@/engine/editState';

const FIELD_RES = 512;
const MAX_OFFSET = 1.0; // encoded offset spans ±1 full image in UV

export const RETOUCH_FRAGMENT = buildFragment(`
uniform sampler2D u_field;
uniform float u_maxOffset;

vec3 lowfreq(vec2 uv) {
  vec2 r = u_texel * 6.0;
  vec3 s = texture(u_src, uv).rgb * 0.25;
  s += texture(u_src, uv + vec2(r.x, 0.0)).rgb * 0.125;
  s += texture(u_src, uv - vec2(r.x, 0.0)).rgb * 0.125;
  s += texture(u_src, uv + vec2(0.0, r.y)).rgb * 0.125;
  s += texture(u_src, uv - vec2(0.0, r.y)).rgb * 0.125;
  s += texture(u_src, uv + r).rgb * 0.0625;
  s += texture(u_src, uv - r).rgb * 0.0625;
  s += texture(u_src, uv + vec2(r.x, -r.y)).rgb * 0.0625;
  s += texture(u_src, uv + vec2(-r.x, r.y)).rgb * 0.0625;
  return s;
}

void main() {
  vec4 base = texture(u_src, v_uv);
  vec4 fd = texture(u_field, v_uv);
  float w = fd.b;
  if (w < 0.004) { fragColor = base; return; }
  vec2 offset = (fd.rg * 2.0 - 1.0) * u_maxOffset;
  vec2 suv = clamp(v_uv + offset, 0.0, 1.0);
  vec3 sampled = texture(u_src, suv).rgb;
  float heal = step(0.5, fd.a);
  vec3 healed = sampled + (lowfreq(v_uv) - lowfreq(suv)) * heal;
  vec3 outc = mix(base.rgb, clamp(healed, 0.0, 1.0), w);
  fragColor = vec4(outc, base.a);
}`);

function enc(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v / (2 * MAX_OFFSET) + 0.5)) * 255);
}

/** Rasterize the stroke list into an offset/weight/mode field (UV space). */
function buildRetouchField(strokes: RetouchStroke[], imgW: number, imgH: number): Uint8Array {
  const data = new Uint8Array(FIELD_RES * FIELD_RES * 4);
  const aspect = imgW / imgH;

  for (const stroke of strokes) {
    const ox = enc(stroke.sourceOffset.x);
    const oy = enc(stroke.sourceOffset.y);
    const mode = stroke.mode === 'heal' ? 255 : 0;
    const rxUV = Math.max(1 / FIELD_RES, stroke.radius); // fraction of width
    const ryUV = rxUV * aspect;
    const hardness = Math.max(0, Math.min(1, stroke.hardness));

    for (const pt of stroke.path) {
      stamp(data, pt, rxUV, ryUV, hardness, ox, oy, mode);
    }
  }
  return data;
}

function stamp(
  data: Uint8Array,
  center: Point2D,
  rxUV: number,
  ryUV: number,
  hardness: number,
  ox: number,
  oy: number,
  mode: number,
): void {
  const rxT = rxUV * FIELD_RES;
  const ryT = ryUV * FIELD_RES;
  const cx = center.x * FIELD_RES;
  const cy = center.y * FIELD_RES;
  const x0 = Math.max(0, Math.floor(cx - rxT));
  const x1 = Math.min(FIELD_RES - 1, Math.ceil(cx + rxT));
  const y0 = Math.max(0, Math.floor(cy - ryT));
  const y1 = Math.min(FIELD_RES - 1, Math.ceil(cy + ryT));
  const inner = 0.4 + hardness * 0.55; // where falloff begins

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rxT;
      const dy = (y + 0.5 - cy) / ryT;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const w = d <= inner ? 1 : 1 - (d - inner) / (1 - inner);
      const wByte = Math.round(Math.max(0, Math.min(1, w)) * 255);
      const i = (y * FIELD_RES + x) * 4;
      if (wByte <= data[i + 2]) continue; // keep the strongest coverage at a texel
      data[i] = ox;
      data[i + 1] = oy;
      data[i + 2] = wByte;
      data[i + 3] = mode;
    }
  }
}

let cache: { sig: string; field: Uint8Array } | null = null;

/** Build the retouch pass for the current op, or null when there are no strokes. */
export function buildRetouchPass(
  params: RetouchParams,
  imgW: number,
  imgH: number,
): RenderPass | null {
  const strokes = params.strokes;
  if (!strokes || strokes.length === 0) return null;

  // Include the full last stroke so undo/redo to a same-length-but-different
  // stroke list rebuilds the field rather than reusing a stale one.
  const last = strokes[strokes.length - 1];
  const sig = `${strokes.length}:${JSON.stringify(last)}:${imgW}x${imgH}`;
  if (!cache || cache.sig !== sig) {
    cache = { sig, field: buildRetouchField(strokes, imgW, imgH) };
  }

  return {
    name: 'retouch',
    fragment: RETOUCH_FRAGMENT,
    uniforms: () => ({ u_maxOffset: { t: '1f', v: MAX_OFFSET } }),
    textures: [{ name: 'u_field', unit: 1, data: cache.field, width: FIELD_RES, height: FIELD_RES }],
  };
}
