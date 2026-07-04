/**
 * Helpers for tool modules to add/read/write overlay Layers through the engine
 * (the only sanctioned side-effect channel — modules never touch the canvas).
 * Mirrors shared/ops.ts but for the z-ordered Layer list (Phase 3 creative
 * content: makeup, text, stickers, frames, blend, doodle).
 */
import { newId } from './id';
import type { Engine } from '@/engine';
import type { BlendMode, EditState, Layer, LayerKind, LayerTransform } from '@/engine/editState';

export function identityTransform(): LayerTransform {
  return { x: 0.5, y: 0.5, scaleX: 0.3, scaleY: 0.3, rotation: 0 };
}

export interface NewLayerInit {
  kind: LayerKind;
  payload: Record<string, unknown>;
  transform?: Partial<LayerTransform>;
  opacity?: number;
  blendMode?: BlendMode;
  anchor?: Layer['anchor'];
}

/** Create and append a layer; returns the new layer id. */
export function addLayer(engine: Engine, init: NewLayerInit): string {
  const id = newId('layer');
  const layer: Layer = {
    id,
    kind: init.kind,
    transform: { ...identityTransform(), ...init.transform },
    opacity: init.opacity ?? 1,
    blendMode: init.blendMode ?? 'normal',
    anchor: init.anchor ?? null,
    payload: init.payload,
    enabled: true,
  };
  engine.dispatch({ kind: 'layer/add', layer });
  return id;
}

export function updateLayer(
  engine: Engine,
  id: string,
  patch: Partial<Layer>,
  coalesceKey?: string,
): void {
  engine.dispatch({ kind: 'layer/update', id, patch, coalesceKey });
}

/** Merge a partial patch into a layer's payload (reads current payload first). */
export function patchPayload(
  engine: Engine,
  id: string,
  payloadPatch: Record<string, unknown>,
  coalesceKey?: string,
): void {
  const layer = engine.getState().layers.find((l) => l.id === id);
  if (!layer) return;
  engine.dispatch({
    kind: 'layer/update',
    id,
    patch: { payload: { ...layer.payload, ...payloadPatch } },
    coalesceKey,
  });
}

export function removeLayer(engine: Engine, id: string): void {
  engine.dispatch({ kind: 'layer/remove', id });
}

export function reorderLayer(engine: Engine, id: string, toIndex: number): void {
  engine.dispatch({ kind: 'layer/reorder', id, toIndex });
}

export function layersOfKind(state: EditState, kind: LayerKind): Layer[] {
  return state.layers.filter((l) => l.kind === kind);
}

/** Map a semantic BlendMode to the Canvas2D globalCompositeOperation string. */
export function canvasBlend(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case 'multiply':
      return 'multiply';
    case 'screen':
      return 'screen';
    case 'overlay':
      return 'overlay';
    case 'softLight':
      return 'soft-light';
    case 'hardLight':
      return 'hard-light';
    case 'darken':
      return 'darken';
    case 'lighten':
      return 'lighten';
    default:
      return 'source-over';
  }
}
