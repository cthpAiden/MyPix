import { describe, expect, it } from 'vitest';
import {
  defaultAdjust,
  emptyEditState,
  reduce,
  serialize,
  deserialize,
  clampParams,
} from '@/engine/editState';
import type { AnyOperation, EditState } from '@/engine/editState';
import { newId } from '@/shared/id';

function adjustOp(over: Partial<ReturnType<typeof defaultAdjust>> = {}): AnyOperation {
  return {
    id: newId('op'),
    type: 'adjust',
    enabled: true,
    params: { ...defaultAdjust(), ...over },
  };
}

describe('reducer clamping', () => {
  it('clamps out-of-range adjust params on op/add', () => {
    const op = adjustOp({ brightness: 500, contrast: -9999, temperature: 42 });
    const next = reduce(emptyEditState(), { kind: 'op/add', op });
    const added = next.operations[0].params as ReturnType<typeof defaultAdjust>;
    expect(added.brightness).toBe(100);
    expect(added.contrast).toBe(-100);
    expect(added.temperature).toBe(42);
  });

  it('clamps on op/update merge', () => {
    const op = adjustOp();
    let state = reduce(emptyEditState(), { kind: 'op/add', op });
    state = reduce(state, { kind: 'op/update', id: op.id, params: { saturation: 250 } });
    const p = state.operations[0].params as ReturnType<typeof defaultAdjust>;
    expect(p.saturation).toBe(100);
  });

  it('enforces filter intensity 0…1', () => {
    const clamped = clampParams('filter', { filterId: 'noir', intensity: 3 });
    expect(clamped.intensity).toBe(1);
  });

  it('keeps curve points sorted and in-range', () => {
    const clamped = clampParams('curves', {
      points: {
        rgb: [
          { x: 1.4, y: -0.2 },
          { x: 0.2, y: 0.9 },
          { x: 0.2, y: 0.3 },
        ],
        r: [{ x: 0, y: 0 }],
        g: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        b: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    });
    // duplicate x collapsed, sorted ascending, coords clamped
    expect(clamped.points.rgb.map((p) => p.x)).toEqual([0.2, 1]);
    expect(clamped.points.rgb.every((p) => p.y >= 0 && p.y <= 1)).toBe(true);
    // degenerate single-point channel falls back to linear
    expect(clamped.points.r).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });
});

describe('reducer no-op guards (no dead undo steps)', () => {
  it('op/toggle to the same enabled value returns the same state object', () => {
    const op = adjustOp();
    const state = reduce(emptyEditState(), { kind: 'op/add', op });
    const same = reduce(state, { kind: 'op/toggle', id: op.id, enabled: true });
    expect(same).toBe(state); // enabled was already true
  });

  it('op/toggle with an unknown id returns the same state object', () => {
    const state = reduce(emptyEditState(), { kind: 'op/add', op: adjustOp() });
    expect(reduce(state, { kind: 'op/toggle', id: 'nope', enabled: false })).toBe(state);
  });

  it('layer/update with an unknown id returns the same state object', () => {
    const state = emptyEditState();
    expect(reduce(state, { kind: 'layer/update', id: 'ghost', patch: { opacity: 0.5 } })).toBe(state);
  });
});

describe('crop clamp keeps the rect inside the image', () => {
  it('x + w never exceeds 1 even at extreme x', () => {
    const c = clampParams('crop', {
      rect: { x: 0.99, y: 0.97, w: 1, h: 1 },
      angle: 0,
      rotate90: 0,
      quad: null,
      ratio: 'free',
    });
    expect(c.rect.x + c.rect.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(c.rect.y + c.rect.h).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe('serialize round-trip', () => {
  it('deserialize(serialize(s)) deep-equals s', () => {
    const state: EditState = reduce(emptyEditState(), {
      kind: 'op/add',
      op: adjustOp({ brightness: 20, vibrance: -15 }),
    });
    const roundTripped = deserialize(serialize(state));
    expect(roundTripped).toEqual(state);
  });

  it('round-trips layers and multiple ops', () => {
    let state = emptyEditState();
    state = reduce(state, { kind: 'op/add', op: adjustOp({ contrast: 10 }) });
    state = reduce(state, {
      kind: 'op/add',
      op: { id: newId('op'), type: 'filter', enabled: true, params: { filterId: 'portra', intensity: 0.6 } },
    });
    state = reduce(state, {
      kind: 'layer/add',
      layer: {
        id: newId('lyr'),
        kind: 'text',
        transform: { x: 0.1, y: 0.2, scaleX: 1, scaleY: 1, rotation: 0 },
        opacity: 1,
        blendMode: 'normal',
        anchor: null,
        payload: { content: 'Chào', fontId: 'be-vietnam' },
        enabled: true,
      },
    });
    expect(deserialize(serialize(state))).toEqual(state);
  });
});
