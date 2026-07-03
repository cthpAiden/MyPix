'use client';

/**
 * Body reshape module (US2.5, T072). Pose-driven waist / leg / arm / height
 * controls (each −1…1) whose displacement protects the background via the anchor
 * ring. Lazy pose detection; with no usable pose it suggests the manual warp
 * fallback rather than applying blindly.
 */
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { BodyIcon } from '@/ui/icons';
import { ScrubPanel } from '@/ui/ScrubPanel';
import { VisionNotice } from '@/ui/VisionNotice';
import { useVision } from '@/ui/useVision';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam } from '@/shared/ops';
import { defaultBodyReshape } from '@/engine/editState';
import type { BodyReshapeParams } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const KEYS: (keyof BodyReshapeParams)[] = ['waistSlim', 'legLengthen', 'armSlim', 'heightIllusion'];

function BodyPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.body');
  const { status, retry } = useVision(ctx.engine, ['pose']);
  const state = useEditState(ctx.engine);

  const p =
    (state.operations.find((o) => o.type === 'bodyReshape')?.params as BodyReshapeParams) ??
    defaultBodyReshape();

  const params = useMemo(
    () => KEYS.map((k) => ({ key: k, label: t(k), min: -100, max: 100, value: p[k] * 100 })),
    [t, p],
  );

  const onChange = useCallback(
    (key: string, value: number, coalesceKey: string) =>
      applyOpParam(
        ctx.engine,
        'bodyReshape',
        { [key]: value / 100 } as Partial<BodyReshapeParams>,
        coalesceKey,
      ),
    [ctx.engine],
  );

  const onReset = useCallback(
    (key: string) =>
      applyOpParam(ctx.engine, 'bodyReshape', { [key]: 0 } as Partial<BodyReshapeParams>),
    [ctx.engine],
  );

  if (status !== 'ready') return <VisionNotice status={status} onRetry={retry} />;
  if (!ctx.landmarks || !ctx.landmarks.pose) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <p className="text-sm text-ink-mute">{t('noBody')}</p>
        <p className="text-xs text-ink-faint">{t('manualHint')}</p>
      </div>
    );
  }

  return <ScrubPanel params={params} onChange={onChange} onReset={onReset} />;
}

export const bodyModule: ToolModule = {
  id: 'body',
  titleKey: 'toolbar.body',
  phase: 2,
  Icon: BodyIcon,
  requiredVision: ['pose'],
  Panel: BodyPanel,
};
