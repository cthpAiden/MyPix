'use client';

/**
 * White Balance module (US1.4, T045). Temp/tint via scrub, plus an image-space
 * neutral-picker eyedropper that samples a pixel and converts it to temp/tint.
 */
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { WhiteBalanceIcon } from '@/ui/icons';
import { ScrubPanel } from '@/ui/ScrubPanel';
import { Button } from '@/ui/primitives';
import { useScrubHost } from '@/ui/scrub';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam } from '@/shared/ops';
import { clamp } from '@/shared/math';
import { defaultWhiteBalance } from '@/engine/editState';
import type { WhiteBalanceParams } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

/** Convert a picked (should-be-neutral) pixel into temp/tint corrections. */
function neutralToTempTint(rgb: [number, number, number]): { temp: number; tint: number } {
  const [r, g, b] = rgb;
  const avgRB = (r + b) / 2 + 1e-4;
  // Blue-heavy pixel → warm it (positive temp); red-heavy → cool it.
  const temp = clamp(((b - r) / (b + r + 1e-4)) * 260, -100, 100);
  // Green-heavy → negative tint (toward magenta).
  const tint = clamp(((avgRB - g) / (avgRB + g)) * 260, -100, 100);
  return { temp, tint };
}

function WhiteBalancePanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.whiteBalance');
  const host = useScrubHost();
  const state = useEditState(ctx.engine);
  const p =
    (state.operations.find((o) => o.type === 'whiteBalance')?.params as WhiteBalanceParams) ??
    defaultWhiteBalance();
  const [picking, setPicking] = useState(false);

  const params = useMemo(
    () => [
      { key: 'temp', label: t('temp'), min: -100, max: 100, value: p.temp },
      { key: 'tint', label: t('tint'), min: -100, max: 100, value: p.tint },
    ],
    [t, p.temp, p.tint],
  );

  const onChange = useCallback(
    (key: string, value: number, coalesceKey: string) =>
      applyOpParam(ctx.engine, 'whiteBalance', { [key]: value } as Partial<WhiteBalanceParams>, coalesceKey),
    [ctx.engine],
  );
  const onReset = useCallback(
    (key: string) => applyOpParam(ctx.engine, 'whiteBalance', { [key]: 0 } as Partial<WhiteBalanceParams>),
    [ctx.engine],
  );

  const startPick = () => {
    setPicking(true);
    host.requestPick((rgb, nx, ny) => {
      const { temp, tint } = neutralToTempTint(rgb);
      applyOpParam(ctx.engine, 'whiteBalance', { temp, tint, neutralRef: { x: nx, y: ny } });
      setPicking(false);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ScrubPanel params={params} onChange={onChange} onReset={onReset} />
      <Button variant={picking ? 'primary' : 'ghost'} onPointerDown={startPick} className="self-start">
        {picking ? t('picking') : t('picker')}
      </Button>
    </div>
  );
}

export const whiteBalanceModule: ToolModule = {
  id: 'whiteBalance',
  titleKey: 'toolbar.whiteBalance',
  phase: 1,
  Icon: WhiteBalanceIcon,
  Panel: WhiteBalancePanel,
};
