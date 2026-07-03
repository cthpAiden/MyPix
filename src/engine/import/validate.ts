/**
 * Import validation & typed errors (US1.1, T037). Error codes map 1:1 to
 * `errors.*` i18n keys so the UI shows a bilingual message.
 */
export type ImportErrorCode =
  | 'unsupportedFormat'
  | 'corruptImage'
  | 'zeroDimension'
  | 'importFailed';

export class ImportError extends Error {
  constructor(readonly code: ImportErrorCode) {
    super(code);
    this.name = 'ImportError';
  }
}

const SUPPORTED = /^image\/(jpeg|png|webp|heic|heif|gif|bmp|avif)$/i;

export function validateSource(source: File | Blob): void {
  if (source.size === 0) throw new ImportError('corruptImage');
  const type = source.type;
  // Empty type is allowed (some pickers omit it); a known-unsupported type isn't.
  if (type && !SUPPORTED.test(type)) throw new ImportError('unsupportedFormat');
}

export function validateBitmap(bitmap: ImageBitmap | null): asserts bitmap is ImageBitmap {
  if (!bitmap || bitmap.width === 0 || bitmap.height === 0) {
    throw new ImportError('zeroDimension');
  }
}
