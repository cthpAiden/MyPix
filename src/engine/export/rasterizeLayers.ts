/**
 * Full-resolution overlay rasterization (US3.2, T082, FR-309). The GL tiler
 * produces the edited *pixel* result as a full-size RGBA buffer; this composites
 * the z-ordered creative Layers (makeup, text, stickers, frames, blend, doodle)
 * on top at export scale using the SAME drawLayers routine as the live preview,
 * so overlays are crisp and preview ≡ export.
 *
 * Compositing runs in padded horizontal bands (never one giant canvas) so it
 * respects the iOS single-canvas ~16.7 MP limit that motivates tiled export.
 */
import { drawLayers, layerAssetUrls } from '@/engine/render/layers';
import { mapSourceToOutput } from '@/engine/render/geometry';
import { preloadAssets } from '@/engine/render/layerAssets';
import { ensureFontsLoaded } from '@/shared/fonts';
import type { CropParams, EditState, Point2D } from '@/engine/editState';
import type { DetectedLandmarkSet } from '@/vision/types';

const LAYER_BAND = 1024;
const PAD = 64; // overlap so feathered makeup doesn't seam at band edges

function create2d(w: number, h: number): {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
} {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    return { canvas, ctx: canvas.getContext('2d')! };
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')! };
}

/**
 * Composite the edit's layers onto a full-resolution RGBA buffer in place.
 * No-op (returns the same buffer) when there are no enabled layers.
 */
export async function rasterizeLayers(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  editState: EditState,
  crop: CropParams,
  landmarks: DetectedLandmarkSet | null,
  imageWidth: number,
  imageHeight: number,
): Promise<Uint8ClampedArray> {
  const layers = editState.layers.filter((l) => l.enabled);
  if (layers.length === 0) return rgba;

  await preloadAssets(layerAssetUrls(layers));
  await ensureFontsLoaded();

  const mapSrc = (p: Point2D) => mapSourceToOutput(p, crop);

  for (let y0 = 0; y0 < height; y0 += LAYER_BAND) {
    const bandH = Math.min(LAYER_BAND, height - y0);
    const drawY0 = Math.max(0, y0 - PAD);
    const drawY1 = Math.min(height, y0 + bandH + PAD);
    const ch = drawY1 - drawY0;

    const { ctx } = create2d(width, ch);
    const base = rgba.slice(drawY0 * width * 4, drawY1 * width * 4);
    ctx.putImageData(new ImageData(base, width, ch), 0, 0);

    ctx.save();
    ctx.translate(0, -drawY0);
    drawLayers(ctx, layers, {
      outW: width,
      outH: height,
      landmarks,
      imageWidth,
      imageHeight,
      mapSrc,
    });
    ctx.restore();

    const composited = ctx.getImageData(0, 0, width, ch).data;
    const localTop = y0 - drawY0;
    rgba.set(composited.subarray(localTop * width * 4, (localTop + bandH) * width * 4), y0 * width * 4);
  }

  return rgba;
}
