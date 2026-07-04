'use client';

/**
 * Frames module (US3.4, T084). A single frame Layer: adjustable-width colour
 * borders plus film-strip and instant-photo styles. The frame is drawn in output
 * space so it adapts to the current aspect ratio and rasterizes at full
 * resolution on export.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FrameIcon } from '@/ui/icons';
import { Chip, Slider, Surface } from '@/ui/primitives';
import { useEditState } from '@/ui/useEngine';
import { addLayer, layersOfKind, patchPayload, removeLayer } from '@/shared/layers';
import { clamp01 } from '@/shared/math';
import { loadFrames, type FrameEntry } from './library';
import type { FramePayload, FrameStyle } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const MAX_WIDTH = 0.12;

function FramesPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.frames');
  const state = useEditState(ctx.engine);
  const [presets, setPresets] = useState<FrameEntry[]>([]);

  useEffect(() => {
    loadFrames().then(setPresets);
  }, []);

  const frame = layersOfKind(state, 'frame')[0] ?? null;
  const p = frame ? (frame.payload as unknown as FramePayload) : null;

  const applyStyle = (entry: FrameEntry) => {
    if (frame) {
      patchPayload(ctx.engine, frame.id, { style: entry.style, width: entry.width, color: entry.color });
    } else {
      const payload: FramePayload = { style: entry.style, width: entry.width, color: entry.color };
      addLayer(ctx.engine, { kind: 'frame', payload: payload as unknown as Record<string, unknown> });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Chip active={!frame} onClick={() => frame && removeLayer(ctx.engine, frame.id)}>
          {t('none')}
        </Chip>
        {presets.map((entry) => (
          <Chip
            key={entry.id}
            active={p?.style === entry.style}
            onClick={() => applyStyle(entry)}
          >
            {t(entry.style as FrameStyle)}
          </Chip>
        ))}
      </div>

      {frame && p && (
        <Surface level={1} className="flex flex-col gap-3 p-3">
          <Slider
            label={t('width')}
            value={clamp01(p.width / MAX_WIDTH)}
            onChange={(v) => patchPayload(ctx.engine, frame.id, { width: v * MAX_WIDTH }, `frame-w`)}
          />
          <label className="flex items-center justify-between text-sm text-ink-soft">
            {t('color')}
            <input
              type="color"
              value={p.color}
              onChange={(e) => patchPayload(ctx.engine, frame.id, { color: e.target.value })}
              className="h-8 w-12 rounded bg-transparent"
            />
          </label>
        </Surface>
      )}
    </div>
  );
}

export const framesModule: ToolModule = {
  id: 'frames',
  titleKey: 'toolbar.frames',
  phase: 3,
  Icon: FrameIcon,
  Panel: FramesPanel,
};
