'use client';

/**
 * View-only zoom/pan/reset for the preview canvas (US3 / FR-014…FR-020,
 * contracts/viewport.md). A multi-pointer gesture layer sits in front of the
 * existing single-pointer scrub/pick/brush handlers:
 *   - 2 pointers  → pinch (distance ratio) + pan (midpoint delta), consumed.
 *   - 1 pointer   → delegated to `fallback` unchanged (no scrub regression).
 *   - double-tap  → toggle default ⇄ zoomed-in, centered on the tap point.
 *
 * The transform is applied as a CSS `transform` on the canvas element, so the
 * engine render and export are untouched, and pointer→image mapping (which reads
 * `getBoundingClientRect`) stays correct at any zoom/pan with no change (FR-018/019).
 * The canvas is appended imperatively by the editor, so the hook writes its size
 * and transform directly to the element rather than through React style props.
 */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface PointerHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
}

export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
  style: React.CSSProperties;
  handlers: PointerHandlers;
  reset: () => void;
  isZoomed: boolean;
}

/* ------------------------------ pure clamp math ------------------------------ */
/* Exported for unit testing (tests/unit/viewport-clamp.test.ts). */

/** Comfortable margin so the default view isn't edge-to-edge (FR-014). */
export const VIEWPORT_MARGIN = 0.9;
/** Max zoom target expressed in on-screen pixels per canvas pixel (~4× actual). */
export const MAX_ACTUAL_PIXELS = 4;
/** Double-tap zoom target in actual pixels. */
export const DOUBLE_TAP_ACTUAL_PIXELS = 2;
const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 12;

/** CSS px per canvas px at the default whole-photo-with-margin framing. */
export function computeFit(cW: number, cH: number, outW: number, outH: number, margin = VIEWPORT_MARGIN): number {
  if (cW <= 0 || cH <= 0 || outW <= 0 || outH <= 0) return 1;
  return Math.min(cW / outW, cH / outH) * margin;
}

/** Upper `scale` bound: 4× actual pixels relative to the default fit. */
export function maxScale(fit: number): number {
  return fit > 0 ? MAX_ACTUAL_PIXELS / fit : 1;
}

/** Clamp zoom into [1, sMax] (never zoom out past the whole photo). */
export function clampScale(scale: number, fit: number): number {
  return Math.min(Math.max(scale, 1), maxScale(fit));
}

/**
 * Clamp pan so the scaled image keeps covering the viewport when it's larger
 * than the container, and stays centered when it isn't (cannot be dragged out).
 */
export function clampTranslate(
  tx: number,
  ty: number,
  scale: number,
  fit: number,
  cW: number,
  cH: number,
  outW: number,
  outH: number,
): { tx: number; ty: number } {
  const renderedW = outW * fit * scale;
  const renderedH = outH * fit * scale;
  const maxX = Math.max(0, (renderedW - cW) / 2);
  const maxY = Math.max(0, (renderedH - cH) / 2);
  return {
    tx: Math.min(Math.max(tx, -maxX), maxX),
    ty: Math.min(Math.max(ty, -maxY), maxY),
  };
}

/* --------------------------------- the hook --------------------------------- */

type Mode = 'idle' | 'single' | 'pinch';
interface PinchStart {
  dist: number;
  midX: number;
  midY: number;
  scale: number;
  tx: number;
  ty: number;
}

