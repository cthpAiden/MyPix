/**
 * Extra inputs the pixel pipeline needs beyond EditState for Phase 2 passes
 * (warp, skin, targeted, background): the current detection set and the full
 * image dimensions used to normalize image-space landmarks into [0,1]. Threaded
 * identically through the preview orchestrator and the tiled export so
 * preview ≡ export (SC-003).
 */
import type { DetectedLandmarkSet } from '@/vision/types';

export interface RenderContext {
  landmarks: DetectedLandmarkSet | null;
  imageWidth: number;
  imageHeight: number;
}
