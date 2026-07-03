'use client';

/**
 * ScrubHost wires the whole-photo gesture (useParamScrub, T025) to whichever
 * adjust-type Panel is open. The editor owns the gesture surface (the photo)
 * and the large readout; a Panel registers its scrub params via `setConfig`
 * and reads the active param back from `scrub`.
 */
import { createContext, useContext } from 'react';
import type { ScrubParam, ScrubState } from '@/ui/useParamScrub';

export interface ScrubConfig {
  params: ScrubParam[];
  onChange: (key: string, value: number, coalesceKey: string) => void;
}

export type PickCallback = (rgb: [number, number, number], nx: number, ny: number) => void;

/** Stroke-brush handler for the manual liquify/warp tool (image-normalized coords). */
export interface BrushHandler {
  onStart: (nx: number, ny: number) => void;
  onMove: (nx: number, ny: number) => void;
  onEnd: () => void;
}

export interface ScrubHost {
  scrub: ScrubState;
  setConfig: (config: ScrubConfig | null) => void;
  /** Enter eyedropper mode; the next photo tap samples a pixel and calls back. */
  requestPick: (cb: PickCallback) => void;
  cancelPick: () => void;
  pickActive: boolean;
  /** Enter brush mode; photo drags feed the handler until cancelled. */
  requestBrush: (handler: BrushHandler) => void;
  cancelBrush: () => void;
  brushActive: boolean;
}

export const ScrubContext = createContext<ScrubHost | null>(null);

export function useScrubHost(): ScrubHost {
  const ctx = useContext(ScrubContext);
  if (!ctx) throw new Error('useScrubHost must be used inside the editor');
  return ctx;
}
