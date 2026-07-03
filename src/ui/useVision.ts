'use client';

/**
 * Lazily trigger on-device detection for a Phase 2 tool and expose its status
 * so Panels can show a bilingual loading / offline / no-subject message
 * (contracts/vision.md). The engine caches per photo+geometry, so re-opening a
 * tool is instant.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Engine } from '@/engine';
import { ModelUnavailableOfflineError, type VisionKind } from '@/vision/types';

export type VisionStatus = 'loading' | 'ready' | 'error' | 'offline';

export function useVision(engine: Engine, kinds: VisionKind[]): {
  status: VisionStatus;
  retry: () => void;
} {
  const [status, setStatus] = useState<VisionStatus>('loading');
  const key = kinds.join(',');

  const run = useCallback(() => {
    setStatus('loading');
    engine
      .ensureDetection(kinds)
      .then(() => setStatus('ready'))
      .catch((e: unknown) => {
        setStatus(e instanceof ModelUnavailableOfflineError ? 'offline' : 'error');
      });
    // kinds is stable per tool; key guards the dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, key]);

  useEffect(run, [run]);
  return { status, retry: run };
}
