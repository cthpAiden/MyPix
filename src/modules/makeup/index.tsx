'use client';

/**
 * Makeup module (US3.1, T080). Landmark-anchored lipstick / blush / eyeshadow /
 * eyeliner / brow. Each is a Layer that stores intent (type/colour/amount/finish)
 * and re-derives its geometry from the face landmarks at render time, so it
 * tracks the face and stays individually adjustable and removable. Needs a face:
 * the module is unavailable (with a bilingual reason) when none is detected.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MakeupIcon } from '@/ui/icons';
import { Button, Segmented, Slider, Surface } from '@/ui/primitives';
import { VisionNotice } from '@/ui/VisionNotice';
import { useVision } from '@/ui/useVision';
import { useEditState } from '@/ui/useEngine';
import { addLayer, layersOfKind, patchPayload, removeLayer, updateLayer } from '@/shared/layers';
import { makeupDefaultBlend } from '@/engine/render/makeupShapes';
import type { MakeupFinish, MakeupPayload, MakeupType } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const TYPES: MakeupType[] = ['lipstick', 'blush', 'eyeshadow', 'liner', 'brow'];
const FINISHES: MakeupFinish[] = ['matte', 'gloss', 'shimmer'];

const DEFAULT_COLOR: Record<MakeupType, string> = {
  lipstick: '#c8465e',
  blush: '#f2889a',
  eyeshadow: '#9b7bd4',
  liner: '#2b2b33',
  brow: '#5a4634',
};

function MakeupPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.makeup');
  const { status, retry } = useVision(ctx.engine, ['face']);
  const state = useEditState(ctx.engine);
  const [selected, setSelected] = useState<string | null>(null);

  const items = layersOfKind(state, 'makeup');
  const selLayer = items.find((l) => l.id === selected) ?? null;

  const add = (type: MakeupType) => {
    const faceIndex = ctx.landmarks?.selectedFaceIndex ?? 0;
    const payload: MakeupPayload = {
      makeupType: type,
      faceIndex,
      color: DEFAULT_COLOR[type],
      intensity: 1,
      finish: 'matte',
    };
    const id = addLayer(ctx.engine, {
      kind: 'makeup',
      payload: payload as unknown as Record<string, unknown>,
      opacity: 0.55,
      blendMode: makeupDefaultBlend(type),
    });
    setSelected(id);
  };

  const pl = selLayer ? (selLayer.payload as unknown as MakeupPayload) : null;

  if (status !== 'ready') return <VisionNotice status={status} onRetry={retry} />;

  if (!ctx.landmarks || ctx.landmarks.faces.length === 0) {
    return <p className="py-3 text-sm text-ink-mute">{t('noFace')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-mute">{t('hint')}</p>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((type) => (
          <Button key={type} onPointerDown={() => add(type)}>
            {t(`types.${type}`)}
          </Button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="py-3 text-sm text-ink-mute">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((l) => {
            const p = l.payload as unknown as MakeupPayload;
            return (
              <Surface
                key={l.id}
                level={2}
                className={`flex items-center gap-2 px-3 py-2 ${
                  selected === l.id ? 'ring-1 ring-safelight' : ''
                }`}
              >
                <button
                  className="min-w-0 flex-1 truncate text-left text-sm text-ink"
                  onPointerDown={() => setSelected(l.id)}
                >
                  <span
                    className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                    style={{ background: p.color }}
                  />
                  {t(`types.${p.makeupType}`)}
                </button>
                <Button variant="danger" onPointerDown={() => removeLayer(ctx.engine, l.id)}>
                  {t('remove')}
                </Button>
              </Surface>
            );
          })}
        </div>
      )}

      {selLayer && pl && (
        <Surface level={1} className="flex flex-col gap-3 p-3">
          <label className="flex items-center justify-between text-sm text-ink-soft">
            {t('color')}
            <input
              type="color"
              value={pl.color}
              onChange={(e) => patchPayload(ctx.engine, selLayer.id, { color: e.target.value })}
              className="h-8 w-12 rounded bg-transparent"
            />
          </label>
          <Slider
            label={t('opacity')}
            value={selLayer.opacity}
            onChange={(v) => updateLayer(ctx.engine, selLayer.id, { opacity: v }, `makeup-${selLayer.id}`)}
          />
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-mute">{t('finish')}</p>
            <Segmented<MakeupFinish>
              value={pl.finish}
              onChange={(v) => patchPayload(ctx.engine, selLayer.id, { finish: v })}
              options={FINISHES.map((f) => ({ value: f, label: t(f) }))}
            />
          </div>
        </Surface>
      )}
    </div>
  );
}

export const makeupModule: ToolModule = {
  id: 'makeup',
  titleKey: 'toolbar.makeup',
  phase: 3,
  Icon: MakeupIcon,
  Panel: MakeupPanel,
  requiredVision: ['face'],
};
