/**
 * Full-resolution encoders (US1.1, T035). JPEG via @jsquash (MozJPEG-class
 * WASM) and PNG via fast-png, both fed raw RGBA — never a full-size canvas, so
 * the iOS canvas limit is sidestepped. Display-P3 ICC embedding is attempted
 * where the working space is P3 (best-effort seam; research R14).
 */
import { getICCProfile, workingColorSpace } from '@/engine/color/space';

export async function encodeJpeg(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const encode = (await import('@jsquash/jpeg/encode')).default;
  const image = { data: rgba, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
  const buffer = await encode(image as ImageData, { quality: Math.round(quality * 100) });
  const bytes = new Uint8Array(buffer);
  const iccWrapped = await maybeEmbedICCJpeg(bytes);
  return new Blob([iccWrapped as BlobPart], { type: 'image/jpeg' });
}

export async function encodePng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Blob> {
  const { encode } = await import('fast-png');
  const png = encode({
    width,
    height,
    data: new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength),
    channels: 4,
    depth: 8,
  });
  return new Blob([png as BlobPart], { type: 'image/png' });
}

/** Insert an APP2 ICC segment after SOI if a P3 profile is available. */
async function maybeEmbedICCJpeg(jpeg: Uint8Array): Promise<Uint8Array> {
  if (workingColorSpace() !== 'display-p3') return jpeg;
  const icc = await getICCProfile('display-p3');
  if (!icc) return jpeg;
  // APP2 "ICC_PROFILE\0" marker (single chunk).
  const header = new TextEncoder().encode('ICC_PROFILE\0');
  const chunkMeta = new Uint8Array([1, 1]); // chunk 1 of 1
  const payloadLen = header.length + chunkMeta.length + icc.length;
  const segLen = payloadLen + 2;
  const segment = new Uint8Array(4 + payloadLen);
  segment[0] = 0xff;
  segment[1] = 0xe2; // APP2
  segment[2] = (segLen >> 8) & 0xff;
  segment[3] = segLen & 0xff;
  segment.set(header, 4);
  segment.set(chunkMeta, 4 + header.length);
  segment.set(icc, 4 + header.length + chunkMeta.length);

  // Insert right after SOI (first 2 bytes 0xFFD8).
  const out = new Uint8Array(jpeg.length + segment.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(segment, 2);
  out.set(jpeg.subarray(2), 2 + segment.length);
  return out;
}
