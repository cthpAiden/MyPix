'use client';

/**
 * Blend module — double exposure (US3.6, T087). A second image as a Layer,
 * cover-fit over the photo, with selectable blend mode and opacity. The second
 * image is session-only (an object URL — pixels are never persisted); the
 * composite previews and exports through the shared layer compositor.
 */
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { BlendIcon } from '@/ui/icons';
import { Button, Segmented, Slider, Surface } from '@/ui/primitives';
import { useEditState } from '@/ui/useEngine';
import { addLayer, layersOfKind, removeLayer, updateLayer } from '@/shared/layers';
import type { BlendMode, BlendPayload } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const MODES: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'softLight', 'hardLight', 'darken', 'lighten'];

function BlendPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.blend');
  const state = useEditState(ctx.engine);
  const fileRef = useRef<HTMLInputElement>(null);

  const layer = layersOfKind(state, 'blendImage')[0] ?? null;

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    const payload: BlendPayload = { src };
    if (layer) {
      updateLayer(ctx.engine, layer.id, { payload: payload as unknown as Record<string, unknown> });
    } else {
      addLayer(ctx.engine, {
        kind: 'blendImage',
        payload: payload as unknown as Record<string, unknown>,
        opacity: 0.6,
        blendMode: 'screen',
      });
    }
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
      <Button variant="primary" onPointerDown={() => fileRef.current?.click()}>
        {t('choose')}
      </Button>

      {!layer ? (
        <p className="py-2 text-sm text-ink-mute">{t('empty')}</p>
      ) : (
        <Surface level={1} className="flex flex-col gap-3 p-3">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-mute">{t('mode')}</p>
            <div className="flex flex-wrap gap-1">
              <Segmented<BlendMode>
                value={layer.blendMode}
                onChange={(v) => updateLayer(ctx.engine, layer.id, { blendMode: v })}
                options={MODES.slice(0, 4).map((m) => ({ value: m, label: t(`modes.${m}`) }))}
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Segmented<BlendMode>
                value={layer.blendMode}
                onChange={(v) => updateLayer(ctx.engine, layer.id, { blendMode: v })}
                options={MODES.slice(4).map((m) => ({ value: m, label: t(`modes.${m}`) }))}
              />
            </div>
          </div>
          <Slider
            label={t('opacity')}
            value={layer.opacity}
            onChange={(v) => updateLayer(ctx.engine, layer.id, { opacity: v }, `blend-op`)}
          />
          <Button variant="danger" onPointerDown={() => removeLayer(ctx.engine, layer.id)}>
            {t('remove')}
          </Button>
        </Surface>
      )}
    </div>
  );
}

export const blendModule: ToolModule = {
  id: 'blend',
  titleKey: 'toolbar.blend',
  phase: 3,
  Icon: BlendIcon,
  Panel: BlendPanel,
};
