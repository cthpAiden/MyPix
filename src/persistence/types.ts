/** Persisted record shapes (data-model.md, contracts/persistence.md). */
import type { EditState, AnyOperation } from '@/engine/editState';
import type { ImageFingerprint } from '@/engine/types';

export interface Draft {
  id: string;
  editState: EditState; // never pixels
  fingerprint: ImageFingerprint;
  /** Indexable fingerprint key for O(1) re-link lookup. */
  fpKey: string;
  fileName: string;
  thumbDataUrl: string; // ≤ ~50 KB — the one tiny allowed raster
  savedAt: number;
}

export interface Preset {
  id: string;
  name: string;
  schemaVersion: number;
  operations: AnyOperation[]; // portable types only
  sortOrder: number;
  createdAt: number;
}

export type ExportFormat = 'png' | 'jpeg';

export interface Settings {
  locale: 'en' | 'vi';
  soundEnabled: boolean;
  exportDefaults: { format: ExportFormat; jpegQuality: number };
  unlocks: string[];
}

export function defaultSettings(): Settings {
  return {
    locale: 'en',
    soundEnabled: true,
    exportDefaults: { format: 'jpeg', jpegQuality: 0.92 },
    unlocks: [],
  };
}

export function fingerprintKey(fp: ImageFingerprint): string {
  return `${fp.byteSize}_${fp.width}x${fp.height}_${fp.sampleHash}`;
}
