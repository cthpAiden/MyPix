/**
 * Native-first decode with heic2any lazy fallback and EXIF-orientation applied,
 * normalized into the working color space, producing an OriginalImage
 * (US1.1, T032, research R9/R14).
 */
import { detectColorSpace } from '@/engine/color/space';
import { ImportError, validateBitmap, validateSource } from './validate';
import type { ImageFingerprint, OriginalImage } from '@/engine/types';

async function decodeNative(source: Blob): Promise<ImageBitmap> {
  // imageOrientation:'from-image' applies EXIF orientation at decode time.
  return createImageBitmap(source, { imageOrientation: 'from-image' });
}

async function decodeHeic(source: Blob): Promise<ImageBitmap> {
  const heic2any = (await import('heic2any')).default;
  const converted = (await heic2any({ blob: source, toType: 'image/jpeg', quality: 0.95 })) as
    | Blob
    | Blob[];
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return createImageBitmap(blob, { imageOrientation: 'from-image' });
}

/** Small perceptual fingerprint for draft re-linking (story 1.8). */
async function computeFingerprint(
  source: Blob,
  bitmap: ImageBitmap,
): Promise<ImageFingerprint> {
  const N = 16;
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(N, N)
      : Object.assign(document.createElement('canvas'), { width: N, height: N });
  const ctx = (canvas as HTMLCanvasElement).getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, N, N);
  const data = ctx.getImageData(0, 0, N, N).data;
  // FNV-1a over the downsample.
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i += 4) {
    hash ^= data[i];
    hash = Math.imul(hash, 0x01000193);
    hash ^= data[i + 1];
    hash = Math.imul(hash, 0x01000193);
    hash ^= data[i + 2];
    hash = Math.imul(hash, 0x01000193);
  }
  return {
    byteSize: source.size,
    width: bitmap.width,
    height: bitmap.height,
    sampleHash: (hash >>> 0).toString(16),
  };
}

export async function decodePhoto(source: File | Blob): Promise<OriginalImage> {
  validateSource(source);

  const fileName = source instanceof File ? source.name : 'photo.jpg';
  const mimeType = source.type || 'image/jpeg';
  const isHeic = /heic|heif/i.test(mimeType) || /\.hei[cf]$/i.test(fileName);

  let bitmap: ImageBitmap;
  try {
    bitmap = isHeic ? await decodeNative(source).catch(() => decodeHeic(source)) : await decodeNative(source);
  } catch {
    try {
      bitmap = await decodeHeic(source);
    } catch {
      throw new ImportError('importFailed');
    }
  }

  validateBitmap(bitmap);
  const fingerprint = await computeFingerprint(source, bitmap);

  return {
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    colorSpace: detectColorSpace(),
    mimeType,
    fileName,
    fingerprint,
  };
}