export function useViewport(opts: {
  /** The canvas host that measures the fit (read-only; any element ref works). */
  container: { readonly current: HTMLElement | null };
  canvas: HTMLCanvasElement;
  fallback: PointerHandlers;
  reducedMotion: boolean;
}): Viewport {
  const { canvas, container, fallback, reducedMotion } = opts;

  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const fitRef = useRef(1);
  const [isZoomed, setIsZoomed] = useState(false);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const modeRef = useRef<Mode>('idle');
  const pinchRef = useRef<PinchStart | null>(null);
  const downRef = useRef<{ t: number; x: number; y: number; moved: boolean } | null>(null);
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);

  const applyTransform = () => {
    const fit = fitRef.current;
    canvas.style.width = `${canvas.width * fit}px`;
    canvas.style.height = `${canvas.height * fit}px`;
    canvas.style.transformOrigin = 'center';
    canvas.style.transform = `translate(${txRef.current}px, ${tyRef.current}px) scale(${scaleRef.current})`;
  };

  const dims = () => {
    const rect = container.current?.getBoundingClientRect();
    return {
      cW: rect?.width ?? 0,
      cH: rect?.height ?? 0,
      outW: canvas.width,
      outH: canvas.height,
    };
  };

  const measure = () => {
    const { cW, cH, outW, outH } = dims();
    fitRef.current = computeFit(cW, cH, outW, outH);
    // Re-clamp existing zoom/pan to the (possibly new) fit and container.
    scaleRef.current = clampScale(scaleRef.current, fitRef.current);
    const c = clampTranslate(txRef.current, tyRef.current, scaleRef.current, fitRef.current, cW, cH, outW, outH);
    txRef.current = c.tx;
    tyRef.current = c.ty;
    applyTransform();
  };

  // Recompute the fit on container resize. `measure` only reads refs/DOM, so the
  // first-render closure stays valid for the observer's lifetime.
  useEffect(() => {
    const el = container.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (modeRef.current !== 'pinch') measure();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-measure on each render too, to catch canvas intrinsic size changes after
  // an engine re-render (e.g. crop). A pinch mutates refs imperatively without
  // re-rendering, so this never fires mid-gesture.
  useLayoutEffect(() => {
    if (modeRef.current !== 'pinch') measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const setZoom = (scale: number, tx: number, ty: number) => {
    const { cW, cH, outW, outH } = dims();
    const s = clampScale(scale, fitRef.current);
    const c = clampTranslate(tx, ty, s, fitRef.current, cW, cH, outW, outH);
    scaleRef.current = s;
    txRef.current = c.tx;
    tyRef.current = c.ty;
    applyTransform();
    const zoomed = s > 1.0001;
    setIsZoomed((prev) => (prev === zoomed ? prev : zoomed));
  };

  const reset = () => {
    const finish = () => {
      canvas.style.transition = '';
      canvas.removeEventListener('transitionend', finish);
    };
    if (!reducedMotion) {
      canvas.style.transition = 'transform 200ms ease';
      canvas.addEventListener('transitionend', finish);
    }
    setZoom(1, 0, 0);
    if (reducedMotion) canvas.style.transition = '';
  };

  const midpoint = () => {
    const pts = [...pointers.current.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  };
  const distance = () => {
    const pts = [...pointers.current.values()];
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const toggleDoubleTap = (clientX: number, clientY: number) => {
    if (scaleRef.current > 1.0001) {
      reset();
      return;
    }
    const target = clampScale(DOUBLE_TAP_ACTUAL_PIXELS / fitRef.current, fitRef.current);
    // Center the tapped image point: nx from the current (default) rect.
    const rect = canvas.getBoundingClientRect();
    const nx = rect.width ? (clientX - rect.left) / rect.width : 0.5;
    const ny = rect.height ? (clientY - rect.top) / rect.height : 0.5;
    const baseW = canvas.width * fitRef.current;
    const baseH = canvas.height * fitRef.current;
    setZoom(target, baseW * target * (0.5 - nx), baseH * target * (0.5 - ny));
  };

  const handlers: PointerHandlers = {
    onPointerDown: (e) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const n = pointers.current.size;
      if (n >= 2) {
        // Second finger: abort any in-progress single-pointer scrub, start pinch.
        if (modeRef.current === 'single') fallback.onPointerCancel(e);
        modeRef.current = 'pinch';
        const mid = midpoint();
        pinchRef.current = {
          dist: distance(),
          midX: mid.x,
          midY: mid.y,
          scale: scaleRef.current,
          tx: txRef.current,
          ty: tyRef.current,
        };
      } else {
        modeRef.current = 'single';
        downRef.current = { t: e.timeStamp, x: e.clientX, y: e.clientY, moved: false };
        fallback.onPointerDown(e);
      }
    },
    onPointerMove: (e) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (modeRef.current === 'pinch' && pointers.current.size >= 2 && pinchRef.current) {
        const start = pinchRef.current;
        const ratio = start.dist > 0 ? distance() / start.dist : 1;
        const mid = midpoint();
        setZoom(start.scale * ratio, start.tx + (mid.x - start.midX), start.ty + (mid.y - start.midY));
      } else if (modeRef.current === 'single') {
        if (downRef.current && Math.hypot(e.clientX - downRef.current.x, e.clientY - downRef.current.y) > TAP_SLOP_PX) {
          downRef.current.moved = true;
        }
        fallback.onPointerMove(e);
      }
    },
    onPointerUp: (e) => {
      const wasPinch = modeRef.current === 'pinch';
      pointers.current.delete(e.pointerId);
      if (wasPinch) {
        pinchRef.current = null;
        if (pointers.current.size === 0) modeRef.current = 'idle';
        return; // don't resume scrub from a leftover finger
      }
      // single-pointer tap/scrub
      const down = downRef.current;
      const isTap = !!down && !down.moved && e.timeStamp - down.t < DOUBLE_TAP_MS;
      fallback.onPointerUp(e);
      if (isTap) {
        const last = lastTapRef.current;
        if (last && e.timeStamp - last.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < TAP_SLOP_PX) {
          lastTapRef.current = null;
          toggleDoubleTap(e.clientX, e.clientY);
        } else {
          lastTapRef.current = { t: e.timeStamp, x: e.clientX, y: e.clientY };
        }
      }
      downRef.current = null;
      if (pointers.current.size === 0) modeRef.current = 'idle';
    },
    onPointerCancel: (e) => {
      const wasPinch = modeRef.current === 'pinch';
      pointers.current.delete(e.pointerId);
      if (!wasPinch) fallback.onPointerCancel(e);
      else pinchRef.current = null;
      downRef.current = null;
      if (pointers.current.size < 2 && wasPinch) pinchRef.current = null;
      if (pointers.current.size === 0) modeRef.current = 'idle';
    },
  };

  return {
    scale: scaleRef.current,
    tx: txRef.current,
    ty: tyRef.current,
    style: {
      transform: `translate(${txRef.current}px, ${tyRef.current}px) scale(${scaleRef.current})`,
      transformOrigin: 'center',
    },
    handlers,
    reset,
    isZoomed,
  };
}
