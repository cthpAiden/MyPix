'use client';

/**
 * Repair module — clone stamp & heal (US3.5, T085/T086). Manual, no AI: set a
 * source point, then paint to copy pixels over the destination. Clone copies
 * verbatim; heal copies texture but re-matches the destination's tone so a
 * blemish repair blends in. Strokes accumulate into the `retouch` op and are
 * baked into the pixel pipeline by the retouch GL pass (preview ≡ export).
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CloneIcon } from '@/ui/icons';
import { Button, Segmented, Slider } from '@/ui/primitives';
import { useScrubHost, type BrushHandler, type PickCallback } from '@/ui/scrub';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam, removeOp } from '@/shared/ops';
import { cloneStrokes, makeStroke, radiusFor, type RetouchMode } from './heal';
import type { RetouchParams, RetouchStroke } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

function RetouchPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.retouch');
  const { requestBrush, cancelBrush, requestPick, cancelPick } = useScrubHost();
  useEditState(ctx.engine);
  const [mode, setMode] = useState<RetouchMode>('clone');
  const [size, setSize] = useState(0.35);
  const [hardness, setHardness] = useState(0.6);
  const [source, setSource] = useState<{ x: number; y: number } | null>(null);
  const [picking, setPicking] = useState(false);

  const cfg = useRef({ mode, size, hardness, source });
  cfg.current = { mode, size, hardness, source };
  const working = useRef<RetouchStroke[] | null>(null);

  // Source picking vs painting share the one photo pointer channel.
  useEffect(() => {
    if (picking) {
      const cb: PickCallback = (_rgb, nx, ny) => {
        setSource({ x: nx, y: ny });
        setPicking(false);
      };
      requestPick(cb);
      return () => cancelPick();
    }
    if (!source) return; // nothing to paint with yet
    const handler: BrushHandler = {
      onStart: (nx, ny) => {
        const c = cfg.current;
        if (!c.source) return;
        const cur = (ctx.engine.findOp('retouch')?.params as RetouchParams | undefined)?.strokes ?? [];
        const stroke = makeStroke(c.mode, c.source, nx, ny, radiusFor(c.size), c.hardness);
        working.current = [...cloneStrokes(cur), stroke];
        applyOpParam(ctx.engine, 'retouch', { strokes: working.current }, 'retouch-stroke');
      },
      onMove: (nx, ny) => {
        if (!working.current) return;
        working.current[working.current.length - 1].path.push({ x: nx, y: ny });
        applyOpParam(ctx.engine, 'retouch', { strokes: cloneStrokes(working.current) }, 'retouch-stroke');
      },
      onEnd: () => {
        working.current = null;
        ctx.engine.endGesture();
      },
    };
    requestBrush(handler);
    return () => cancelBrush();
  }, [ctx.engine, requestBrush, cancelBrush, requestPick, cancelPick, picking, source]);

  return (
    <div className="flex flex-col gap-3">
      <Segmented<RetouchMode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'clone', label: t('clone') },
          { value: 'heal', label: t('heal') },
        ]}
      />

      <Button variant={source ? 'ghost' : 'primary'} active={picking} onPointerDown={() => setPicking(true)}>
        {t('setSource')}
      </Button>
      <p className="text-xs text-ink-mute">{picking ? t('sourceHint') : source ? t('brushHint') : t('needSource')}</p>

      <Slider label={t('size')} value={size} onChange={setSize} />
      <Slider label={t('hardness')} value={hardness} onChange={setHardness} />

      <Button variant="ghost" onPointerDown={() => removeOp(ctx.engine, 'retouch')}>
        {t('clear')}
      </Button>
    </div>
  );
}

export const retouchModule: ToolModule = {
  id: 'retouch',
  titleKey: 'toolbar.retouch',
  phase: 3,
  Icon: CloneIcon,
  Panel: RetouchPanel,
};
