'use client';

/**
 * Background module (US2.7/US2.8, T076/T077). Portrait blur, grayscale, solid
 * color replace, or transparent cut-out — all confined by the segmentation mask
 * with an adjustable edge-refinement level. Transparent output is delivered by
 * the PNG export path (T078). Lazy segmentation; no-subject guarded.
 */
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { BackgroundIcon } from '@/ui/icons';
import { Segmented, Slider } from '@/ui/primitives';
import { VisionNotice } from '@/ui/VisionNotice';
import { useVision } from '@/ui/useVision';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam } from '@/shared/ops';
import { defaultBackgroundEffect } from '@/engine/editState';
import type { BackgroundEffectParams } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

type Mode = BackgroundEffectParams['mode'];

function BackgroundPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.background');
  const { status, retry } = useVision(ctx.engine, ['segmentation']);
  const state = useEditState(ctx.engine);

  const p =
    (state.operations.find((o) => o.type === 'backgroundEffect')?.params as BackgroundEffectParams) ??
    defaultBackgroundEffect();

  const patch = useCallback(
    (patch: Partial<BackgroundEffectParams>, coalesceKey?: string) =>
      applyOpParam(ctx.engine, 'backgroundEffect', patch, coalesceKey),
    [ctx.engine],
  );

  if (status !== 'ready') return <VisionNotice status={status} onRetry={retry} />;
  if (!ctx.landmarks?.segmentation) {
    return <p className="py-2 text-sm text-ink-mute">{t('noSubject')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Segmented<Mode>
        value={p.mode}
        onChange={(mode) => patch({ mode })}
        options={[
          { value: 'blur', label: t('blur') },
          { value: 'grayscale', label: t('grayscale') },
          { value: 'replace', label: t('replace') },
          { value: 'transparent', label: t('transparent') },
        ]}
      />

      {p.mode === 'blur' && (
        <Slider
          label={t('strength')}
          value={p.blurStrength}
          onChange={(v) => patch({ blurStrength: v }, 'bg-blur')}
        />
      )}

      {p.mode === 'replace' && (
        <label className="flex items-center justify-between gap-3 text-sm text-ink-soft">
          <span>{t('color')}</span>
          <input
            type="color"
            value={p.color}
            onChange={(e) => patch({ color: e.target.value })}
            className="h-8 w-12 rounded border border-hairline bg-transparent"
          />
        </label>
      )}

      <Slider
        label={t('edge')}
        value={p.edgeRefine}
        onChange={(v) => patch({ edgeRefine: v }, 'bg-edge')}
      />

      {p.mode === 'transparent' && <p className="text-xs text-ink-faint">{t('transparentHint')}</p>}
    </div>
  );
}

export const backgroundModule: ToolModule = {
  id: 'background',
  titleKey: 'toolbar.background',
  phase: 2,
  Icon: BackgroundIcon,
  requiredVision: ['segmentation'],
  Panel: BackgroundPanel,
};
