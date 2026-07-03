/**
 * Pipeline builder: maps the EditState operation stack onto an ordered list of
 * GL render passes. Passes run in a fixed pipeline order (not stack order) so
 * the result is deterministic regardless of the order the user added tools:
 *
 *   geometry (crop/rotate/straighten) → adjust → curves → colorMixer →
 *   colorGrade → whiteBalance → filter → finishing → warp → skinSmooth →
 *   targetedEnhance → backgroundEffect
 *
 * The identical list drives both the working-resolution preview and the tiled
 * full-res export (SC-003). Phase 2 stages need the detection set + image
 * dimensions, supplied via the optional RenderContext; without it (or without
 * the required subject) landmark-dependent ops render as a no-op.
 */
import type { AnyOperation, EditState, OperationType } from '@/engine/editState';
import type { RenderPass } from '@/engine/gl/pass';
import type { GLContext, PingPong, RenderTarget, UniformValue } from '@/engine/gl/context';
import { buildAdjustPass } from '@/engine/gl/passes/adjust';
import { buildCurvesPass } from '@/engine/gl/passes/curves';
import { buildColorMixerPass, buildColorGradePass } from '@/engine/gl/passes/color';
import { buildWhiteBalancePass } from '@/engine/gl/passes/whiteBalance';
import { buildFilterPass } from '@/engine/gl/passes/filter';
import { buildFinishingPass } from '@/engine/gl/passes/finishing';
import { buildWarpPass } from '@/engine/gl/passes/warp';
import { buildSkinSmoothPass } from '@/engine/gl/passes/skinSmooth';
import { buildTargetedPass } from '@/engine/gl/passes/targeted';
import { buildBackgroundPass } from '@/engine/gl/passes/bgBlur';
import type { RenderContext } from './renderContext';
import type {
  SkinSmoothParams,
  TargetedEnhanceParams,
  BackgroundEffectParams,
} from '@/engine/editState';
import type { FaceLandmarks } from '@/vision/types';

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

function faceFor(ctx: RenderContext, faceIndex: number): FaceLandmarks | null {
  const set = ctx.landmarks;
  if (!set || set.faces.length === 0) return null;
  return set.faces[faceIndex] ?? set.faces[set.selectedFaceIndex] ?? null;
}

/** Build the ordered pass list for the current edit stack. */
export function buildPipeline(state: EditState, ctx?: RenderContext): RenderPass[] {
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

  if (!ctx) return passes;

  // Phase 2 stages (landmark/segmentation dependent).
  const warp = buildWarpPass(state, ctx);
  if (warp) passes.push(warp);

  const skinOp = findEnabled(state.operations, 'skinSmooth');
  if (skinOp) {
    const p = skinOp.params as SkinSmoothParams;
    const face = faceFor(ctx, p.faceIndex);
    if (face) passes.push(buildSkinSmoothPass(face, p, ctx.imageWidth, ctx.imageHeight));
  }

  const tgtOp = findEnabled(state.operations, 'targetedEnhance');
  if (tgtOp) {
    const p = tgtOp.params as TargetedEnhanceParams;
    const face = faceFor(ctx, p.faceIndex);
    if (face) passes.push(buildTargetedPass(face, p, ctx.imageWidth, ctx.imageHeight));
  }

  const bgOp = findEnabled(state.operations, 'backgroundEffect');
  if (bgOp && ctx.landmarks?.segmentation) {
    passes.push(buildBackgroundPass(ctx.landmarks.segmentation, bgOp.params as BackgroundEffectParams));
  }

  return passes;
}

/**
 * Run an ordered pass list over `srcTex` through a ping-pong, handling auxiliary
 * data textures and custom multi-pass executors. Returns the texture holding the
 * final result. Shared by the preview orchestrator and the tiled export so the
 * math is identical (SC-003).
 */
export function runPixelPasses(
  gl: GLContext,
  srcTex: WebGLTexture,
  passes: RenderPass[],
  ping: PingPong,
  texel: [number, number],
): WebGLTexture {
  if (passes.length === 0) return srcTex;
  let current = srcTex;
  for (const pass of passes) {
    const target: RenderTarget = ping.dst;
    if (pass.execute) {
      current = pass.execute(gl, current, target, texel);
    } else {
      const auxTex: WebGLTexture[] = [];
      const auxUniforms: Record<string, UniformValue> = {};
      if (pass.textures) {
        for (const tx of pass.textures) {
          const t = gl.createDataTexture(tx.data, tx.width, tx.height);
          auxTex.push(t);
          auxUniforms[tx.name] = { t: 'tex', v: t, unit: tx.unit };
        }
      }
      gl.draw(
        pass.fragment,
        {
          u_src: { t: 'tex', v: current, unit: 0 },
          u_texel: { t: '2f', v: texel },
          ...pass.uniforms(target),
          ...auxUniforms,
        },
        target,
      );
      for (const t of auxTex) gl.deleteTexture(t);
      current = target.tex;
    }
    ping.swap();
  }
  return current;
}
