/**
 * Face Landmarker provider (T060, research R3, contracts/vision.md).
 *
 * Lazy singleton over MediaPipe's 478-point Face Landmarker in IMAGE mode with
 * the CPU/WASM delegate. Returns landmarks in image-space pixels of the input
 * bitmap with the region index sets and a Delaunay tessellation attached, so
 * consumers never see MediaPipe types or detection resolution. Never throws for
 * "no face" — returns [].
 */
import type { FaceLandmarker as FaceLandmarkerType } from '@mediapipe/tasks-vision';
import type { Point2D } from '@/engine/editState';
import { delaunay } from '@/shared/warp/mesh';
import { FACE_REGIONS } from './regions';
import { assertModelAvailable, getVisionFileset, MODEL_URLS, VISION_DELEGATE } from './modelLoader';
import type { FaceLandmarkProvider, FaceLandmarks } from './types';

const MAX_FACES = 5;

class MediaPipeFaceProvider implements FaceLandmarkProvider {
  private landmarker: FaceLandmarkerType | null = null;
  private loading: Promise<void> | null = null;
  private disposed = false;

  private async ensure(): Promise<FaceLandmarkerType> {
    if (this.landmarker) return this.landmarker;
    if (!this.loading) {
      this.loading = (async () => {
        await assertModelAvailable(MODEL_URLS.face);
        const fileset = await getVisionFileset();
        const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
        const lm = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URLS.face, delegate: VISION_DELEGATE },
          runningMode: 'IMAGE',
          numFaces: MAX_FACES,
        });
        // dispose() may have run while the model was loading; close the freshly
        // created model instead of assigning it to an orphaned provider (leak).
        if (this.disposed) {
          lm.close();
          return;
        }
        this.landmarker = lm;
      })();
    }
    await this.loading;
    if (!this.landmarker) throw new Error('face provider disposed during load');
    return this.landmarker;
  }

  async detect(image: ImageBitmap): Promise<FaceLandmarks[]> {
    const landmarker = await this.ensure();
    const result = landmarker.detect(image);
    const faces: FaceLandmarks[] = [];
    for (const norm of result.faceLandmarks) {
      const points: Point2D[] = norm.map((p) => ({ x: p.x * image.width, y: p.y * image.height }));
      const tris = delaunay(points);
      const meshTriangles = new Uint16Array(tris.length * 3);
      tris.forEach((t, i) => {
        meshTriangles[i * 3] = t.a;
        meshTriangles[i * 3 + 1] = t.b;
        meshTriangles[i * 3 + 2] = t.c;
      });
      faces.push({ points, regions: FACE_REGIONS, meshTriangles });
    }
    return faces;
  }

  dispose(): void {
    this.disposed = true;
    this.landmarker?.close();
    this.landmarker = null;
    this.loading = null;
  }
}

let provider: MediaPipeFaceProvider | null = null;

export function getFaceProvider(): FaceLandmarkProvider {
  if (!provider) provider = new MediaPipeFaceProvider();
  return provider;
}

export function disposeFaceProvider(): void {
  provider?.dispose();
  provider = null;
}
