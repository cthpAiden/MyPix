/**
 * The pure, synchronous edit-state reducer (contracts/edit-state.md).
 *
 * `reduce(state, action)` returns a new immutable EditState. All numeric params
 * clamp to their documented ranges here, so invalid input can never enter the
 * stack. History (undo/redo) and per-gesture coalescing live in history.ts and
 * the engine store — this function only transforms operations & layers.
 */
import { clampParams, isPortableOp } from './registry';
import type { AnyOperation, EditAction, EditState, Layer, Operation } from './types';

function withOps(state: EditState, operations: AnyOperation[]): EditState {
  return { ...state, operations };
}
function withLayers(state: EditState, layers: Layer[]): EditState {
  return { ...state, layers };
}

/** Clamp an operation's params according to its type. */
export function clampOperation(op: AnyOperation): AnyOperation {
  return { ...op, params: clampParams(op.type, op.params) } as AnyOperation;
}

export function reduce(state: EditState, action: EditAction): EditState {
  switch (action.kind) {
    case 'op/add': {
      const op = clampOperation(action.op);
      return withOps(state, [...state.operations, op]);
    }

    case 'op/update': {
      let changed = false;
      const operations = state.operations.map((op) => {
        if (op.id !== action.id) return op;
        changed = true;
        const merged = {
          ...op,
          params: { ...op.params, ...action.params },
        } as Operation;
        return clampOperation(merged as AnyOperation);
      });
      return changed ? withOps(state, operations) : state;
    }

    case 'op/toggle': {
      let changed = false;
      const operations = state.operations.map((op) => {
        if (op.id !== action.id || op.enabled === action.enabled) return op;
        changed = true;
        return { ...op, enabled: action.enabled };
      });
      // Return the same state on a no-op (unknown id or already at that value)
      // so the engine doesn't record a dead undo step.
      return changed ? withOps(state, operations) : state;
    }

    case 'op/remove':
      return withOps(
        state,
        state.operations.filter((op) => op.id !== action.id),
      );

    case 'layer/add':
      return withLayers(state, [...state.layers, action.layer]);

    case 'layer/update': {
      let changed = false;
      const layers = state.layers.map((l) => {
        if (l.id !== action.id) return l;
        changed = true;
        return { ...l, ...action.patch };
      });
      // No matching layer → no change, so don't record a dead undo step.
      return changed ? withLayers(state, layers) : state;
    }

    case 'layer/remove':
      return withLayers(
        state,
        state.layers.filter((l) => l.id !== action.id),
      );

    case 'layer/reorder': {
      const idx = state.layers.findIndex((l) => l.id === action.id);
      if (idx < 0) return state;
      const layers = state.layers.slice();
      const [moved] = layers.splice(idx, 1);
      const to = Math.max(0, Math.min(action.toIndex, layers.length));
      layers.splice(to, 0, moved);
      return withLayers(state, layers);
    }

    case 'preset/apply': {
      // Keep photo-specific ops & layers; replace portable ops with the preset's.
      const kept = state.operations.filter((op) => !isPortableOp(op.type));
      const incoming = action.operations
        .filter((op) => isPortableOp(op.type))
        .map(clampOperation);
      return withOps(state, [...kept, ...incoming]);
    }

    case 'state/replace': {
      const s = action.state;
      return {
        schemaVersion: s.schemaVersion,
        operations: s.operations.map(clampOperation),
        layers: s.layers.map((l) => ({ ...l })),
      };
    }

    // Handled by the history layer, not the content reducer.
    case 'history/undo':
    case 'history/redo':
      return state;

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
