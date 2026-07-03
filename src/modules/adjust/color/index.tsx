'use client';

/**
 * Color module (US1.4, T044): 8-band HSL mixer + color grading / split-tone.
 * Each band/zone is isolated — bend one without touching the others.
 */
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ColorIcon } from '@/ui/icons';
import { ScrubPanel } from '@/ui/ScrubPanel';
import { Chip, Segmented } from '@/ui/primitives';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam, getParams } from '@/shared/ops';
import type { ColorGradeParams, ColorMixerParams, MixerBand, ToneWheel } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const BANDS: MixerBand[] = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
type Zone = 'shadows' | 'midtones' | 'highlights';
const ZONES: Zone[] = ['shadows', 'midtones', 'highlights'];

function MixerPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.color');
  const state = useEditState(ctx.engine);
  const [band, setBand] = useState<MixerBand>('red');
  const cur = (state.operations.find((o) => o.type === 'colorMixer')?.params as ColorMixerParams) ??
    getParams(ctx.engine, 'colorMixer');
  const hsl = cur.bands[band];

  const params = useMemo(
    () => [
      { key: 'hue', label: t('hue'), min: -100, max: 100, value: hsl.hue },
      { key: 'sat', label: t('sat'), min: -100, max: 100, value: hsl.sat },
      { key: 'lum', label: t('lum'), min: -100, max: 100, value: hsl.lum },
    ],
    [t, hsl.hue, hsl.sat, hsl.lum],
  );

  const onChange = useCallback(
    (key: string, value: number, coalesceKey: string) => {
      const fresh = getParams(ctx.engine, 'colorMixer');
      const bands = { ...fresh.bands, [band]: { ...fresh.bands[band], [key]: value } };
      applyOpParam(ctx.engine, 'colorMixer', { bands }, coalesceKey);
    },
    [ctx.engine, band],
  );
  const onReset = useCallback(
    (key: string) => {
      const fresh = getParams(ctx.engine, 'colorMixer');
      const bands = { ...fresh.bands, [band]: { ...fresh.bands[band], [key]: 0 } };
      applyOpParam(ctx.engine, 'colorMixer', { bands });
    },
    [ctx.engine, band],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {BANDS.map((b) => (
          <Chip key={b} active={b === band} onClick={() => setBand(b)}>
            {t(`bands.${b}`)}
          </Chip>
        ))}
      </div>
      <ScrubPanel params={params} onChange={onChange} onReset={onReset} />
    </div>
  );
}

function GradePanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.color');
  const state = useEditState(ctx.engine);
  const [zone, setZone] = useState<Zone>('shadows');
  const cur = (state.operations.find((o) => o.type === 'colorGrade')?.params as ColorGradeParams) ??
    getParams(ctx.engine, 'colorGrade');
  const wheel: ToneWheel = cur[zone];

  const params = useMemo(
    () => [
      { key: 'hue', label: t('hue'), min: 0, max: 360, value: wheel.hue },
      { key: 'sat', label: t('sat'), min: 0, max: 100, value: wheel.sat },
      { key: 'blending', label: t('blending'), min: 0, max: 100, value: cur.blending },
      { key: 'balance', label: t('balance'), min: -100, max: 100, value: cur.balance },
    ],
    [t, wheel.hue, wheel.sat, cur.blending, cur.balance],
  );

  const onChange = useCallback(
    (key: string, value: number, coalesceKey: string) => {
      const fresh = getParams(ctx.engine, 'colorGrade');
      if (key === 'blending' || key === 'balance') {
        applyOpParam(ctx.engine, 'colorGrade', { [key]: value } as Partial<ColorGradeParams>, coalesceKey);
      } else {
        const w = { ...fresh[zone], [key]: value };
        applyOpParam(ctx.engine, 'colorGrade', { [zone]: w } as Partial<ColorGradeParams>, coalesceKey);
      }
    },
    [ctx.engine, zone],
  );

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        value={zone}
        onChange={setZone}
        options={ZONES.map((z) => ({ value: z, label: t(z) }))}
      />
      <ScrubPanel params={params} onChange={onChange} />
    </div>
  );
}

function ColorPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.color');
  const [tab, setTab] = useState<'mixer' | 'grade'>('mixer');
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mixer', label: t('mixerTitle') },
          { value: 'grade', label: t('gradeTitle') },
        ]}
      />
      {tab === 'mixer' ? <MixerPanel ctx={ctx} /> : <GradePanel ctx={ctx} />}
    </div>
  );
}

export const colorModule: ToolModule = {
  id: 'color',
  titleKey: 'toolbar.color',
  phase: 1,
  Icon: ColorIcon,
  Panel: ColorPanel,
};
