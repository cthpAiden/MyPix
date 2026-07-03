'use client';

/**
 * Crop & Rotate module (US1.3, T041). Preset ratios from the shared set,
 * rotate 90°, straighten, perspective, with rule-of-thirds guides.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CropIcon } from '@/ui/icons';
import { Button, Chip } from '@/ui/primitives';
import { ScrubPanel } from '@/ui/ScrubPanel';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam, getParams, removeOp } from '@/shared/ops';
import { clamp01 } from '@/shared/math';
import { ASPECT_RATIOS, centeredRectForRatio, ratioFor } from '@/shared/aspectRatios';
import type { CropParams, Point2D } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

function computeQuad(v: number, h: number): CropParams['quad'] {
  if (v === 0 && h === 0) return null;
  const vt = (v / 100) * 0.22;
  const hl = (h / 100) * 0.22;
  const q: [Point2D, Point2D, Point2D, Point2D] = [
    { x: clamp01(vt), y: clamp01(hl) },
    { x: clamp01(1 - vt), y: clamp01(-hl) },
    { x: clamp01(1 + vt), y: clamp01(1 + hl) },
    { x: clamp01(-vt), y: clamp01(1 - hl) },
  ];
  return q;
}

function CropPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.crop');
  const state = useEditState(ctx.engine);
  const crop = getParams(ctx.engine, 'crop');
  const [pV, setPV] = useState(0);
  const [pH, setPH] = useState(0);
  const pVRef = useRef(0);
  const pHRef = useRef(0);
  void state;

  const params = useMemo(
    () => [
      { key: 'straighten', label: t('straighten'), min: -45, max: 45, value: crop.angle },
      { key: 'perspectiveV', label: `${t('perspective')} ↕`, min: -100, max: 100, value: pV },
      { key: 'perspectiveH', label: `${t('perspective')} ↔`, min: -100, max: 100, value: pH },
    ],
    [t, crop.angle, pV, pH],
  );

  const onChange = useCallback(
    (key: string, value: number, coalesceKey: string) => {
      if (key === 'straighten') {
        applyOpParam(ctx.engine, 'crop', { angle: value }, coalesceKey);
      } else if (key === 'perspectiveV') {
        pVRef.current = value;
        setPV(value);
        applyOpParam(ctx.engine, 'crop', { quad: computeQuad(value, pHRef.current) }, coalesceKey);
      } else {
        pHRef.current = value;
        setPH(value);
        applyOpParam(ctx.engine, 'crop', { quad: computeQuad(pVRef.current, value) }, coalesceKey);
      }
    },
    [ctx.engine],
  );

  const applyRatio = (id: CropParams['ratio']) => {
    const project = ctx.engine.getProject();
    if (!project) return;
    const rect = centeredRectForRatio(project.original.width, project.original.height, ratioFor(id));
    applyOpParam(ctx.engine, 'crop', { ratio: id, rect });
  };

  const rotate = () => {
    const cur = getParams(ctx.engine, 'crop');
    applyOpParam(ctx.engine, 'crop', { rotate90: ((cur.rotate90 + 1) % 4) as number });
  };

  const reset = () => {
    setPV(0);
    setPH(0);
    pVRef.current = 0;
    pHRef.current = 0;
    removeOp(ctx.engine, 'crop');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {ASPECT_RATIOS.map((r) => (
          <Chip key={r.id} active={crop.ratio === r.id} onClick={() => applyRatio(r.id)}>
            <RatioLabel id={r.id} />
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onPointerDown={rotate}>{t('rotate')}</Button>
        <Button variant="danger" onPointerDown={reset}>
          {t('reset')}
        </Button>
      </div>
      <ScrubPanel params={params} onChange={onChange} />
    </div>
  );
}

function RatioLabel({ id }: { id: CropParams['ratio'] }) {
  const t = useTranslations('aspect');
  return <>{t(id)}</>;
}

export const cropModule: ToolModule = {
  id: 'crop',
  titleKey: 'toolbar.crop',
  phase: 1,
  Icon: CropIcon,
  Panel: CropPanel,
};
