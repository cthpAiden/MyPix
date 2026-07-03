/**
 * Operation registry: per-param numeric ranges (for reducer clamping) and
 * default-param factories (for modules that add an op). All numeric params
 * clamp to these ranges inside the reducer — invalid input can never enter
 * the stack (contracts/edit-state.md).
 */
import { clamp } from '@/shared/math';
import type {
  AdjustParams,
  BackgroundEffectParams,
  BodyReshapeParams,
  ColorGradeParams,
  ColorMixerParams,
  CropParams,
  CurvesParams,
  FaceReshapeParams,
  FinishingParams,
  FilterParams,
  HSL,
  LiquifyParams,
  MixerBand,
  OperationParams,
  OperationType,
  Point2D,
  RetouchParams,
  SkinSmoothParams,
  TargetedEnhanceParams,
  ToneWheel,
  WhiteBalanceParams,
} from './types';

type Range = readonly [min: number, max: number];

const A11: Range = [-100, 100];
const ZERO_100: Range = [0, 100];

/** Flat numeric ranges keyed by `${type}.${dottedParamPath}`. */
export const PARAM_RANGES: Record<string, Range> = {
  // adjust — all 12 params −100…100
  'adjust.brightness': A11,
  'adjust.contrast': A11,
  'adjust.exposure': A11,
  'adjust.highlights': A11,
  'adjust.shadows': A11,
  'adjust.whites': A11,
  'adjust.blacks': A11,
  'adjust.saturation': A11,
  'adjust.vibrance': A11,
  'adjust.temperature': A11,
  'adjust.tint': A11,
  'adjust.sharpness': A11,
  // whiteBalance
  'whiteBalance.temp': A11,
  'whiteBalance.tint': A11,
  // colorGrade
  'colorGrade.blending': ZERO_100,
  'colorGrade.balance': A11,
  // filter
  'filter.intensity': [0, 1],
  // finishing
  'finishing.vignette': A11,
  'finishing.grain': ZERO_100,
  'finishing.clarity': A11,
  'finishing.dehaze': A11,
  'finishing.fade': ZERO_100,
  'finishing.bloom': ZERO_100,
  // crop
  'crop.angle': [-45, 45],
  'crop.rotate90': [0, 3],
  // faceReshape — every per-feature control −1…1 (faceIndex excluded on purpose)
  'faceReshape.jaw': [-1, 1],
  'faceReshape.chin': [-1, 1],
  'faceReshape.cheekWidth': [-1, 1],
  'faceReshape.foreheadWidth': [-1, 1],
  'faceReshape.noseBridge': [-1, 1],
  'faceReshape.noseTip': [-1, 1],
  'faceReshape.lipShape': [-1, 1],
  'faceReshape.lipFullness': [-1, 1],
  'faceReshape.browShape': [-1, 1],
  'faceReshape.browPosition': [-1, 1],
  'faceReshape.eyeSize': [-1, 1],
  'faceReshape.eyeSpacing': [-1, 1],
  // skinSmooth
  'skinSmooth.strength': [0, 1],
  'skinSmooth.toneLightness': [-1, 1],
  'skinSmooth.toneTint': [-1, 1],
  // targetedEnhance
  'targetedEnhance.teethWhiten': [0, 1],
  'targetedEnhance.eyeBrighten': [0, 1],
  'targetedEnhance.underEyeReduce': [0, 1],
  // bodyReshape
  'bodyReshape.waistSlim': [-1, 1],
  'bodyReshape.legLengthen': [-1, 1],
  'bodyReshape.armSlim': [-1, 1],
  'bodyReshape.heightIllusion': [-1, 1],
  // backgroundEffect
  'backgroundEffect.blurStrength': [0, 1],
  'backgroundEffect.edgeRefine': [0, 1],
};

/**
 * Portable op types travel in presets/recipes; photo-specific ops (crop,
 * reshape, retouch, background) do not (data-model.md Preset).
 */
export const PORTABLE_OP_TYPES: ReadonlySet<OperationType> = new Set<OperationType>([
  'adjust',
  'curves',
  'colorMixer',
  'colorGrade',
  'whiteBalance',
  'filter',
  'finishing',
]);

