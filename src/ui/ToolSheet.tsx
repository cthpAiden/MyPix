'use client';

/**
 * Bottom-sheet tool tray (T024, contracts/engine.md UI-shell). Peek / half /
 * full detents with velocity-honoring, interruptible spring physics. Hosts
 * every module Panel so all tools share one interaction grammar. Honors
 * prefers-reduced-motion (snaps without spring).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export type Detent = 'peek' | 'half' | 'full';

/** Visible fraction of the viewport at each detent. */
const FRACTION: Record<Detent, number> = { peek: 0.24, half: 0.52, full: 0.9 };
const SHEET_FRACTION = FRACTION.full;

/**
 * Fraction of the viewport the sheet always covers, even fully collapsed. The
 * photo canvas must reserve this much space (see edit/page.tsx) so the sheet
 * never hides part of the photo — only the panel content above it.
 */
export const SHEET_PEEK_FRACTION = FRACTION.peek;
const ORDER: Detent[] = ['peek', 'half', 'full'];

export function ToolSheet({
  header,
  children,
  detent,
  onDetentChange,
  reducedMotion = false,
}: {
  header: ReactNode;
  children: ReactNode;
  detent: Detent;
  onDetentChange: (d: Detent) => void;
  reducedMotion?: boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  const yRef = useRef(0);
  const velRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startPointerRef = useRef(0);
  const lastMoveRef = useRef({ t: 0, y: 0 });

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const sheetHeight = vh * SHEET_FRACTION;
  const yForDetent = useCallback(
    (d: Detent) => (SHEET_FRACTION - FRACTION[d]) * vh,
    [vh],
  );

  const applyY = useCallback((y: number) => {
    yRef.current = y;
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${y.toFixed(1)}px)`;
  }, []);

  const springTo = useCallback(
    (target: Detent) => {
      onDetentChange(target);
      const goal = yForDetent(target);
      if (reducedMotion) {
        applyY(goal);
        return;
      }
      const stiffness = 190;
      const damping = 24;
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        const force = -stiffness * (yRef.current - goal);
        const damp = -damping * velRef.current;
        velRef.current += force * dt + damp * dt;
        applyY(yRef.current + velRef.current * dt);
        if (Math.abs(yRef.current - goal) < 0.5 && Math.abs(velRef.current) < 2) {
          applyY(goal);
          velRef.current = 0;
          rafRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(step);
      };
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(step);
    },
    [applyY, onDetentChange, reducedMotion, yForDetent],
  );

  // Settle to the controlled detent when it changes externally or on mount/resize.
  useEffect(() => {
    if (!draggingRef.current) applyY(yForDetent(detent));
  }, [detent, applyY, yForDetent]);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    velRef.current = 0;
    startYRef.current = yRef.current;
    startPointerRef.current = e.clientY;
    lastMoveRef.current = { t: performance.now(), y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dy = e.clientY - startPointerRef.current;
    const maxY = yForDetent('peek');
    const next = Math.max(0, Math.min(maxY + 40, startYRef.current + dy));
    applyY(next);
    lastMoveRef.current = { t: performance.now(), y: e.clientY };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const now = performance.now();
    const dt = Math.max(1, now - lastMoveRef.current.t);
    const velocity = ((e.clientY - lastMoveRef.current.y) / dt) * 1000; // px/s, +down
    velRef.current = velocity;

    // Pick the detent: nearest by position, nudged by fling velocity.
    const y = yRef.current;
    let best = ORDER[0];
    let bestDist = Infinity;
    for (const d of ORDER) {
      const dist = Math.abs(yForDetent(d) - (y + velocity * 0.08));
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    springTo(best);
  };

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-[var(--radius-sheet)] bg-surface-1 shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"
      style={{
        height: `${sheetHeight}px`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        touchAction: 'none',
      }}
    >
      <div
        className="flex cursor-grab flex-col items-center pt-2.5 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="separator"
        aria-orientation="horizontal"
      >
        <span className="h-1.5 w-10 rounded-full bg-hairline" />
        <div className="w-full px-4 pt-2">{header}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
    </div>
  );
}
