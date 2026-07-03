/**
 * Vision provider types (contracts/vision.md).
 *
 * The only place `@mediapipe/tasks-vision` is imported is the provider modules;
 * face/body/background/makeup modules consume these interfaces so a model swap
 * (research R16) never touches consumers. All coordinates are image-space pixels
 * of the *original* — providers detect on a downscaled copy and rescale.
 */
import type { Point2D } from '@/engine/editState';
import type { ImageFingerprint } from '@/engine/types';

/** Named 478-point face-mesh region index sets (see vision/regions.ts). */
export interface FaceRegions {
  faceOval: number[];
  lips: number[];
  leftEye: number[];
  rightEye: number[];
  leftBrow: number[];
  rightBrow: number[];
  teethInner: number[];
  underEyeLeft: number[];
  underEyeRight: number[];
  nose: number[];
}

export interface FaceLandmarks {
  /** 478 points, image-space pixels (not normalized). */
  points: Point2D[];
  regions: FaceRegions;
  /** Canonical tessellation topology for the warp mesh (Delaunay of points). */
  meshTriangles: Uint16Array;
}

export interface PosePoint extends Point2D {
  visibility: number;
}
export interface PoseLandmarks {
  /** 33 points, image-space pixels. */
  points: PosePoint[];
}

export interface SegmentationResult {
  /** Person-vs-background confidence, working resolution, row-major 0…1. */
  confidenceMask: Float32Array;
  width: number;
  height: number;
  /** Guided-filter edge refinement against the source (FR-211). */
  refineEdges(strength: number): Promise<SegmentationResult>;
}

export interface FaceLandmarkProvider {
  /** [] when no face — never throws for "not found". */
  detect(image: ImageBitmap): Promise<FaceLandmarks[]>;
  dispose(): void;
}
export interface PoseLandmarkProvider {
  /** null when confidence below threshold. */
  detect(image: ImageBitmap): Promise<PoseLandmarks | null>;
  dispose(): void;
}
export interface SegmentationProvider {
  segment(image: ImageBitmap): Promise<SegmentationResult>;
  dispose(): void;
}

/**
 * Ephemeral per-photo detection cache (recomputable — never persisted).
 * `computedFor` invalidates when geometry-changing ops change (cropStateHash).
 */
export interface DetectedLandmarkSet {
  faces: FaceLandmarks[];
  selectedFaceIndex: number;
  pose: PoseLandmarks | null;
  segmentation: SegmentationResult | null;
  computedFor: { fingerprint: ImageFingerprint; cropStateHash: string };
}

/** Which detectors a tool needs; the engine lazy-loads these before opening. */
export type VisionKind = 'face' | 'pose' | 'segmentation';

/** Raised when a model isn't cached and the device is offline (FR bilingual). */
export class ModelUnavailableOfflineError extends Error {
  constructor(readonly modelUrl: string) {
    super(`Model not cached and device is offline: ${modelUrl}`);
    this.name = 'ModelUnavailableOfflineError';
  }
}
