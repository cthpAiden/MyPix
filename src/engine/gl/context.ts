/**
 * The single shared WebGL2 context (research R4, contracts/engine.md).
 *
 * iOS Safari limits concurrent GPU contexts, so the whole app owns exactly one.
 * On `webglcontextlost` the engine rebuilds all GL resources from EditState and
 * re-renders — callers never handle context loss. This module provides the
 * low-level primitives (program cache, textures, render targets, a fullscreen
 * draw); the render orchestrator sequences passes over them.
 */

const FULLSCREEN_VERT = `#version 300 es
precision highp float;
// Single fullscreen triangle — no vertex buffer needed (gl_VertexID trick).
out vec2 v_uv;
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

export interface RenderTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
}

export type UniformValue =
  | { t: '1f'; v: number }
  | { t: '2f'; v: [number, number] }
  | { t: '3f'; v: [number, number, number] }
  | { t: '4f'; v: [number, number, number, number] }
  | { t: '1i'; v: number }
  | { t: '1fv'; v: Float32Array | number[] }
  | { t: 'tex'; v: WebGLTexture; unit: number };

export class GLContext {
  readonly gl: WebGL2RenderingContext;
  private readonly programs = new Map<string, WebGLProgram>();
  private readonly emptyVao: WebGLVertexArrayObject;
  private lost = false;
  private readonly lostListeners = new Set<() => void>();
  private readonly restoredListeners = new Set<() => void>();

  constructor(readonly canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      // Prefer Display-P3 where the browser exposes it (research R14).
      // (drawingBufferColorSpace is set below where supported.)
    });
    if (!gl) throw new Error('WebGL2 is required and unavailable');
    this.gl = gl;

    try {
      // Wide-gamut drawing buffer when supported; harmless where ignored.
      (gl as unknown as { drawingBufferColorSpace?: string }).drawingBufferColorSpace =
        'display-p3';
    } catch {
      /* sRGB fallback — chain stays consistent (R14). */
    }

    this.emptyVao = gl.createVertexArray()!;

    if ('addEventListener' in canvas) {
      canvas.addEventListener(
        'webglcontextlost',
        (e) => {
          e.preventDefault();
          this.lost = true;
          this.programs.clear();
          this.lostListeners.forEach((cb) => cb());
        },
        false,
      );
      canvas.addEventListener(
        'webglcontextrestored',
        () => {
          this.lost = false;
          this.restoredListeners.forEach((cb) => cb());
        },
        false,
      );
    }
  }

  get isLost(): boolean {
    return this.lost || this.gl.isContextLost();
  }

  onLost(cb: () => void): () => void {
    this.lostListeners.add(cb);
    return () => this.lostListeners.delete(cb);
  }
  onRestored(cb: () => void): () => void {
    this.restoredListeners.add(cb);
    return () => this.restoredListeners.delete(cb);
  }

  /** Compile+link a fragment shader against the shared fullscreen vertex shader (cached by source). */
  program(fragSource: string): WebGLProgram {
    const cached = this.programs.get(fragSource);
    if (cached) return cached;
    const { gl } = this;
    const vs = this.shader(gl.VERTEX_SHADER, FULLSCREEN_VERT);
    const fs = this.shader(gl.FRAGMENT_SHADER, fragSource);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`Program link failed: ${log}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.programs.set(fragSource, prog);
    return prog;
  }

  private shader(type: number, source: string): WebGLShader {
    const { gl } = this;
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`Shader compile failed: ${log}\n${source}`);
    }
    return sh;
  }

  createTexture(width: number, height: number, data?: TexImageSource | null): WebGLTexture {
    const { gl } = this;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (data) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    return tex;
  }

  /** Upload a source image/bitmap into a fresh texture (flipped to match UV origin). */
  uploadImage(source: TexImageSource): WebGLTexture {
    const { gl } = this;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const tex = this.createTexture(0, 0, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return tex;
  }

  createTarget(width: number, height: number): RenderTarget {
    const { gl } = this;
    const tex = this.createTexture(width, height);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, width, height };
  }

  /**
   * Run a fragment program over a fullscreen triangle, writing to `target`
   * (or the default framebuffer when null). Uniforms are set by name.
   */
  draw(
    fragSource: string,
    uniforms: Record<string, UniformValue>,
    target: RenderTarget | null,
    viewport?: { width: number; height: number },
  ): void {
    const { gl } = this;
    if (this.isLost) return;
    const prog = this.program(fragSource);
    gl.useProgram(prog);
    gl.bindVertexArray(this.emptyVao);

    for (const [name, u] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(prog, name);
      if (loc == null) continue;
      switch (u.t) {
        case '1f':
          gl.uniform1f(loc, u.v);
          break;
        case '2f':
          gl.uniform2f(loc, u.v[0], u.v[1]);
          break;
        case '3f':
          gl.uniform3f(loc, u.v[0], u.v[1], u.v[2]);
          break;
        case '4f':
          gl.uniform4f(loc, u.v[0], u.v[1], u.v[2], u.v[3]);
          break;
        case '1i':
          gl.uniform1i(loc, u.v);
          break;
        case '1fv':
          gl.uniform1fv(loc, u.v);
          break;
        case 'tex':
          gl.activeTexture(gl.TEXTURE0 + u.unit);
          gl.bindTexture(gl.TEXTURE_2D, u.v);
          gl.uniform1i(loc, u.unit);
          break;
      }
    }

    const w = target?.width ?? viewport?.width ?? this.canvas.width;
    const h = target?.height ?? viewport?.height ?? this.canvas.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  resizeCanvas(width: number, height: number): void {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  deleteTarget(t: RenderTarget): void {
    this.gl.deleteFramebuffer(t.fbo);
    this.gl.deleteTexture(t.tex);
  }

  deleteTexture(tex: WebGLTexture): void {
    this.gl.deleteTexture(tex);
  }
}

/**
 * Double-buffered render targets for multi-pass ping-pong. `src`/`dst` swap
 * after each pass so a chain of shaders reads the previous result.
 */
export class PingPong {
  private a: RenderTarget;
  private b: RenderTarget;
  private useA = true;

  constructor(private readonly ctx: GLContext, width: number, height: number) {
    this.a = ctx.createTarget(width, height);
    this.b = ctx.createTarget(width, height);
  }

  get src(): RenderTarget {
    return this.useA ? this.a : this.b;
  }
  get dst(): RenderTarget {
    return this.useA ? this.b : this.a;
  }
  swap(): void {
    this.useA = !this.useA;
  }

  resize(width: number, height: number): void {
    if (this.a.width === width && this.a.height === height) return;
    this.ctx.deleteTarget(this.a);
    this.ctx.deleteTarget(this.b);
    this.a = this.ctx.createTarget(width, height);
    this.b = this.ctx.createTarget(width, height);
    this.useA = true;
  }

  dispose(): void {
    this.ctx.deleteTarget(this.a);
    this.ctx.deleteTarget(this.b);
  }
}
