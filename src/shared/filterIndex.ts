/**
 * Shared filter catalogue loaded from /filters/index.json (data-model.md
 * AssetLibrary). A filter is a named set of adjust-domain params applied at an
 * intensity, so the pixel pipeline reuses the adjust shader (no LUT assets).
 * Adding a filter is a content drop — no code change (FR-303 / T046).
 */
import type { AdjustParams } from '@/engine/editState';

export interface FilterDef {
  id: string;
  category: string;
  nameKey: string;
  adjust: Partial<AdjustParams>;
  /** Hidden until unlocked via the gift layer (settings.unlocks); T100. */
  secret?: boolean;
}

let cache: FilterDef[] | null = null;
let inflight: Promise<FilterDef[]> | null = null;

export async function loadFilters(): Promise<FilterDef[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch('/filters/index.json')
    .then((r) => r.json())
    .then((j: { filters: FilterDef[] }) => {
      cache = j.filters ?? [];
      return cache;
    })
    .catch(() => {
      cache = [];
      return cache;
    });
  return inflight;
}

export function filtersLoaded(): boolean {
  return cache != null;
}

export function getFilterSync(id: string): FilterDef | undefined {
  return cache?.find((f) => f.id === id);
}

export function allFiltersSync(): FilterDef[] {
  return cache ?? [];
}
