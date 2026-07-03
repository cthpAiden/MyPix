/**
 * The central edit-state contract (contracts/edit-state.md).
 *
 * EditState is the single source of truth for rendering: every pixel the user
 * sees is a pure function `render(originalImage, editState)`. This module owns
 * the versioned, serializable schema every tool module writes and the engine
 * renders. Modules never call each other — the edit stack is the only channel.
 */

export const CURRENT_SCHEMA_VERSION = 1 as const;

export interface Point2D {
  x: number;
  y: number;
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'softLight'
  | 'hardLight'
  | 'darken'
  | 'lighten';

/* ------------------------------------------------------------------ *
 * Operation types & params (registry: contracts/edit-state.md)
 * ------------------------------------------------------------------ */

export type OperationType =
  // Phase 1
  | 'adjust'
  | 'curves'
  | 'colorMixer'
  | 'colorGrade'
  | 'whiteBalance'
  | 'crop'
  | 'filter'
  | 'finishing'
  // Phase 2 (types declared for forward-compat; implemented later)
  | 'faceReshape'
  | 'skinSmooth'
  | 'targetedEnhance'
  | 'bodyReshape'
  | 'liquify'
  | 'backgroundEffect'
  // Phase 3
  | 'retouch';

/** The 12 global light/color params, each −100…100 (contracts). */
export interface AdjustParams {
  brightness: number;
  contrast: number;
  exposure: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  saturation: number;
  vibrance: number;
  temperature: number;
  tint: number;
  sharpness: number;
}

export type CurveChannel = 'rgb' | 'r' | 'g' | 'b';
export interface CurvesParams {
  /** Control points per channel in 0…1, x strictly increasing, 2–16 points. */
  points: Record<CurveChannel, Point2D[]>;
}

export type MixerBand =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'aqua'
  | 'blue'
  | 'purple'
  | 'magenta';
export interface HSL {
  hue: number; // −100…100
  sat: number; // −100…100
  lum: number; // −100…100
}
export interface ColorMixerParams {
  bands: Record<MixerBand, HSL>;
}

export interface ToneWheel {
  hue: number; // 0…360
  sat: number; // 0…100
}
export interface ColorGradeParams {
  shadows: ToneWheel;
  midtones: ToneWheel;
  highlights: ToneWheel;
  blending: number; // 0…100
  balance: number; // −100…100
}

export interface WhiteBalanceParams {
  temp: number; // −100…100
  tint: number; // −100…100
  /** Optional picked neutral reference in image space; overrides temp/tint when set. */
  neutralRef: Point2D | null;
}

export type AspectRatioId = 'free' | '1:1' | '4:5' | '9:16' | '16:9' | '4:3' | '3:2';
export interface CropParams {
  /** Normalized crop rect in 0…1 image space. */
  rect: { x: number; y: number; w: number; h: number };
  angle: number; // straighten −45…45°
  rotate90: number; // 0–3 quarter turns
  /** Perspective quad corners (normalized), or null for none. */
  quad: [Point2D, Point2D, Point2D, Point2D] | null;
  ratio: AspectRatioId;
}

export interface FilterParams {
  filterId: string; // must exist in the filter index
  intensity: number; // 0…1
}

export interface FinishingParams {
  vignette: number; // −100…100
  grain: number; // 0…100
  clarity: number; // −100…100
  dehaze: number; // −100…100
  fade: number; // 0…100
  bloom: number; // 0…100
}

/* Phase 2/3 param shapes (declared now; used when those stories land). */
export interface FaceReshapeParams {
  faceIndex: number;
  jaw: number;
  chin: number;
  cheekWidth: number;
  foreheadWidth: number;
  noseBridge: number;
  noseTip: number;
  lipShape: number;
  lipFullness: number;
  browShape: number;
  browPosition: number;
  eyeSize: number;
  eyeSpacing: number;
}
export interface SkinSmoothParams {
  faceIndex: number;
  strength: number;
  toneLightness: number;
  toneTint: number;
}
export interface TargetedEnhanceParams {
  faceIndex: number;
  teethWhiten: number;
  eyeBrighten: number;
  underEyeReduce: number;
}
export interface BodyReshapeParams {
  waistSlim: number;
  legLengthen: number;
  armSlim: number;
  heightIllusion: number;
}
export interface LiquifyStroke {
  path: Point2D[];
  radius: number;
  strength: number;
  mode: 'push' | 'freeze' | 'reconstruct';
}
export interface LiquifyParams {
  strokes: LiquifyStroke[];
}
export interface BackgroundEffectParams {
  mode: 'blur' | 'replace' | 'grayscale' | 'transparent';
  blurStrength: number;
  color: string;
  edgeRefine: number;
}
export interface RetouchStroke {
  mode: 'clone' | 'heal';
  sourceOffset: Point2D;
  path: Point2D[];
  radius: number;
  hardness: number;
}
export interface RetouchParams {
  strokes: RetouchStroke[];
}

/** Type-level map from operation type → its params shape. */
export interface OperationParams {
  adjust: AdjustParams;
  curves: CurvesParams;
  colorMixer: ColorMixerParams;
  colorGrade: ColorGradeParams;
  whiteBalance: WhiteBalanceParams;
  crop: CropParams;
  filter: FilterParams;
  finishing: FinishingParams;
  faceReshape: FaceReshapeParams;
  skinSmooth: SkinSmoothParams;
  targetedEnhance: TargetedEnhanceParams;
  bodyReshape: BodyReshapeParams;
  liquify: LiquifyParams;
  backgroundEffect: BackgroundEffectParams;
  retouch: RetouchParams;
}

/** A landmark-region or displacement-field reference (Phase 2). */
export interface RegionMaskRef {
  kind: 'landmark-region' | 'displacement-field' | 'segmentation';
  ref: string;
}

export interface Operation<T extends OperationType = OperationType> {
  id: string;
  type: T;
  params: OperationParams[T];
  enabled: boolean;
  mask?: RegionMaskRef;
}

/** A concrete, type-erased operation as stored in the stack. */
export type AnyOperation = {
  [T in OperationType]: Operation<T>;
}[OperationType];

/* ------------------------------------------------------------------ *
 * Layers (overlay content — Phase 3; schema declared now)
 * ------------------------------------------------------------------ */

export type LayerKind =
  | 'makeup'
  | 'text'
  | 'sticker'
  | 'frame'
  | 'blendImage'
  | 'doodle';

export interface LayerTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface LandmarkAnchor {
  featureId: string;
  landmarkIndices: number[];
}

export interface Layer {
  id: string;
  kind: LayerKind;
  transform: LayerTransform;
  opacity: number; // 0…1
  blendMode: BlendMode;
  anchor: LandmarkAnchor | null;
  /** kind-specific content (text/sticker/makeup/doodle payloads). */
  payload: Record<string, unknown>;
  enabled: boolean;
}

/* ------------------------------------------------------------------ *
 * EditState & history
 * ------------------------------------------------------------------ */

export interface EditState {
  schemaVersion: number;
  operations: AnyOperation[];
  layers: Layer[];
}

/** Inverse-patch history entry (never pixels). */
export interface HistoryEntry {
  /** Snapshot of {operations, layers} sufficient to restore this step. */
  operations: AnyOperation[];
  layers: Layer[];
  label: string;
}

export type EditAction =
  | { kind: 'op/add'; op: AnyOperation; coalesceKey?: string }
  | {
      kind: 'op/update';
      id: string;
      params: Partial<OperationParams[OperationType]>;
      coalesceKey?: string;
    }
  | { kind: 'op/toggle'; id: string; enabled: boolean }
  | { kind: 'op/remove'; id: string }
  | { kind: 'layer/add'; layer: Layer }
  | { kind: 'layer/update'; id: string; patch: Partial<Layer> }
  | { kind: 'layer/remove'; id: string }
  | { kind: 'layer/reorder'; id: string; toIndex: number }
  | { kind: 'history/undo' }
  | { kind: 'history/redo' }
  | { kind: 'state/replace'; state: EditState; label?: string }
  | { kind: 'preset/apply'; operations: AnyOperation[] };

export function emptyEditState(): EditState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    operations: [],
    layers: [],
  };
}
