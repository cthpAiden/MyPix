'use client';

/**
 * Whole-photo gesture editing (T025, R15). Horizontal drag = value, vertical
 * drag = switch parameter, with a large live readout. Engine dispatch is
 * throttled to one flush per frame; the visual readout is never throttled.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '@/shared/math';
import { detent as detentTick } from '@/ui/feedback';

export interface ScrubParam {
  key: string;
  label: string;
  min: number;
  max: number;
  value: number;
  format?: (v: number) => string;
}

interface Options {
  params: ScrubParam[];
  onChange: (key: string, value: number, coalesceKey: string) => void;
  onGestureEnd?: () => void;
}

export interface ScrubState {
  activeKey: string;
  activeLabel: string;
  readout: string;
  isScrubbing: boolean;
  setActiveKey: (k: string) => void;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

function fmt(p: ScrubParam, v: number): string {
  return p.format ? p.format(v) : String(Math.round(v));
}

export function useParamScrub({ params, onChange, onGestureEnd }: Options): ScrubState {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [readout, setReadout] = useState('');

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const active = params[Math.min(activeIndex, params.length - 1)] ?? params[0];

  // gesture refs
  const axisRef = useRef<'none' | 'h' | 'v'>('none');
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);
  const startIndexRef = useRef(0);
  const coalesceRef = useRef('');
  const pendingRef = useRef<{ key: string; value: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastNotchRef = useRef(0);

  useEffect(() => {
    setReadout(active ? fmt(active, active.value) : '');
  }, [active]);

  const flush = useCallback(() => {
    rafRef.current = null;
    const p = pendingRef.current;
    if (p) {
      onChange(p.key, p.value, coalesceRef.current);
      pendingRef.current = null;
    }
  }, [onChange]);

  const schedule = useCallback(
    (key: string, value: number) => {
      pendingRef.current = { key, value };
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    const p = paramsRef.current[Math.min(activeIndex, paramsRef.current.length - 1)];
    if (!p) return;
    setIsScrubbing(true);
    axisRef.current = 'none';
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startValueRef.current = p.value;
    startIndexRef.current = activeIndex;
    coalesceRef.current = `scrub:${p.key}:${e.pointerId}:${Math.round(e.timeStamp)}`;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isScrubbing) return;
    const list = paramsRef.current;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (axisRef.current === 'none' && Math.hypot(dx, dy) > 8) {
      axisRef.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }

    if (axisRef.current === 'v') {
      const steps = Math.round(-dy / 48);
      const idx = clamp(startIndexRef.current + steps, 0, list.length - 1);
      if (idx !== activeIndex) {
        setActiveIndex(idx);
        setReadout(fmt(list[idx], list[idx].value));
        detentTick();
      }
      return;
    }

    if (axisRef.current === 'h') {
      const p = list[Math.min(activeIndex, list.length - 1)];
      const width = typeof window !== 'undefined' ? window.innerWidth * 0.9 : 360;
      const delta = (dx / width) * (p.max - p.min);
      const value = clamp(startValueRef.current + delta, p.min, p.max);
      setReadout(fmt(p, value));
      // detent tick every ~ (range/20) notch
      const notch = Math.round(value / Math.max(1, (p.max - p.min) / 20));
      if (notch !== lastNotchRef.current) {
        lastNotchRef.current = notch;
        detentTick();
      }
      schedule(p.key, value);
    }
  };

  const endGesture = (e: React.PointerEvent) => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    axisRef.current = 'none';
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      flush();
    }
    onGestureEnd?.();
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  return {
    activeKey: active?.key ?? '',
    activeLabel: active?.label ?? '',
    readout,
    isScrubbing,
    setActiveKey: (k) => {
      const idx = paramsRef.current.findIndex((p) => p.key === k);
      if (idx >= 0) setActiveIndex(idx);
    },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endGesture,
      onPointerCancel: endGesture,
    },
  };
}
