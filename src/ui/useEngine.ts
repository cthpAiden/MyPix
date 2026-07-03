'use client';

/** React bindings for the engine store (useSyncExternalStore). */
import { useSyncExternalStore } from 'react';
import type { Engine, EditState } from '@/engine';

export function useEditState(engine: Engine): EditState {
  return useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.getState(),
    () => engine.getState(),
  );
}
