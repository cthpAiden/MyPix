/**
 * Canonical MediaPipe Face Mesh region index sets (T061, contracts/vision.md).
 *
 * These are the published, stable landmark indices of the 478-point Face
 * Landmarker mesh, grouped into the polygons the beauty tools need: face oval,
 * lips, eyes, brows, nose, inner-mouth (teeth), and under-eye. Consumers derive
 * masks/handles from these; the exact model output is rescaled to image space
 * by the provider (faceLandmarker.ts).
 */
import type { FaceRegions } from './types';

// Outer face contour (36 points).
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];

// Outer + inner lip contours.
const LIPS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37,
  39, 40, 185, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311,
  312, 13, 82, 81, 80, 191,
];

// Inner mouth ring — teeth-whitening target.
const TEETH_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

const LEFT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 466, 388, 387, 386, 385, 384, 398];
const RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173];

const LEFT_BROW = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336];
const RIGHT_BROW = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107];

// Nose bridge + tip + nostrils.
const NOSE = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 327, 331, 129, 358, 360];

// Cheek/under-eye pockets below each eye.
const UNDER_EYE_LEFT = [463, 341, 256, 252, 253, 254, 339, 255, 359, 446];
const UNDER_EYE_RIGHT = [243, 112, 26, 22, 23, 24, 110, 25, 130, 226];

export const FACE_REGIONS: FaceRegions = {
  faceOval: FACE_OVAL,
  lips: LIPS,
  leftEye: LEFT_EYE,
  rightEye: RIGHT_EYE,
  leftBrow: LEFT_BROW,
  rightBrow: RIGHT_BROW,
  teethInner: TEETH_INNER,
  underEyeLeft: UNDER_EYE_LEFT,
  underEyeRight: UNDER_EYE_RIGHT,
  nose: NOSE,
};

/**
 * The de-duplicated union of all region indices — the movable vertex set for the
 * warp mesh (the anchor ring is added in shared/warp/mesh). Kept stable so the
 * mesh topology is deterministic per detection.
 */
export function warpVertexIndices(): number[] {
  const set = new Set<number>();
  for (const region of Object.values(FACE_REGIONS)) {
    for (const i of region) set.add(i);
  }
  return [...set].sort((a, b) => a - b);
}
