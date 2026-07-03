/**
 * Pipeline builder: maps the EditState operation stack onto an ordered list of
 * GL render passes. Passes run in a fixed pipeline order (not stack order) so
 * the result is deterministic regardless of the order the user added tools:
 *
 *   geometry (crop/rotate/straighten) → adjust → curves → colorMixer →
 *   colorGrade → whiteBalance → filter → finishing → (Phase 2 warp/skin/…)
 *
 * Each story registers its stage's pass builder here. The identical list drives
 * both the working-resolution preview and the tiled full-res export (SC-003).
 */
import type { AnyOperation, EditState, OperationType } from '@/engine/editState';
import type { RenderPass } from '@/engine/gl/pass';
import { buildAdjustPass } from '@/engine/gl/passes/adjust';
import { buildCurvesPass } from '@/engine/gl/passes/curves';
import { buildColorMixerPass, buildColorGradePass } from '@/engine/gl/passes/color';
import { buildWhiteBalancePass } from '@/engine/gl/passes/whiteBalance';
import { buildFilterPass } from '@/engine/gl/passes/filter';
import { buildFinishingPass } from '@/engine/gl/passes/finishing';

/** Fixed pixel-pipeline order by op type (geometry handled separately upstream). */
const PIXEL_STAGE_ORDER: OperationType[] = [
  'adjust',
  'curves',
  'colorMixer',
  'colorGrade',
  'whiteBalance',
  'filter',
  'finishing',
];

function findEnabled(ops: AnyOperation[], type: OperationType): AnyOperation | undefined {
  return ops.find((o) => o.type === type && o.enabled);
}

/** Build the ordered pass list for the current edit stack. */
export function buildPipeline(state: EditState): RenderPass[] {
  const passes: RenderPass[] = [];
  for (const type of PIXEL_STAGE_ORDER) {
    const op = findEnabled(state.operations, type);
    if (!op) continue;
    switch (op.type) {
      case 'adjust':
        passes.push(buildAdjustPass(op.params));
        break;
      case 'curves':
        passes.push(buildCurvesPass(op.params));
        break;
      case 'colorMixer':
        passes.push(buildColorMixerPass(op.params));
        break;
      case 'colorGrade':
        passes.push(buildColorGradePass(op.params));
        break;
      case 'whiteBalance':
        passes.push(buildWhiteBalancePass(op.params));
        break;
      case 'filter':
        passes.push(buildFilterPass(op.params));
        break;
      case 'finishing':
        passes.push(buildFinishingPass(op.params));
        break;
      default:
        break;
    }
  }
  return passes;
}
