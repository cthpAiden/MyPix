/**
 * Pose Landmarker provider (T071, contracts/vision.md).
 *
 * Lazy singleton over MediaPipe's 33-point Pose Landmarker in IMAGE mode (CPU
 * delegate). Returns points in image-space pixels with per-point visibility, or
 * null when nothing is detected — body reshape falls back to manual warp then.
 */
import type { PoseLandmarker as PoseLandmarkerType } from '@mediapipe/tasks-vision';
import { assertModelAvailable, getVisionFileset, MODEL_URLS, VISION_DELEGATE } from './modelLoader';
import type { PoseLandmarkProvider, PoseLandmarks, PosePoint } from './types';

class MediaPipePoseProvider implements PoseLandmarkProvider {
  private landmarker: PoseLandmarkerType | null = null;
  private loading: Promise<void> | null = null;

  private async ensure(): Promise<PoseLandmarkerType> {
    if (this.landmarker) return this.landmarker;
    if (!this.loading) {
      this.loading = (async () => {
        await assertModelAvailable(MODEL_URLS.pose);
        const fileset = await getVisionFileset();
        const { PoseLandmarker } = await import('@mediapipe/tasks-vision');
        this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URLS.pose, delegate: VISION_DELEGATE },
          runningMode: 'IMAGE',
          numPoses: 1,
        });
      })();
    }
    await this.loading;
    return this.landmarker!;
  }

  async detect(image: ImageBitmap): Promise<PoseLandmarks | null> {
    const landmarker = await this.ensure();
    const result = landmarker.detect(image);
    const set = result.landmarks?.[0];
    if (!set || set.length === 0) return null;
    const points: PosePoint[] = set.map((p) => ({
      x: p.x * image.width,
      y: p.y * image.height,
      visibility: p.visibility ?? 1,
    }));
    return { points };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.loading = null;
  }
}

let provider: MediaPipePoseProvider | null = null;

export function getPoseProvider(): PoseLandmarkProvider {
  if (!provider) provider = new MediaPipePoseProvider();
  return provider;
}

export function disposePoseProvider(): void {
  provider?.dispose();
  provider = null;
}
