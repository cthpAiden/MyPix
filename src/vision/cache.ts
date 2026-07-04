/**
 * DetectedLandmarkSet cache + lazy detection orchestration (T061).
 *
 * Detection results cache per photo keyed by {fingerprint, cropStateHash}
 * (contracts/vision.md): geometry-changing ops invalidate; adjustments/filters
 * do not. Each detector runs at most once per key and only when a tool that
 * needs it is opened (lazy). The set is recomputable and never persisted.
 */
import type { ImageFingerprint } from '@/engine/types';
import { getFaceProvider } from './faceLandmarker';
import { getPoseProvider } from './poseLandmarker';
import { getSegmentationProvider } from './segmenter';
import type { DetectedLandmarkSet, VisionKind } from './types';

function keyOf(fp: ImageFingerprint, cropStateHash: string): string {
  return `${fp.sampleHash}:${fp.byteSize}:${fp.width}x${fp.height}:${cropStateHash}`;
}

export class LandmarkCache {
  private key: string | null = null;
  private set: DetectedLandmarkSet | null = null;
  private inflight = new Map<VisionKind, Promise<void>>();

  /** Current set if it still matches the given key, else null. */
  get(fp: ImageFingerprint, cropStateHash: string): DetectedLandmarkSet | null {
    return this.key === keyOf(fp, cropStateHash) ? this.set : null;
  }

  private reset(fp: ImageFingerprint, cropStateHash: string): DetectedLandmarkSet {
    this.key = keyOf(fp, cropStateHash);
    this.inflight.clear();
    this.set = {
      faces: [],
      selectedFaceIndex: 0,
      pose: null,
      segmentation: null,
      computedFor: { fingerprint: fp, cropStateHash },
    };
    return this.set;
  }

  /** Choose which face the landmark-dependent tools target (multi-face, FR-203). */
  selectFace(index: number): void {
    if (this.set && index >= 0 && index < this.set.faces.length) {
      this.set.selectedFaceIndex = index;
    }
  }

  clear(): void {
    this.key = null;
    this.set = null;
    this.inflight.clear();
  }

  /**
   * Ensure the requested detectors have run for this photo/geometry, running
   * each lazily and caching the result. Returns the (mutated) set.
   */
  async ensure(
    bitmap: ImageBitmap,
    fp: ImageFingerprint,
    cropStateHash: string,
    kinds: VisionKind[],
  ): Promise<DetectedLandmarkSet> {
    let set = this.get(fp, cropStateHash);
    if (!set) set = this.reset(fp, cropStateHash);
    const target = set;

    const runs: Promise<void>[] = [];
    for (const kind of kinds) {
      if (kind === 'face' && target.faces.length > 0) continue;
      if (kind === 'pose' && target.pose) continue;
      if (kind === 'segmentation' && target.segmentation) continue;

      let run = this.inflight.get(kind);
      if (!run) {
        // Only clear the map entry if it is still THIS run: a reset() (crop /
        // project change) may have replaced the set and started a fresh
        // detection under the same kind while this one was still in flight;
        // a bare delete(kind) would evict that newer entry.
        const started: Promise<void> = this.detect(kind, bitmap, target).finally(() => {
          if (this.inflight.get(kind) === started) this.inflight.delete(kind);
        });
        run = started;
        this.inflight.set(kind, started);
      }
      runs.push(run);
    }
    await Promise.all(runs);
    return target;
  }

  private async detect(kind: VisionKind, bitmap: ImageBitmap, target: DetectedLandmarkSet): Promise<void> {
    if (kind === 'face') {
      target.faces = await getFaceProvider().detect(bitmap);
      if (target.selectedFaceIndex >= target.faces.length) target.selectedFaceIndex = 0;
    } else if (kind === 'pose') {
      target.pose = await getPoseProvider().detect(bitmap);
    } else if (kind === 'segmentation') {
      target.segmentation = await getSegmentationProvider().segment(bitmap);
    }
  }
}
