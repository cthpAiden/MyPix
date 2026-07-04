/**
 * Tiled full-resolution export renderer (US1.1, T034, research R11).
 *
 * Renders the identical GL pipeline (pixel passes + geometry) at FULL original
 * resolution, then reads pixels back in horizontal bands and hands them to the
 * streaming encoders. Reading in bands (not one giant readPixels) and encoding
 * from raw pixels (not canvas.toBlob) sidesteps the iOS single-canvas ~16.7 MP
 * limit that would otherwise blank/crash (FR-116, SC-011).
 */
import { GLContext, PingPong } from '@/engine/gl/context';
import { buildPipeline, runPixelPasses } from '@/engine/render/pipeline';
import { buildGeometryPass, croppedOutputSize } from '@/engine/render/geometry';
import { defaultCrop } from '@/engine/editState';
import type { CropParams, EditState } from '@/engine/editState';
import type { OriginalImage } from '@/engine/types';
import type { RenderContext } from '@/engine/render/renderContext';
import type { DetectedLandmarkSet } from '@/vision/types';

const READ_BAND = 256;

export interface FullResResult {
  rgba: Uint8ClampedArray; // top-down RGBA
  width: number;
  height: number;
}

function createCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * @param exportCrop optional crop override (e.g., an export aspect-ratio preset)
 *   applied on top of the edit's own crop.
 */
export async function renderFullResolution(
  original: OriginalImage,
  editState: EditState,
  exportCrop: CropParams | null,
  onProgress?: (done: number, total: number) => void,
  landmarks?: DetectedLandmarkSet | null,
): Promise<FullResResult> {
  const crop = exportCrop ?? (editState.operations.find((o) => o.type === 'crop' && o.enabled)?.params as CropParams) ?? defaultCrop();
  const out = croppedOutputSize(original.width, original.height, crop);

  const backing = createCanvas(out.width, out.height);
  const gl = new GLContext(backing);
  let ping: PingPong | null = null;
  let srcTex: WebGLTexture | null = null;
  try {
    const max = gl.gl.getParameter(gl.gl.MAX_TEXTURE_SIZE) as number;
    if (original.width > max || original.height > max || out.width > max || out.height > max) {
      throw new Error(`export: dimension exceeds MAX_TEXTURE_SIZE (${max})`);
    }

    // 1. Pixel passes at full source resolution (identical pipeline to preview).
    srcTex = gl.uploadImage(original.bitmap);
    ping = new PingPong(gl, original.width, original.height);
    const texel: [number, number] = [1 / original.width, 1 / original.height];
    const ctx: RenderContext = {
      landmarks: landmarks ?? null,
      imageWidth: original.width,
      imageHeight: original.height,
    };
    const passes = buildPipeline(editState, ctx);
    const edited = runPixelPasses(gl, srcTex, passes, ping, texel);

    // 2. Geometry into the full-resolution output (default framebuffer of `backing`).
    gl.resizeCanvas(out.width, out.height);
    const geom = buildGeometryPass(crop, original.width / original.height);
    gl.draw(
      geom.fragment,
      {
        u_src: { t: 'tex', v: edited, unit: 0 },
        u_texel: { t: '2f', v: texel },
        ...geom.uniforms({ fbo: null as never, tex: edited, width: out.width, height: out.height }),
      },
      null,
      { width: out.width, height: out.height },
    );

    // 3. Read back in bands, flipping GL's bottom-up rows to top-down.
    const rgba = new Uint8ClampedArray(out.width * out.height * 4);
    const rowBytes = out.width * 4;
    const band = new Uint8Array(out.width * READ_BAND * 4);
    const glCtx = gl.gl;
    for (let y = 0; y < out.height; y += READ_BAND) {
      const rows = Math.min(READ_BAND, out.height - y);
      glCtx.readPixels(0, y, out.width, rows, glCtx.RGBA, glCtx.UNSIGNED_BYTE, band);
      for (let r = 0; r < rows; r++) {
        const glRow = y + r;
        const dstRow = out.height - 1 - glRow; // flip vertically
        rgba.set(band.subarray(r * rowBytes, (r + 1) * rowBytes), dstRow * rowBytes);
      }
      onProgress?.(Math.min(y + rows, out.height), out.height);
    }

    return { rgba, width: out.width, height: out.height };
  } finally {
    // Free GPU resources and drop the throwaway context even on failure, so
    // repeated exports never accumulate live WebGL contexts (memory ceiling).
    ping?.dispose();
    if (srcTex) gl.deleteTexture(srcTex);
    gl.dispose();
  }
}
