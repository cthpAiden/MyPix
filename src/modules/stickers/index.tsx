'use client';

/**
 * Stickers module (US3.3, T083). Browse a content-droppable library
 * (public/stickers/index.json), place stickers as Layers, then move/scale/
 * rotate/opacity and re-order (z-index). Each placed sticker rasterizes into the
 * full-resolution export via the layer compositor.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StickerIcon } from '@/ui/icons';
import { Button, Slider, Surface } from '@/ui/primitives';
import { useScrubHost, type BrushHandler } from '@/ui/scrub';
import { useEditState } from '@/ui/useEngine';
import { addLayer, layersOfKind, removeLayer, updateLayer } from '@/shared/layers';
import { clamp01 } from '@/shared/math';
import { loadStickers, stickerSrc, type StickerEntry } from './library';
import type { StickerPayload } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const MIN_SCALE = 0.05;
const SCALE_SPAN = 0.7;
const scaleToSlider = (s: number) => clamp01((s - MIN_SCALE) / SCALE_SPAN);
const sliderToScale = (v: number) => MIN_SCALE + v * SCALE_SPAN;

function StickersPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.stickers');
  const { requestBrush, cancelBrush } = useScrubHost();
  const state = useEditState(ctx.engine);
  const [library, setLibrary] = useState<StickerEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    loadStickers().then(setLibrary);
  }, []);

  const items = layersOfKind(state, 'sticker');
  const selLayer = items.find((l) => l.id === selected) ?? null;

  useEffect(() => {
    if (!selected) return;
    const move = (nx: number, ny: number) => {
      const cur = ctx.engine.getState().layers.find((l) => l.id === selected);
      if (!cur) return;
      updateLayer(ctx.engine, selected, { transform: { ...cur.transform, x: nx, y: ny } }, `move-${selected}`);
    };
    const handler: BrushHandler = {
      onStart: move,
      onMove: move,
      onEnd: () => ctx.engine.endGesture(),
    };
    requestBrush(handler);
    return () => cancelBrush();
  }, [ctx.engine, requestBrush, cancelBrush, selected]);

  const place = (entry: StickerEntry) => {
    const payload: StickerPayload = {
      assetId: entry.id,
      src: stickerSrc(entry),
      aspect: entry.aspect ?? 1,
    };
    const id = addLayer(ctx.engine, {
      kind: 'sticker',
      payload: payload as unknown as Record<string, unknown>,
      transform: { x: 0.5, y: 0.5, scaleX: 0.3, scaleY: 0.3 },
    });
    setSelected(id);
  };

  return (
    <div className="flex flex-col gap-3">
      {library.length === 0 ? (
        <p className="py-2 text-sm text-ink-mute">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {library.map((s) => (
            <button
              key={s.id}
              onPointerDown={() => place(s)}
              className="aspect-square rounded-[var(--radius-control)] bg-surface-2 p-1.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stickerSrc(s)} alt={s.id} className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((l) => {
            const lp = l.payload as unknown as StickerPayload;
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
                  {lp.assetId}
                </button>
                <Button variant="danger" onPointerDown={() => removeLayer(ctx.engine, l.id)}>
                  {t('remove')}
                </Button>
              </Surface>
            );
          })}
        </div>
      )}

      {selLayer && (
        <Surface level={1} className="flex flex-col gap-3 p-3">
          <p className="text-xs text-ink-mute">{t('hint')}</p>
          <Slider
            label={t('size')}
            value={scaleToSlider(selLayer.transform.scaleX)}
            onChange={(v) =>
              updateLayer(
                ctx.engine,
                selLayer.id,
                { transform: { ...selLayer.transform, scaleX: sliderToScale(v), scaleY: sliderToScale(v) } },
                `sticker-size-${selLayer.id}`,
              )
            }
          />
          <Slider
            label={t('rotation')}
            value={clamp01((selLayer.transform.rotation + Math.PI) / (2 * Math.PI))}
            onChange={(v) =>
              updateLayer(
                ctx.engine,
                selLayer.id,
                { transform: { ...selLayer.transform, rotation: v * 2 * Math.PI - Math.PI } },
                `sticker-rot-${selLayer.id}`,
              )
            }
          />
          <Slider
            label={t('opacity')}
            value={selLayer.opacity}
            onChange={(v) => updateLayer(ctx.engine, selLayer.id, { opacity: v }, `sticker-op-${selLayer.id}`)}
          />
        </Surface>
      )}
    </div>
  );
}

export const stickersModule: ToolModule = {
  id: 'stickers',
  titleKey: 'toolbar.stickers',
  phase: 3,
  Icon: StickerIcon,
  Panel: StickersPanel,
};
