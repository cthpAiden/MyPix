/**
 * Session-scoped store owning the object-URL lifetime of user-picked overlay
 * images (blend double-exposure, collage cells).
 *
 * A picked file becomes a `blob:` URL that pins a full decoded image in memory
 * until it is revoked — but that URL stays reachable through undo/redo history
 * for the whole project, so it CANNOT be revoked the moment a layer swaps it out
 * (an undo would then restore a payload pointing at a dead URL and show nothing).
 * Instead layers persist only a stable `assetId`; the store maps id → object URL
 * and revokes them past the point history can reach them: `clear()` when the
 * project closes, or `retain()` at project open (history has just reset, so any
 * asset the newly adopted state no longer references is unreachable). Storing the
 * id rather than the volatile URL also means a serialized draft carries no dead
 * `blob:` URL across a reload.
 */
import { newId } from '@/shared/id';
import { evictImages } from './layerAssets';

export class AssetStore {
  private urls = new Map<string, string>();

  /** Take ownership of a picked file; returns the stable id for its object URL. */
  register(file: Blob): string {
    const id = newId('asset');
    this.urls.set(id, URL.createObjectURL(file));
    return id;
  }

  /** The object URL for an asset id, or undefined if unknown/already released. */
  url(id: string): string | undefined {
    return this.urls.get(id);
  }

  /** Revoke and forget every asset except those the given ids still reference. */
  retain(keepIds: Iterable<string>): void {
    const keep = new Set(keepIds);
    const freed: string[] = [];
    for (const [id, url] of this.urls) {
      if (keep.has(id)) continue;
      URL.revokeObjectURL(url);
      freed.push(url);
      this.urls.delete(id);
    }
    evictImages(freed);
  }

  /** Revoke and forget every asset this store owns (project/collage close). */
  clear(): void {
    this.retain([]);
  }
}

/** Engine-scoped blend assets; retained at project open, cleared at close. */
export const blendAssets = new AssetStore();