export function isPortableOp(type: OperationType): boolean {
  return PORTABLE_OP_TYPES.has(type);
}

const MIXER_BANDS: MixerBand[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'aqua',
  'blue',
  'purple',
  'magenta',
];

/* ---------------------------- default factories ---------------------------- */

export function defaultAdjust(): AdjustParams {
  return {
    brightness: 0,
    contrast: 0,
    exposure: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    saturation: 0,
    vibrance: 0,
    temperature: 0,
    tint: 0,
    sharpness: 0,
  };
}

export function defaultCurves(): CurvesParams {
  const linear: Point2D[] = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];
  return {
    points: {
      rgb: linear.map((p) => ({ ...p })),
      r: linear.map((p) => ({ ...p })),
      g: linear.map((p) => ({ ...p })),
      b: linear.map((p) => ({ ...p })),
    },
  };
}

export function defaultColorMixer(): ColorMixerParams {
  const bands = {} as Record<MixerBand, HSL>;
  for (const b of MIXER_BANDS) bands[b] = { hue: 0, sat: 0, lum: 0 };
  return { bands };
}

export function defaultColorGrade(): ColorGradeParams {
  const wheel = (): ToneWheel => ({ hue: 0, sat: 0 });
  return {
    shadows: wheel(),
    midtones: wheel(),
    highlights: wheel(),
    blending: 50,
    balance: 0,
  };
}

export function defaultWhiteBalance(): WhiteBalanceParams {
  return { temp: 0, tint: 0, neutralRef: null };
}

export function defaultCrop(): CropParams {
  return {
    rect: { x: 0, y: 0, w: 1, h: 1 },
    angle: 0,
    rotate90: 0,
    quad: null,
    ratio: 'free',
  };
}

export function defaultFilter(filterId = 'none'): FilterParams {
  return { filterId, intensity: 1 };
}

export function defaultFinishing(): FinishingParams {
  return { vignette: 0, grain: 0, clarity: 0, dehaze: 0, fade: 0, bloom: 0 };
}

/* --------------------------- Phase 2 defaults ---------------------------- */

export function defaultFaceReshape(faceIndex = 0): FaceReshapeParams {
  return {
    faceIndex,
    jaw: 0,
    chin: 0,
    cheekWidth: 0,
    foreheadWidth: 0,
    noseBridge: 0,
    noseTip: 0,
    lipShape: 0,
    lipFullness: 0,
    browShape: 0,
    browPosition: 0,
    eyeSize: 0,
    eyeSpacing: 0,
  };
}

export function defaultSkinSmooth(faceIndex = 0): SkinSmoothParams {
  return { faceIndex, strength: 0, toneLightness: 0, toneTint: 0 };
}

export function defaultTargetedEnhance(faceIndex = 0): TargetedEnhanceParams {
  return { faceIndex, teethWhiten: 0, eyeBrighten: 0, underEyeReduce: 0 };
}

export function defaultBodyReshape(): BodyReshapeParams {
  return { waistSlim: 0, legLengthen: 0, armSlim: 0, heightIllusion: 0 };
}

export function defaultLiquify(): LiquifyParams {
  return { strokes: [] };
}

export function defaultBackgroundEffect(): BackgroundEffectParams {
  return { mode: 'blur', blurStrength: 0.5, color: '#000000', edgeRefine: 0.5 };
}

export function defaultRetouch(): RetouchParams {
  return { strokes: [] };
}

