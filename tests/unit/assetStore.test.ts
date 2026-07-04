/**
 * AssetStore lifetime (blend/collage picked-image leak fix). The store owns the
 * object URL of every picked overlay image and must revoke them to free memory —
 * but never while undo/redo history can still reach a swapped-out image. These
 * tests pin that history-aware contract: a swap keeps the old asset alive, and
 * revocation happens only at retain()/clear() (project open/close).
 *
 * jsdom does not implement the object-URL APIs, so we install spy-able stubs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetStore } from '@/engine/render/assetStore';

let created: string[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const u = `blob:mock/${created.length}`;
    created.push(u);
    return u;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u: string) => {
    revoked.push(u);
  });
});

afterEach(() => vi.restoreAllMocks());

// jsdom leaves these unimplemented; ensure the properties exist so spyOn works.
if (!URL.createObjectURL) URL.createObjectURL = () => '';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};

describe('AssetStore', () => {
  it('registers files to distinct, resolvable ids', () => {
    const store = new AssetStore();
    const a = store.register(new Blob(['a']));
    const b = store.register(new Blob(['b']));
    expect(a).not.toBe(b);
    expect(store.url(a)).toBe('blob:mock/0');
    expect(store.url(b)).toBe('blob:mock/1');
  });

  it('does NOT revoke a swapped-out asset — undo can still reach it', () => {
    const store = new AssetStore();
    const first = store.register(new Blob(['old']));
    // A "swap" registers a replacement but leaves the old payload in history.
    store.register(new Blob(['new']));
    expect(revoked).toEqual([]);
    expect(store.url(first)).toBe('blob:mock/0'); // still live for undo
  });

  it('retain() frees only the assets the kept ids no longer reference', () => {
    const store = new AssetStore();
    const drop = store.register(new Blob(['drop']));
    const keep = store.register(new Blob(['keep']));
    store.retain([keep]);
    expect(revoked).toEqual(['blob:mock/0']);
    expect(store.url(drop)).toBeUndefined();
    expect(store.url(keep)).toBe('blob:mock/1');
  });

  it('clear() revokes and forgets every asset', () => {
    const store = new AssetStore();
    const a = store.register(new Blob(['a']));
    const b = store.register(new Blob(['b']));
    store.clear();
    expect(new Set(revoked)).toEqual(new Set(['blob:mock/0', 'blob:mock/1']));
    expect(store.url(a)).toBeUndefined();
    expect(store.url(b)).toBeUndefined();
  });
});
