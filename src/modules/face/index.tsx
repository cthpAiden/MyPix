'use client';

/**
 * Face reshape module (US2.1/US2.4, T063/T070). Per-feature reshape controls
 * (jaw…eyeSpacing, each −1…1) driven through the whole-photo scrub gesture, plus
 * one-tap auto-beautify. Detection is lazy (useVision); with no face detected it
 * suggests the manual push/pull warp tool instead of applying blindly (FR-203).
 */
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { FaceIcon } from '@/ui/icons';
import { Button } from '@/ui/primitives';
import { ScrubPanel } from '@/ui/ScrubPanel';
import { VisionNotice } from '@/ui/VisionNotice';
import { useVision } from '@/ui/useVision';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam } from '@/shared/ops';
import { defaultFaceReshape } from '@/engine/editState';
import { FaceSelect } from './FaceSelect';
import { applyAutoBeautify } from './autoBeautify';
import type { FaceReshapeParams } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const FEATURES: (keyof FaceReshapeParams)[] = [
  'jaw',
  'chin',
  'cheekWidth',
  'foreheadWidth',
  'noseBridge',
  'noseTip',
  'lipShape',
  'lipFullness',
  'browShape',
  'browPosition',
  'eyeSize',
  'eyeSpacing',
];

function FacePanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.face');
  const { status, retry } = useVision(ctx.engine, ['face']);
  const state = useEditState(ctx.engine);
  const landmarks = ctx.landmarks;
  const sel = landmarks?.selectedFaceIndex ?? 0;

  const p =
    (state.operations.find((o) => o.type === 'faceReshape')?.params as FaceReshapeParams) ??
    defaultFaceReshape(sel);

  const params = useMemo(
    () => FEATURES.map((k) => ({ key: k, label: t(k), min: -100, max: 100, value: p[k] * 100 })),
    [t, p],
  );

  const onChange = useCallback(
    (key: string, value: number, coalesceKey: string) =>
      applyOpParam(
        ctx.engine,
        'faceReshape',
        { [key]: value / 100, faceIndex: sel } as Partial<FaceReshapeParams>,
        coalesceKey,
      ),
    [ctx.engine, sel],
  );

  const onReset = useCallback(
    (key: string) =>
      applyOpParam(ctx.engine, 'faceReshape', {
        [key]: 0,
        faceIndex: sel,
      } as Partial<FaceReshapeParams>),
    [ctx.engine, sel],
  );

  if (status !== 'ready') return <VisionNotice status={status} onRetry={retry} />;

  if (!landmarks || landmarks.faces.length === 0) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <p className="text-sm text-ink-mute">{t('noFace')}</p>
        <p className="text-xs text-ink-faint">{t('manualHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FaceSelect engine={ctx.engine} landmarks={landmarks} />
      <Button variant="primary" onPointerDown={() => applyAutoBeautify(ctx.engine, sel)}>
        {t('autoBeautify')}
      </Button>
      <ScrubPanel params={params} onChange={onChange} onReset={onReset} hint={t('hint')} />
    </div>
  );
}

export const faceModule: ToolModule = {
  id: 'face',
  titleKey: 'toolbar.face',
  phase: 2,
  Icon: FaceIcon,
  requiredVision: ['face'],
  Panel: FacePanel,
};
