'use client';

/**
 * Targeted enhancements module (US2.3, T069). Teeth whitening, eye brightening,
 * and under-eye reduction — each confined to its landmark region by the GL pass.
 * Strengths 0…1, presented 0…100. Lazy face detection; no-face guarded.
 */
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { SparkleIcon } from '@/ui/icons';
import { ScrubPanel } from '@/ui/ScrubPanel';
import { VisionNotice } from '@/ui/VisionNotice';
import { useVision } from '@/ui/useVision';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam } from '@/shared/ops';
import { defaultTargetedEnhance } from '@/engine/editState';
import type { TargetedEnhanceParams } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const KEYS: (keyof TargetedEnhanceParams)[] = ['teethWhiten', 'eyeBrighten', 'underEyeReduce'];

function TargetedPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.targeted');
  const { status, retry } = useVision(ctx.engine, ['face']);
  const state = useEditState(ctx.engine);
  const sel = ctx.landmarks?.selectedFaceIndex ?? 0;

  const p =
    (state.operations.find((o) => o.type === 'targetedEnhance')?.params as TargetedEnhanceParams) ??
    defaultTargetedEnhance(sel);

  const params = useMemo(
    () => KEYS.map((k) => ({ key: k, label: t(k), min: 0, max: 100, value: p[k] * 100 })),
    [t, p],
  );

  const onChange = useCallback(
    (key: string, value: number, coalesceKey: string) =>
      applyOpParam(
        ctx.engine,
        'targetedEnhance',
        { [key]: value / 100, faceIndex: sel } as Partial<TargetedEnhanceParams>,
        coalesceKey,
      ),
    [ctx.engine, sel],
  );

  const onReset = useCallback(
    (key: string) =>
      applyOpParam(ctx.engine, 'targetedEnhance', {
        [key]: 0,
        faceIndex: sel,
      } as Partial<TargetedEnhanceParams>),
    [ctx.engine, sel],
  );

  if (status !== 'ready') return <VisionNotice status={status} onRetry={retry} />;
  if (!ctx.landmarks || ctx.landmarks.faces.length === 0) {
    return <p className="py-2 text-sm text-ink-mute">{t('noFace')}</p>;
  }

  return <ScrubPanel params={params} onChange={onChange} onReset={onReset} />;
}

export const targetedModule: ToolModule = {
  id: 'targeted',
  titleKey: 'toolbar.targeted',
  phase: 2,
  Icon: SparkleIcon,
  requiredVision: ['face'],
  Panel: TargetedPanel,
};
