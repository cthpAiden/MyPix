/** Shared engine-level types (Project, image, export) — data-model.md. */
import type { AspectRatioId } from './editState/types';
import type { WorkingColorSpace } from './color/space';

export interface ImageFingerprint {
  byteSize: number;
  width: number;
  height: number;
  /** Hash of a downsampled sample — cheap re-link key (story 1.8). */
  sampleHash: string;
}

export interface OriginalImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  colorSpace: WorkingColorSpace;
  mimeType: string;
  fileName: string;
  fingerprint: ImageFingerprint;
}

export interface Project {
  id: string;
  original: OriginalImage;
  createdAt: number;
  modifiedAt: number;
}

export type CompareMode = 'off' | 'hold-original' | { divider: number };

export interface ExportJob {
  format: 'png' | 'jpeg';
  jpegQuality: number; // ~0.92 default; ignored for PNG
  ratio: AspectRatioId; // 'free' = full frame
  transparentBackground: boolean; // PNG-only (Phase 2)
  delivery: 'share' | 'download';
  onProgress?: (done: number, total: number) => void;
}

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  fileName: string;
  delivered: 'shared' | 'downloaded' | 'cancelled';
}
