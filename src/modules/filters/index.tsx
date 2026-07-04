'use client';

/**
 * Filters module (US1.5, T046/T048). One-tap filter library; tap the applied
 * filter again to reveal its intensity (0–100%), blended proportionally.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FilterIcon } from '@/ui/icons';
import { Chip } from '@/ui/primitives';
import { ScrubPanel } from '@/ui/ScrubPanel';
import { useEditState } from '@/ui/useEngine';
import { useUnlocks } from '@/ui/gift';
import { applyOpParam, removeOp } from '@/shared/ops';
import { loadFilters, type FilterDef } from '@/shared/filterIndex';
import type { FilterParams } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

function FiltersPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations();
  const state = useEditState(ctx.engine);
  const { has } = useUnlocks();
  const [filters, setFilters] = useState<FilterDef[]>([]);
  const [showIntensity, setShowIntensity] = useState(false);

  useEffect(() => {
    loadFilters().then(setFilters);
  }, []);

  const current = state.operations.find((o) => o.type === 'filter')?.params as
    | FilterParams
    | undefined;
  const currentId = current?.filterId ?? 'none';

  // Secret (gift-unlocked) filters stay hidden until discovered — but a secret
  // look that is already applied stays visible so it can be tuned/removed.
  const visibleFilters = useMemo(
    () => filters.filter((f) => !f.secret || has(f.id) || f.id === currentId),
    [filters, has, currentId],
  );

  const onPick = (id: string) => {
    if (id === 'none') {
      removeOp(ctx.engine, 'filter');
      setShowIntensity(false);
      return;
    }
    if (id === currentId) {
      setShowIntensity(true); // two-tap → reveal intensity
      return;
    }
    applyOpParam(ctx.engine, 'filter', { filterId: id, intensity: 1 });
    setShowIntensity(false);
  };

  const intensityParams = useMemo(
    () => [
      {
        key: 'intensity',
        label: t('tools.filters.intensity'),
        min: 0,
        max: 100,
        value: (current?.intensity ?? 1) * 100,
      },
    ],
    [t, current?.intensity],
  );

  const onIntensity = useCallback(
    (_key: string, value: number, coalesceKey: string) =>
      applyOpParam(ctx.engine, 'filter', { intensity: value / 100 }, coalesceKey),
    [ctx.engine],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {visibleFilters.map((f) => (
          <Chip key={f.id} active={f.id === currentId} onClick={() => onPick(f.id)}>
            {t(f.nameKey)}
          </Chip>
        ))}
      </div>
      {showIntensity && currentId !== 'none' && (
        <ScrubPanel params={intensityParams} onChange={onIntensity} />
      )}
    </div>
  );
}

export const filtersModule: ToolModule = {
  id: 'filters',
  titleKey: 'toolbar.filters',
  phase: 1,
  Icon: FilterIcon,
  Panel: FiltersPanel,
};
