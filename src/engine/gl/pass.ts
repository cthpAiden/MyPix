/**
 * Shared GLSL building blocks and the pass abstraction (T015).
 *
 * Every fragment shader in the pixel pipeline is built from GLSL_PRELUDE +
 * its body, so color-space and helper math are identical across passes and
 * therefore identical between the working-resolution preview and the tiled
 * full-resolution export (SC-003).
 */
import type { GLContext, RenderTarget, UniformValue } from './context';

/** Common header: precision, the incoming UV, the source sampler, helpers. */
export const GLSL_PRELUDE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_src;
uniform vec2 u_texel;   // 1/width, 1/height of the working texture

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 rgb2hsl(vec3 c) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  float h = 0.0, s = 0.0;
  float d = mx - mn;
  if (d > 1e-5) {
    s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
    if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x, s = hsl.y, l = hsl.z;
  if (s <= 0.0) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(hue2rgb(p, q, h + 1.0/3.0), hue2rgb(p, q, h), hue2rgb(p, q, h - 1.0/3.0));
}

vec3 clampColor(vec3 c) { return clamp(c, 0.0, 1.0); }
`;

/** Build a full fragment shader from a body that reads `u_src` at `v_uv`. */
export function buildFragment(body: string): string {
  return `${GLSL_PRELUDE}\n${body}`;
}

/** Simple copy shader (used to blit into the on-screen buffer / tiles). */
export const PASSTHROUGH = buildFragment(`
void main() {
  fragColor = texture(u_src, v_uv);
}`);

/**
 * A CPU-computed auxiliary texture (RGBA8) a pass needs bound to a sampler —
 * e.g. a warp displacement field or a landmark-derived mask (Phase 2). The pass
 * runner uploads it, binds it to `name` at `unit`, and disposes it after the
 * draw so no GPU memory leaks per frame.
 */
export interface DataTexture {
  name: string;
  unit: number;
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * A single pipeline pass: a fragment shader plus a uniform provider. The
 * orchestrator supplies `u_src` (previous result) and `u_texel`; the pass adds
 * its own params. Passes are ordered deterministically by pipeline stage.
 *
 * Most passes are one fullscreen fragment draw. Phase 2 passes may additionally
 * carry `textures` (auxiliary data textures) and/or provide `execute` — a custom
 * multi-draw routine (frequency separation, background blur) that manages its
 * own scratch targets, renders the final result into `dst`, and returns the
 * texture holding it.
 */
export interface RenderPass {
  name: string;
  fragment: string;
  /** Extra uniforms beyond u_src/u_texel, computed from the target size. */
  uniforms(target: RenderTarget): Record<string, UniformValue>;
  /** Auxiliary data textures uploaded and bound by the runner before the draw. */
  textures?: DataTexture[];
  /** Custom multi-pass executor; returns the texture holding the result. */
  execute?: (
    gl: GLContext,
    src: WebGLTexture,
    dst: RenderTarget,
    texel: [number, number],
  ) => WebGLTexture;
}
