/**
 * Filter pass (US1.5, T046). A filter is the adjust shader driven by a named
 * preset of adjust params scaled by intensity 0…1, so it blends proportionally
 * and composes with everything else in the pipeline.
 */
import { ADJUST_FRAGMENT, adjustUniforms } from './adjust';
import { PASSTHROUGH, type RenderPass } from '@/engine/gl/pass';
import { defaultAdjust } from '@/engine/editState';
import { getFilterSync } from '@/shared/filterIndex';
import type { FilterParams, AdjustParams } from '@/engine/editState';

export function buildFilterPass(params: FilterParams): RenderPass {
  const def = getFilterSync(params.filterId);
  if (!def || params.filterId === 'none' || params.intensity <= 0) {
    return { name: 'filter:none', fragment: PASSTHROUGH, uniforms: () => ({}) };
  }
  // Scale the preset's adjust params by intensity; leave sharpness at 0.
  const scaled: AdjustParams = { ...defaultAdjust() };
  for (const [k, v] of Object.entries(def.adjust)) {
    if (typeof v === 'number') {
      (scaled as unknown as Record<string, number>)[k] = v * params.intensity;
    }
  }
  return {
    name: `filter:${def.id}`,
    fragment: ADJUST_FRAGMENT,
    uniforms: () => adjustUniforms(scaled),
  };
}
