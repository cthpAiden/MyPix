'use client';

/**
 * Manual push/pull warp module (US2.6, T073/T074). A liquify brush: push/pull,
 * freeze/protect, and reconstruct, with size/strength. Strokes are captured on
 * the photo through the shared brush host and accumulate into the liquify op;
 * the shared PrecisionLoupe (edit screen) offsets the touch point. No detection
 * needed — this is the manual-warp fallback for the face/body tools.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { WarpIcon } from '@/ui/icons';
import { Segmented, Button, Slider } from '@/ui/primitives';
import { useScrubHost, type BrushHandler } from '@/ui/scrub';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam, removeOp } from '@/shared/ops';
import { cloneStrokes, makeStroke } from './liquify';
import type { LiquifyParams, LiquifyStroke } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

type Mode = 'push' | 'freeze' | 'reconstruct';

function WarpPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.warp');
  const { requestBrush, cancelBrush } = useScrubHost();
  const [mode, setMode] = useState<Mode>('push');
  const [size, setSize] = useState(0.4);
  const [strength, setStrength] = useState(0.5);
  useEditState(ctx.engine);

  const cfg = useRef({ mode, size, strength });
  cfg.current = { mode, size, strength };
  const working = useRef<LiquifyStroke[] | null>(null);

  useEffect(() => {
    const handler: BrushHandler = {
      onStart: (nx, ny) => {
        const cur =
          (ctx.engine.findOp('liquify')?.params as LiquifyParams | undefined)?.strokes ?? [];
        const stroke = makeStroke(cfg.current.mode, cfg.current.size, cfg.current.strength, nx, ny);
        working.current = [...cloneStrokes(cur), stroke];
        applyOpParam(ctx.engine, 'liquify', { strokes: working.current }, 'liquify-stroke');
      },
      onMove: (nx, ny) => {
        if (!working.current) return;
        working.current[working.current.length - 1].path.push({ x: nx, y: ny });
        applyOpParam(ctx.engine, 'liquify', { strokes: cloneStrokes(working.current) }, 'liquify-stroke');
      },
      onEnd: () => {
        working.current = null;
        ctx.engine.endGesture();
      },
    };
    requestBrush(handler);
    return () => cancelBrush();
  }, [ctx.engine, requestBrush, cancelBrush]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-mute">{t('hint')}</p>
      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'push', label: t('push') },
          { value: 'freeze', label: t('freeze') },
          { value: 'reconstruct', label: t('reconstruct') },
        ]}
      />
      <Slider label={t('size')} value={size} onChange={setSize} />
      <Slider label={t('strength')} value={strength} onChange={setStrength} />
      <Button variant="ghost" onPointerDown={() => removeOp(ctx.engine, 'liquify')}>
        {t('clear')}
      </Button>
    </div>
  );
}

export const warpModule: ToolModule = {
  id: 'warp',
  titleKey: 'toolbar.warp',
  phase: 2,
  Icon: WarpIcon,
  Panel: WarpPanel,
};
