/**
 * Sticker library index loader (US3.3, FR-303). The library is a content drop:
 * add a file under public/stickers/ and an entry to index.json — no code change.
 * The service worker runtime-caches /stickers/ so placed stickers work offline.
 */
export interface StickerEntry {
  id: string;
  category?: string;
  file: string;
  addedAt?: number;
  /** Optional intrinsic aspect (w/h); falls back to the decoded image. */
  aspect?: number;
}

export function stickerSrc(entry: StickerEntry): string {
  return `/stickers/${entry.file}`;
}

export async function loadStickers(): Promise<StickerEntry[]> {
  try {
    const res = await fetch('/stickers/index.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const data = (await res.json()) as { stickers?: StickerEntry[] };
    return data.stickers ?? [];
  } catch {
    return [];
  }
}
