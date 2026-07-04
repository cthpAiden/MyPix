'use client';

/**
 * Draw module — freehand doodle (US3.8, T089). A single doodle Layer that
 * accumulates freehand strokes (size / colour / opacity) captured through the
 * shared brush host. Strokes are output-normalized so they stay smooth and
 * rasterize crisply into the full-resolution export.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DrawIcon } from '@/ui/icons';
import { Button, Slider, Surface } from '@/ui/primitives';
import { useScrubHost, type BrushHandler } from '@/ui/scrub';
import { useEditState } from '@/ui/useEngine';
import { addLayer, layersOfKind, removeLayer, updateLayer } from '@/shared/layers';
import type { DoodlePayload, DoodleStroke } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const MIN_W = 0.003;
const W_SPAN = 0.05;

function strokesOf(payload: Record<string, unknown>): DoodleStroke[] {
  return (payload as unknown as DoodlePayload).strokes ?? [];
}

function DrawPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.draw');
  const host = useScrubHost();
  const state = useEditState(ctx.engine);
  const [color, setColor] = useState('#f2a35e');
  const [size, setSize] = useState(0.3);
  const cfg = useRef({ color, size });
  cfg.current = { color, size };
  const idRef = useRef<string | null>(null);

  const layer = layersOfKind(state, 'doodle')[0] ?? null;
  if (layer && !idRef.current) idRef.current = layer.id;

  useEffect(() => {
    const handler: BrushHandler = {
      onStart: (nx, ny) => {
        const stroke: DoodleStroke = {
          points: [{ x: nx, y: ny }],
          color: cfg.current.color,
          width: MIN_W + cfg.current.size * W_SPAN,
        };
        const existing = ctx.engine.getState().layers.find((l) => l.id === idRef.current && l.kind === 'doodle');
        if (existing) {
          const next = [...strokesOf(existing.payload).map((s) => ({ ...s, points: [...s.points] })), stroke];
          updateLayer(ctx.engine, existing.id, { payload: { strokes: next } }, 'doodle');
        } else {
          idRef.current = addLayer(ctx.engine, {
            kind: 'doodle',
            payload: { strokes: [stroke] } as unknown as Record<string, unknown>,
          });
        }
      },
      onMove: (nx, ny) => {
        const id = idRef.current;
        const cur = id ? ctx.engine.getState().layers.find((l) => l.id === id) : null;
        if (!cur) return;
        const strokes = strokesOf(cur.payload).map((s) => ({ ...s, points: [...s.points] }));
        strokes[strokes.length - 1].points.push({ x: nx, y: ny });
        updateLayer(ctx.engine, cur.id, { payload: { strokes } }, 'doodle');
      },
      onEnd: () => ctx.engine.endGesture(),
    };
    host.requestBrush(handler);
    return () => host.cancelBrush();
  }, [ctx.engine, host]);

  const undoStroke = () => {
    if (!layer) return;
    const strokes = strokesOf(layer.payload).slice(0, -1);
    if (strokes.length === 0) removeLayer(ctx.engine, layer.id);
    else updateLayer(ctx.engine, layer.id, { payload: { strokes } });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-mute">{t('hint')}</p>
      <label className="flex items-center justify-between text-sm text-ink-soft">
        {t('color')}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-8 w-12 rounded bg-transparent"
        />
      </label>
      <Slider label={t('size')} value={size} onChange={setSize} />
      {layer && (
        <Surface level={1} className="p-3">
          <Slider
            label={t('opacity')}
            value={layer.opacity}
            onChange={(v) => updateLayer(ctx.engine, layer.id, { opacity: v }, 'doodle-op')}
          />
        </Surface>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" onPointerDown={undoStroke} disabled={!layer}>
          {t('undo')}
        </Button>
        <Button variant="ghost" onPointerDown={() => layer && removeLayer(ctx.engine, layer.id)} disabled={!layer}>
          {t('clear')}
        </Button>
      </div>
    </div>
  );
}

export const drawModule: ToolModule = {
  id: 'draw',
  titleKey: 'toolbar.draw',
  phase: 3,
  Icon: DrawIcon,
  Panel: DrawPanel,
};
