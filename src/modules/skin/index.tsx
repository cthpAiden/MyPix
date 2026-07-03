'use client';

/**
 * Skin retouch module (US2.2, T068). Texture-preserving frequency-separation
 * smoothing plus natural tone lightness/tint, confined to the skin mask by the
 * GL pass. Strength 0…1; tone −1…1. Lazy face detection; no-face guarded.
 */
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { SkinIcon } from '@/ui/icons';
import { ScrubPanel } from '@/ui/ScrubPanel';
import { VisionNotice } from '@/ui/VisionNotice';
import { useVision } from '@/ui/useVision';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam } from '@/shared/ops';
import { defaultSkinSmooth } from '@/engine/editState';
import type { SkinSmoothParams } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

function SkinPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.skin');
  const { status, retry } = useVision(ctx.engine, ['face']);
  const state = useEditState(ctx.engine);
  const sel = ctx.landmarks?.selectedFaceIndex ?? 0;

  const p =
    (state.operations.find((o) => o.type === 'skinSmooth')?.params as SkinSmoothParams) ??
    defaultSkinSmooth(sel);

  const params = useMemo(
    () => [
      { key: 'strength', label: t('smooth'), min: 0, max: 100, value: p.strength * 100 },
      { key: 'toneLightness', label: t('tone'), min: -100, max: 100, value: p.toneLightness * 100 },
      { key: 'toneTint', label: t('warmth'), min: -100, max: 100, value: p.toneTint * 100 },
    ],
    [t, p],
  );

  const onChange = useCallback(
    (key: string, value: number, coalesceKey: string) =>
      applyOpParam(
        ctx.engine,
        'skinSmooth',
        { [key]: value / 100, faceIndex: sel } as Partial<SkinSmoothParams>,
        coalesceKey,
      ),
    [ctx.engine, sel],
  );

  const onReset = useCallback(
    (key: string) =>
      applyOpParam(ctx.engine, 'skinSmooth', {
        [key]: 0,
        faceIndex: sel,
      } as Partial<SkinSmoothParams>),
    [ctx.engine, sel],
  );

  if (status !== 'ready') return <VisionNotice status={status} onRetry={retry} />;
  if (!ctx.landmarks || ctx.landmarks.faces.length === 0) {
    return <p className="py-2 text-sm text-ink-mute">{t('noFace')}</p>;
  }

  return <ScrubPanel params={params} onChange={onChange} onReset={onReset} />;
}

export const skinModule: ToolModule = {
  id: 'skin',
  titleKey: 'toolbar.skin',
  phase: 2,
  Icon: SkinIcon,
  requiredVision: ['face'],
  Panel: SkinPanel,
};
