'use client';

/**
 * Compare hook (T026) mapped to engine.setCompareMode. Provides press-and-hold
 * "peek at the negative" and a draggable before/after divider.
 */
import { useCallback, useRef, useState } from 'react';
import type { Engine } from '@/engine';

export function useCompare(engine: Engine) {
  const [dividerActive, setDividerActive] = useState(false);
  const [divider, setDivider] = useState(0.5);
  const holdingRef = useRef(false);

  const startHold = useCallback(() => {
    holdingRef.current = true;
    engine.setCompareMode('hold-original');
  }, [engine]);

  const endHold = useCallback(() => {
    holdingRef.current = false;
    engine.setCompareMode(dividerActive ? { divider } : 'off');
  }, [engine, dividerActive, divider]);

  const enableDivider = useCallback(
    (on: boolean) => {
      setDividerActive(on);
      engine.setCompareMode(on ? { divider } : 'off');
    },
    [engine, divider],
  );

  const moveDivider = useCallback(
    (value: number) => {
      const v = Math.max(0, Math.min(1, value));
      setDivider(v);
      if (dividerActive && !holdingRef.current) engine.setCompareMode({ divider: v });
    },
    [engine, dividerActive],
  );

  return {
    divider,
    dividerActive,
    enableDivider,
    moveDivider,
    holdHandlers: {
      onPointerDown: startHold,
      onPointerUp: endHold,
      onPointerCancel: endHold,
      onPointerLeave: endHold,
    },
  };
}
