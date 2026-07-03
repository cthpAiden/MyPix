import { describe, expect, it } from 'vitest';
import { encodePreset, decodePreset, PresetCodeError } from '@/persistence/presetCode';
import { defaultAdjust, defaultFinishing } from '@/engine/editState';
import type { AnyOperation } from '@/engine/editState';
import { newId } from '@/shared/id';

const ops: AnyOperation[] = [
  { id: newId('op'), type: 'adjust', enabled: true, params: { ...defaultAdjust(), contrast: 22, temperature: -12 } },
  { id: newId('op'), type: 'finishing', enabled: true, params: { ...defaultFinishing(), grain: 30, vignette: -18 } },
];

describe('preset share-code round-trip (story 1.6 acceptance 3)', () => {
  it('importCode(exportCode(p)) preserves name + ops', async () => {
    const code = await encodePreset('Warm portrait', ops);
    expect(code.startsWith('MYPIX1.')).toBe(true);
    const decoded = await decodePreset(code);
    expect(decoded.name).toBe('Warm portrait');
    expect(decoded.ops).toEqual(ops);
  });

  it('rejects a malformed code', async () => {
    await expect(decodePreset('NOPE.abc')).rejects.toBeInstanceOf(PresetCodeError);
  });

  it('drops non-portable ops on encode', async () => {
    const withCrop: AnyOperation[] = [
      ...ops,
      {
        id: newId('op'),
        type: 'crop',
        enabled: true,
        params: { rect: { x: 0, y: 0, w: 1, h: 1 }, angle: 0, rotate90: 0, quad: null, ratio: 'free' },
      },
    ];
    const decoded = await decodePreset(await encodePreset('x', withCrop));
    expect(decoded.ops.every((o) => o.type !== 'crop')).toBe(true);
    expect(decoded.ops).toHaveLength(2);
  });
});
