'use client';

/**
 * Text module (US3.2, T081). Vietnamese-capable text overlays as Fabric-style
 * text Layers: content is NFC-normalized on input and the font is restricted to
 * the verified-Vietnamese registry, so stacked tone marks render correctly on
 * canvas and in the full-resolution export (rasterizeLayers). Style: font, size,
 * colour, alignment, outline, shadow; drag on the photo to reposition.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TextIcon } from '@/ui/icons';
import { Button, Chip, Segmented, Slider, Surface } from '@/ui/primitives';
import { useScrubHost, type BrushHandler } from '@/ui/scrub';
import { useEditState } from '@/ui/useEngine';
import { addLayer, patchPayload, removeLayer, updateLayer, layersOfKind } from '@/shared/layers';
import { VIET_FONTS } from './fonts';
import { clamp01 } from '@/shared/math';
import type { TextAlign, TextPayload } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const ALIGNS: TextAlign[] = ['left', 'center', 'right'];
const MIN_REL = 0.02;
const REL_SPAN = 0.23;

function relToSlider(rel: number): number {
  return clamp01((rel - MIN_REL) / REL_SPAN);
}
function sliderToRel(v: number): number {
  return MIN_REL + v * REL_SPAN;
}

function TextPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.text');
  const { requestBrush, cancelBrush } = useScrubHost();
  const state = useEditState(ctx.engine);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const items = layersOfKind(state, 'text');
  const selLayer = items.find((l) => l.id === selected) ?? null;
  const p = selLayer ? (selLayer.payload as unknown as TextPayload) : null;

  // Drag on the photo to move the selected text layer (reads the current
  // transform fresh so size/rotation set via the sliders is preserved).
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

  const add = () => {
    const content = draft.trim().normalize('NFC');
    if (!content) return;
    const payload: TextPayload = {
      content,
      fontId: VIET_FONTS[0].id,
      sizeRel: 0.08,
      color: '#ffffff',
      align: 'center',
      outline: 0,
      shadow: true,
    };
    const id = addLayer(ctx.engine, {
      kind: 'text',
      payload: payload as unknown as Record<string, unknown>,
      transform: { x: 0.5, y: 0.5 },
    });
    setSelected(id);
    setDraft('');
  };

  const rotationSlider = selLayer ? clamp01((selLayer.transform.rotation + Math.PI) / (2 * Math.PI)) : 0.5;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('placeholder')}
          className="min-w-0 flex-1 rounded-[var(--radius-control)] bg-surface-1 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <Button variant="primary" onPointerDown={add} disabled={!draft.trim()}>
          {t('add')}
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="py-2 text-sm text-ink-mute">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((l) => {
            const lp = l.payload as unknown as TextPayload;
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
                  {lp.content || '—'}
                </button>
                <Button variant="danger" onPointerDown={() => removeLayer(ctx.engine, l.id)}>
                  {t('remove')}
                </Button>
              </Surface>
            );
          })}
        </div>
      )}

      {selLayer && p && (
        <Surface level={1} className="flex flex-col gap-3 p-3">
          <p className="text-xs text-ink-mute">{t('hint')}</p>
          <input
            value={p.content}
            onChange={(e) =>
              patchPayload(ctx.engine, selLayer.id, { content: e.target.value.normalize('NFC') })
            }
            className="w-full rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm text-ink outline-none"
          />
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-mute">{t('font')}</p>
            <Segmented
              value={p.fontId}
              onChange={(v) => patchPayload(ctx.engine, selLayer.id, { fontId: v })}
              options={VIET_FONTS.map((f) => ({ value: f.id, label: f.label }))}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-mute">{t('align')}</p>
            <Segmented<TextAlign>
              value={p.align}
              onChange={(v) => patchPayload(ctx.engine, selLayer.id, { align: v })}
              options={ALIGNS.map((a) => ({ value: a, label: a }))}
            />
          </div>
          <label className="flex items-center justify-between text-sm text-ink-soft">
            {t('color')}
            <input
              type="color"
              value={p.color}
              onChange={(e) => patchPayload(ctx.engine, selLayer.id, { color: e.target.value })}
              className="h-8 w-12 rounded bg-transparent"
            />
          </label>
          <Slider
            label={t('size')}
            value={relToSlider(p.sizeRel)}
            onChange={(v) => patchPayload(ctx.engine, selLayer.id, { sizeRel: sliderToRel(v) }, `text-size-${selLayer.id}`)}
          />
          <Slider
            label={t('outline')}
            value={p.outline}
            onChange={(v) => patchPayload(ctx.engine, selLayer.id, { outline: v }, `text-outline-${selLayer.id}`)}
          />
          <Slider
            label={t('rotation')}
            value={rotationSlider}
            onChange={(v) =>
              updateLayer(
                ctx.engine,
                selLayer.id,
                { transform: { ...selLayer.transform, rotation: v * 2 * Math.PI - Math.PI } },
                `text-rot-${selLayer.id}`,
              )
            }
          />
          <Chip active={p.shadow} onClick={() => patchPayload(ctx.engine, selLayer.id, { shadow: !p.shadow })}>
            {t('shadow')}
          </Chip>
        </Surface>
      )}
    </div>
  );
}

export const textModule: ToolModule = {
  id: 'text',
  titleKey: 'toolbar.text',
  phase: 3,
  Icon: TextIcon,
  Panel: TextPanel,
};
