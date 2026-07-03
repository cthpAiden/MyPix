/**
 * Draft re-link (US1.8, T055). Compares a re-picked file's fingerprint to the
 * draft's; a mismatch is surfaced explicitly (never a silent wrong-apply).
 */
import { decodePhoto } from './decode';
import type { ImageFingerprint, OriginalImage } from '@/engine/types';

export function fingerprintsMatch(a: ImageFingerprint, b: ImageFingerprint): boolean {
  return a.width === b.width && a.height === b.height && a.sampleHash === b.sampleHash;
}

export interface RelinkProbe {
  original: OriginalImage;
  matches: boolean;
}

/** Decode a re-picked file and report whether it matches the draft's photo. */
export async function probeForRelink(
  file: File | Blob,
  expected: ImageFingerprint,
): Promise<RelinkProbe> {
  const original = await decodePhoto(file);
  return { original, matches: fingerprintsMatch(original.fingerprint, expected) };
}
