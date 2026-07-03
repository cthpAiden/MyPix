'use client';

/**
 * Curves module (US1.4, T043). Interactive per-channel curve editor: drag
 * control points, tap to add, double-tap a middle point to remove. Endpoints
 * keep their x pinned. Dispatches a `curves` op (points fed to the LUT shader).
 */
import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CurvesIcon } from '@/ui/icons';
import { Segmented } from '@/ui/primitives';
import { useEditState } from '@/ui/useEngine';
import { applyOpParam, getParams } from '@/shared/ops';
import { clamp01 } from '@/shared/math';
import { newId } from '@/shared/id';
import type { CurveChannel, CurvesParams, Point2D } from '@/engine/editState';
import type { ToolContext, ToolModule } from '@/ui/toolModule';

const CHANNELS: CurveChannel[] = ['rgb', 'r', 'g', 'b'];
const STROKE: Record<CurveChannel, string> = {
  rgb: 'var(--color-ink)',
  r: '#e5675f',
  g: '#7fbf8f',
  b: '#6ea8e5',
};

function sortPts(pts: Point2D[]): Point2D[] {
  return [...pts].sort((a, b) => a.x - b.x);
}

function CurvesPanel({ ctx }: { ctx: ToolContext }) {
  const t = useTranslations('tools.curves');
  const state = useEditState(ctx.engine);
  const [channel, setChannel] = useState<CurveChannel>('rgb');
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ index: number; key: string } | null>(null);

  const params =
    (state.operations.find((o) => o.type === 'curves')?.params as CurvesParams) ??
    getParams(ctx.engine, 'curves');
  const pts = sortPts(params.points[channel]);

  const commit = useCallback(
    (next: Point2D[], coalesceKey?: string) => {
      const fresh = getParams(ctx.engine, 'curves');
      applyOpParam(
        ctx.engine,
        'curves',
        { points: { ...fresh.points, [channel]: sortPts(next) } },
        coalesceKey,
      );
    },
    [ctx.engine, channel],
  );

  const toGraph = (clientX: number, clientY: number): Point2D => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01(1 - (clientY - rect.top) / rect.height),
    };
  };

  const onPointDown = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = { index, key: `curve:${channel}:${newId()}` };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const g = toGraph(e.clientX, e.clientY);
    const current = sortPts(getParams(ctx.engine, 'curves').points[channel]);
    const isEndpoint = drag.index === 0 || drag.index === current.length - 1;
    const next = current.map((p, i) =>
      i === drag.index ? { x: isEndpoint ? p.x : g.x, y: g.y } : p,
    );
    commit(next, drag.key);
  };

  const onUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      ctx.engine.endGesture();
      dragRef.current = null;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    }
  };

  const onBackgroundDown = (e: React.PointerEvent) => {
    const g = toGraph(e.clientX, e.clientY);
    const next = sortPts([...pts, g]);
    const index = next.findIndex((p) => p.x === g.x && p.y === g.y);
    commit(next, `curve:add:${newId()}`);
    dragRef.current = { index, key: `curve:${channel}:${newId()}` };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const removePoint = (index: number) => {
    if (index === 0 || index === pts.length - 1) return;
    commit(pts.filter((_, i) => i !== index));
  };

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${1 - p.y}`).join(' ');

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        value={channel}
        onChange={setChannel}
        options={CHANNELS.map((c) => ({ value: c, label: t(c) }))}
      />
      <div className="aspect-square w-full rounded-[var(--radius-panel)] bg-surface-1 p-2">
        <svg
          ref={svgRef}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="h-full w-full touch-none"
          onPointerDown={onBackgroundDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {[0.25, 0.5, 0.75].map((g) => (
            <g key={g} stroke="var(--color-hairline)" strokeWidth="0.004">
              <line x1={g} y1={0} x2={g} y2={1} />
              <line x1={0} y1={g} x2={1} y2={g} />
            </g>
          ))}
          <path d={path} fill="none" stroke={STROKE[channel]} strokeWidth="0.012" vectorEffect="non-scaling-stroke" />
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={1 - p.y}
              r={0.02}
              fill="var(--color-safelight)"
              onPointerDown={onPointDown(i)}
              onDoubleClick={() => removePoint(i)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

export const curvesModule: ToolModule = {
  id: 'curves',
  titleKey: 'toolbar.curves',
  phase: 1,
  Icon: CurvesIcon,
  Panel: CurvesPanel,
};
