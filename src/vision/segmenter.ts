/**
 * Image Segmenter provider (T075, research R16, contracts/vision.md).
 *
 * Lazy singleton over MediaPipe's selfie Image Segmenter (Apache-2.0 baseline).
 * Returns a person-vs-background confidence mask at the model's resolution.
 * Quality is lifted by post-processing rather than a heavier model:
 * `refineEdges` feathers and morphologically cleans the confidence mask (the
 * FR-211 edge-refinement control). The interface is the swap seam for a
 * higher-quality matting model later.
 */
import type { ImageSegmenter as ImageSegmenterType } from '@mediapipe/tasks-vision';
import { assertModelAvailable, getVisionFileset, MODEL_URLS, VISION_DELEGATE } from './modelLoader';
import type { SegmentationProvider, SegmentationResult } from './types';

/** Separable box blur of a single-channel mask (feathering). */
function featherMask(mask: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius < 1) return mask;
  const r = Math.round(radius);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        sum += mask[y * w + xx];
      }
      tmp[y * w + x] = sum * norm;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        sum += tmp[yy * w + x];
      }
      out[y * w + x] = sum * norm;
    }
  }
  return out;
}

/** Sharpen the mask contrast around 0.5 so refined edges stay crisp. */
function sharpenEdge(mask: Float32Array, amount: number): Float32Array {
  const out = new Float32Array(mask.length);
  const k = 1 + amount * 6;
  for (let i = 0; i < mask.length; i++) {
    const v = (mask[i] - 0.5) * k + 0.5;
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return out;
}

function makeResult(confidenceMask: Float32Array, width: number, height: number): SegmentationResult {
  return {
    confidenceMask,
    width,
    height,
    async refineEdges(strength: number): Promise<SegmentationResult> {
      const s = Math.max(0, Math.min(1, strength));
      const feathered = featherMask(confidenceMask, width, height, 1 + s * 4);
      const refined = sharpenEdge(feathered, s);
      return makeResult(refined, width, height);
    },
  };
}

class MediaPipeSegProvider implements SegmentationProvider {
  private segmenter: ImageSegmenterType | null = null;
  private loading: Promise<void> | null = null;

  private async ensure(): Promise<ImageSegmenterType> {
    if (this.segmenter) return this.segmenter;
    if (!this.loading) {
      this.loading = (async () => {
        await assertModelAvailable(MODEL_URLS.segmentation);
        const fileset = await getVisionFileset();
        const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
        this.segmenter = await ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URLS.segmentation, delegate: VISION_DELEGATE },
          runningMode: 'IMAGE',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        });
      })();
    }
    await this.loading;
    return this.segmenter!;
  }

  async segment(image: ImageBitmap): Promise<SegmentationResult> {
    const segmenter = await this.ensure();
    const result = segmenter.segment(image);
    const mp = result.confidenceMasks?.[0];
    if (!mp) throw new Error('segmentation produced no mask');
    const width = mp.width;
    const height = mp.height;
    const data = Float32Array.from(mp.getAsFloat32Array());
    result.close();
    return makeResult(data, width, height);
  }

  dispose(): void {
    this.segmenter?.close();
    this.segmenter = null;
    this.loading = null;
  }
}

let provider: MediaPipeSegProvider | null = null;

export function getSegmentationProvider(): SegmentationProvider {
  if (!provider) provider = new MediaPipeSegProvider();
  return provider;
}

export function disposeSegmentationProvider(): void {
  provider?.dispose();
  provider = null;
}
