/**
 * Export orchestration (US1.1). Applies the chosen social aspect-ratio preset
 * to the full-resolution render (FR-113), encodes PNG/JPEG, and delivers via
 * share or download.
 *
 * Invariant: output pixel dimensions === original (or exact preset crop) — no
 * downscaling, ever (FR-116, SC-001).
 */
import { renderFullResolution } from './tiler';
import { encodeJpeg, encodePng } from './encode';
import { deliver } from './deliver';
import { croppedOutputSize } from '@/engine/render/geometry';
import { centeredRectForRatio, ratioFor } from '@/shared/aspectRatios';
import { defaultCrop } from '@/engine/editState';
import type { CropParams, EditState } from '@/engine/editState';
import type { ExportJob, ExportResult, OriginalImage } from '@/engine/types';

function exportCropFor(original: OriginalImage, editState: EditState, job: ExportJob): CropParams | null {
  if (job.ratio === 'free') return null;
  const ratio = ratioFor(job.ratio);
  if (ratio == null) return null;

  const editCrop =
    (editState.operations.find((o) => o.type === 'crop' && o.enabled)?.params as CropParams) ??
    defaultCrop();
  const outer = croppedOutputSize(original.width, original.height, editCrop);
  const sub = centeredRectForRatio(outer.width, outer.height, ratio);

  return {
    ...editCrop,
    ratio: job.ratio,
    rect: {
      x: editCrop.rect.x + sub.x * editCrop.rect.w,
      y: editCrop.rect.y + sub.y * editCrop.rect.h,
      w: sub.w * editCrop.rect.w,
      h: sub.h * editCrop.rect.h,
    },
  };
}

export async function runExport(
  original: OriginalImage,
  editState: EditState,
  job: ExportJob,
): Promise<ExportResult> {
  const exportCrop = exportCropFor(original, editState, job);
  const { rgba, width, height } = await renderFullResolution(
    original,
    editState,
    exportCrop,
    job.onProgress,
  );

  const baseName = original.fileName.replace(/\.[^.]+$/, '') || 'mypix';
  const ext = job.format === 'png' ? 'png' : 'jpg';
  const fileName = `${baseName}-mypix.${ext}`;

  const blob =
    job.format === 'png'
      ? await encodePng(rgba, width, height)
      : await encodeJpeg(rgba, width, height, job.jpegQuality);

  const delivered = await deliver(blob, fileName, job.delivery);
  return { blob, width, height, fileName, delivered };
}
