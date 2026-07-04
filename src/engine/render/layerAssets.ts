/**
 * Synchronous-read image cache for overlay layers (stickers, frames, blend/
 * collage photos). The compositor runs inside a single synchronous paint, so it
 * can only draw images that are already decoded. `getImage` returns a decoded
 * image if cached, else null and kicks off the load; when a load finishes it
 * notifies subscribers (the orchestrator re-renders). `preload` awaits a set of
 * URLs before an export composite.
 */
type Loaded = HTMLImageElement | ImageBitmap;

const cache = new Map<string, Loaded>();
const inflight = new Map<string, Promise<Loaded | null>>();
const failed = new Set<string>();
const listeners = new Set<() => void>();

export function onAssetLoad(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(): void {
  for (const cb of listeners) cb();
}

function loadImage(src: string): Promise<Loaded | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function startLoad(src: string): Promise<Loaded | null> {
  const existing = inflight.get(src);
  if (existing) return existing;
  const p = loadImage(src).then((res) => {
    inflight.delete(src);
    if (res) {
      cache.set(src, res);
      notify();
    } else {
      failed.add(src);
    }
    return res;
  });
  inflight.set(src, p);
  return p;
}

/** Cached decoded image, or null (loading started in the background). */
export function getImage(src: string): Loaded | null {
  if (!src) return null;
  const hit = cache.get(src);
  if (hit) return hit;
  if (!failed.has(src)) void startLoad(src);
  return null;
}

/** Await all given URLs so a synchronous composite (export) can draw them. */
export async function preloadAssets(srcs: string[]): Promise<void> {
  await Promise.all(
    [...new Set(srcs)].filter(Boolean).map((s) => (cache.has(s) ? Promise.resolve() : startLoad(s))),
  );
}

/**
 * Drop the decoded images for the given URLs so their pixels can be GC'd. The
 * cache is keyed by URL, so when an owning object URL is revoked (project close)
 * its decode would otherwise stay pinned here forever — the AssetStore calls
 * this alongside revokeObjectURL.
 */
export function evictImages(srcs: string[]): void {
  for (const s of srcs) {
    cache.delete(s);
    inflight.delete(s);
    failed.delete(s);
  }
}
