'use client';

/** Finishing module (US1.5, T047): vignette, grain, clarity, dehaze, fade, bloom. */
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { FinishingIcon } from '@/ui/icons';
import { ScrubPanel } from '@/ui/ScrubPanel';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam } from '@/shared/ops';
import { defaultFinishing } from '@/engine/editState';
import type { FinishingParams } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const RANGES: Record<keyof FinishingParams, [number, number]> = {
  vignette: [-100, 100],
  grain: [0, 100],
  clarity: [-100, 100],
  dehaze: [-100, 100],
  fade: [0, 100],
  bloom: [0, 100],
};
const KEYS = Object.keys(RANGES) as (keyof FinishingParams)[];

function FinishingPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.finishing');
  const state = useEditState(ctx.engine);
  const p =
    (state.operations.find((o) => o.type === 'finishing')?.params as FinishingParams) ??
    defaultFinishing();

  const params = useMemo(
    () =>
      KEYS.map((k) => ({
        key: k,
        label: t(k),
        min: RANGES[k][0],
        max: RANGES[k][1],
        value: p[k],
      })),
    [t, p],
  );

  const onChange = useCallback(
    (key: string, value: number, coalesceKey: string) =>
      applyOpParam(ctx.engine, 'finishing', { [key]: value } as Partial<FinishingParams>, coalesceKey),
    [ctx.engine],
  );
  const onReset = useCallback(
    (key: string) => applyOpParam(ctx.engine, 'finishing', { [key]: 0 } as Partial<FinishingParams>),
    [ctx.engine],
  );

  return <ScrubPanel params={params} onChange={onChange} onReset={onReset} />;
}

export const finishingModule: ToolModule = {
  id: 'finishing',
  titleKey: 'toolbar.finishing',
  phase: 1,
  Icon: FinishingIcon,
  Panel: FinishingPanel,
};
