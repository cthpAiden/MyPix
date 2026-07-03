/**
 * cropStateHash (T042): a stable hash of the geometry-changing crop op, so the
 * Phase 2 DetectedLandmarkSet cache can invalidate when crop/rotate/perspective
 * change (contracts/vision.md), while adjustments/filters leave it untouched.
 */
import type { CropParams, EditState } from './types';

export function cropStateHash(state: EditState): string {
  const op = state.operations.find((o) => o.type === 'crop' && o.enabled);
  if (!op) return 'identity';
  const c = op.params as CropParams;
  const q = c.quad ? c.quad.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join('|') : '0';
  return [
    c.rect.x.toFixed(4),
    c.rect.y.toFixed(4),
    c.rect.w.toFixed(4),
    c.rect.h.toFixed(4),
    c.angle.toFixed(3),
    c.rotate90,
    q,
  ].join(':');
}
