/**
 * Helpers for tool modules to read/write their single operation through the
 * engine (the only sanctioned side-effect channel). Add-or-update collapses a
 * whole scrub gesture into one undo step via a shared coalesce key.
 */
import { defaultParamsFor, defaultCrop } from '@/engine/editState';
import type { Engine } from '@/engine';
import type { AnyOperation, CropParams, OperationParams, OperationType } from '@/engine/editState';
import { newId } from './id';

/**
 * The active crop (the one the preview is framed by), or an identity crop when
 * none is enabled. Brush tools use this to map on-screen (cropped-output) stroke
 * coordinates back into full-source space (see mapOutputToSource).
 */
export function currentCrop(engine: Engine): CropParams {
  const op = engine.getState().operations.find((o) => o.type === 'crop' && o.enabled);
  return (op?.params as CropParams) ?? defaultCrop();
}

export function getParams<T extends OperationType>(
  engine: Engine,
  type: T,
): OperationParams[T] {
  const op = engine.findOp(type);
  return (op?.params as OperationParams[T]) ?? defaultParamsFor(type);
}

export function hasParams(engine: Engine, type: OperationType): boolean {
  return engine.findOp(type) != null;
}

/** Apply a partial params patch to the op of `type`, adding it if absent. */
export function applyOpParam<T extends OperationType>(
  engine: Engine,
  type: T,
  patch: Partial<OperationParams[T]>,
  coalesceKey?: string,
): void {
  const existing = engine.findOp(type);
  if (existing) {
    engine.dispatch({ kind: 'op/update', id: existing.id, params: patch, coalesceKey });
  } else {
    engine.dispatch({
      kind: 'op/add',
      op: {
        id: newId('op'),
        type,
        enabled: true,
        params: { ...defaultParamsFor(type), ...patch },
      } as unknown as AnyOperation,
      coalesceKey,
    });
  }
}

/** Remove the op of `type` entirely (full reset). */
export function removeOp(engine: Engine, type: OperationType): void {
  const existing = engine.findOp(type);
  if (existing) engine.dispatch({ kind: 'op/remove', id: existing.id });
}
