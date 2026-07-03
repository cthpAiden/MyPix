'use client';

/**
 * Light & Color module (US1.2, T039). Wires the 12 global params through the
 * whole-photo scrub gesture → `adjust` op dispatch, with per-control reset.
 */
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AdjustIcon } from '@/ui/icons';
import { ScrubPanel } from '@/ui/ScrubPanel';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam } from '@/shared/ops';
import { defaultAdjust } from '@/engine/editState';
import type { AdjustParams } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const KEYS: (keyof AdjustParams)[] = [
  'brightness',
  'contrast',
  'exposure',
  'highlights',
  'shadows',
  'whites',
  'blacks',
  'saturation',
  'vibrance',
  'temperature',
  'tint',
  'sharpness',
];

function AdjustPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.adjust');
  const state = useEditState(ctx.engine);
  const p = (state.operations.find((o) => o.type === 'adjust')?.params as AdjustParams) ?? defaultAdjust();

  const params = useMemo(
    () => KEYS.map((k) => ({ key: k, label: t(k), min: -100, max: 100, value: p[k] })),
    [t, p],
  );

  const onChange = useCallback(
    (key: string, value: number, coalesceKey: string) =>
      applyOpParam(ctx.engine, 'adjust', { [key]: value } as Partial<AdjustParams>, coalesceKey),
    [ctx.engine],
  );

  const onReset = useCallback(
    (key: string) => applyOpParam(ctx.engine, 'adjust', { [key]: 0 } as Partial<AdjustParams>),
    [ctx.engine],
  );

  return <ScrubPanel params={params} onChange={onChange} onReset={onReset} hint={t('resetOne')} />;
}

export const adjustModule: ToolModule = {
  id: 'adjust',
  titleKey: 'toolbar.adjust',
  phase: 1,
  Icon: AdjustIcon,
  Panel: AdjustPanel,
};
