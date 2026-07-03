/**
 * One-tap auto-beautify (US2.4, T070, FR-207).
 *
 * Inserts its component ops — skin smoothing + targeted enhancements + a subtle
 * face reshape — at tasteful default strengths, each as its own operation so it
 * stays individually adjustable and undoable in its own tool. Grouped under one
 * coalesce key so it is a single undo step. Guarded by the caller against the
 * no-face case.
 */
import { applyOpParam } from '@/shared/ops';
import type { Engine } from '@/engine';
import type { FaceReshapeParams, SkinSmoothParams, TargetedEnhanceParams } from '@/engine/editState';

const KEY = 'autoBeautify';

export function applyAutoBeautify(engine: Engine, faceIndex: number): void {
  applyOpParam<'skinSmooth'>(
    engine,
    'skinSmooth',
    { faceIndex, strength: 0.5, toneLightness: 0.05 } as Partial<SkinSmoothParams>,
    KEY,
  );
  applyOpParam<'targetedEnhance'>(
    engine,
    'targetedEnhance',
    { faceIndex, teethWhiten: 0.4, eyeBrighten: 0.3, underEyeReduce: 0.4 } as Partial<TargetedEnhanceParams>,
    KEY,
  );
  applyOpParam<'faceReshape'>(
    engine,
    'faceReshape',
    { faceIndex, eyeSize: 0.12, chin: -0.04, jaw: -0.08, lipFullness: 0.08 } as Partial<FaceReshapeParams>,
    KEY,
  );
  engine.endGesture();
}