/** Default params for any op type (Phase 1 fully implemented). */
export function defaultParamsFor<T extends OperationType>(type: T): OperationParams[T] {
  switch (type) {
    case 'adjust':
      return defaultAdjust() as OperationParams[T];
    case 'curves':
      return defaultCurves() as OperationParams[T];
    case 'colorMixer':
      return defaultColorMixer() as OperationParams[T];
    case 'colorGrade':
      return defaultColorGrade() as OperationParams[T];
    case 'whiteBalance':
      return defaultWhiteBalance() as OperationParams[T];
    case 'crop':
      return defaultCrop() as OperationParams[T];
    case 'filter':
      return defaultFilter() as OperationParams[T];
    case 'finishing':
      return defaultFinishing() as OperationParams[T];
    case 'faceReshape':
      return defaultFaceReshape() as OperationParams[T];
    case 'skinSmooth':
      return defaultSkinSmooth() as OperationParams[T];
    case 'targetedEnhance':
      return defaultTargetedEnhance() as OperationParams[T];
    case 'bodyReshape':
      return defaultBodyReshape() as OperationParams[T];
    case 'liquify':
      return defaultLiquify() as OperationParams[T];
    case 'backgroundEffect':
      return defaultBackgroundEffect() as OperationParams[T];
    case 'retouch':
      return defaultRetouch() as OperationParams[T];
    default:
      throw new Error(`defaultParamsFor: no default for op type "${type}"`);
  }
}

/* ------------------------------- clamping -------------------------------- */

function clampFlat(type: string, obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const range = PARAM_RANGES[`${type}.${key}`];
    const val = obj[key];
    if (range && typeof val === 'number') {
      obj[key] = clamp(val, range[0], range[1]);
    }
  }
}

function clampCurvePoints(points: Point2D[]): Point2D[] {
  // 2–16 points, coords in 0…1, x strictly increasing.
  const cleaned = points
    .map((p) => ({ x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) }))
    .sort((a, b) => a.x - b.x);
  const out: Point2D[] = [];
  let lastX = -1;
  for (const p of cleaned) {
    if (p.x > lastX) {
      out.push(p);
      lastX = p.x;
    }
  }
  if (out.length < 2) return [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  return out.slice(0, 16);
}

/**
 * Clamp an operation's params to their documented ranges. Pure — returns a new
 * params object; never mutates its input. Handles nested/structural params.
 */
export function clampParams<T extends OperationType>(
  type: T,
  params: OperationParams[T],
): OperationParams[T] {
  const p = structuredClone(params) as unknown as Record<string, unknown>;

  switch (type) {
    case 'adjust':
    case 'whiteBalance':
    case 'finishing':
    case 'filter':
    case 'faceReshape':
    case 'skinSmooth':
    case 'targetedEnhance':
    case 'bodyReshape':
    case 'backgroundEffect': {
      clampFlat(type, p);
      if (type === 'whiteBalance' && p.neutralRef) {
        const r = p.neutralRef as Point2D;
        p.neutralRef = { x: clamp(r.x, 0, 1), y: clamp(r.y, 0, 1) };
      }
      break;
    }
    case 'curves': {
      const cp = p.points as Record<string, Point2D[]>;
      for (const ch of Object.keys(cp)) cp[ch] = clampCurvePoints(cp[ch]);
      break;
    }
    case 'colorMixer': {
      const bands = p.bands as Record<string, HSL>;
      for (const b of Object.keys(bands)) {
        const hsl = bands[b];
        hsl.hue = clamp(hsl.hue, -100, 100);
        hsl.sat = clamp(hsl.sat, -100, 100);
        hsl.lum = clamp(hsl.lum, -100, 100);
      }
      break;
    }
    case 'colorGrade': {
      clampFlat('colorGrade', p);
      for (const w of ['shadows', 'midtones', 'highlights'] as const) {
        const wheel = p[w] as ToneWheel;
        wheel.hue = clamp(wheel.hue, 0, 360);
        wheel.sat = clamp(wheel.sat, 0, 100);
      }
      break;
    }
    case 'crop': {
      clampFlat('crop', p);
      p.rotate90 = Math.round(clamp(p.rotate90 as number, 0, 3));
      const rect = p.rect as CropParams['rect'];
      rect.x = clamp(rect.x, 0, 1);
      rect.y = clamp(rect.y, 0, 1);
      rect.w = clamp(rect.w, 0.02, 1 - Math.min(rect.x, 0.98));
      rect.h = clamp(rect.h, 0.02, 1 - Math.min(rect.y, 0.98));
      break;
    }
    default:
      break;
  }

  return p as unknown as OperationParams[T];
}
