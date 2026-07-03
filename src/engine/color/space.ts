/**
 * Display-P3 end-to-end color management with a uniform sRGB fallback (R14).
 *
 * The working space is Display-P3: import decodes into a P3 context, GL treats
 * texels as P3-encoded, on-screen canvases are P3 where supported, and export
 * embeds a Display-P3 ICC profile. If P3 canvas support is absent (secondary
 * browsers) the *entire* chain falls back to sRGB — consistency preserved
 * either way (FR-120, SC-003).
 */

export type WorkingColorSpace = 'display-p3' | 'srgb';

let cached: WorkingColorSpace | null = null;

/** Feature-detect wide-gamut canvas support, memoized. */
export function detectColorSpace(): WorkingColorSpace {
  if (cached) return cached;
  if (typeof document === 'undefined') {
    cached = 'srgb';
    return cached;
  }
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d', { colorSpace: 'display-p3' }) as
      | (CanvasRenderingContext2D & { getContextAttributes?: () => { colorSpace?: string } })
      | null;
    const cs = ctx?.getContextAttributes?.().colorSpace;
    cached = cs === 'display-p3' ? 'display-p3' : 'srgb';
  } catch {
    cached = 'srgb';
  }
  return cached;
}

export function workingColorSpace(): WorkingColorSpace {
  return detectColorSpace();
}

/** Create a 2D canvas tagged with the working color space where supported. */
export function createWorkingCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const space = detectColorSpace();
  const ctx =
    (canvas.getContext('2d', { colorSpace: space }) as CanvasRenderingContext2D | null) ??
    canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
}

/**
 * ICC profile bytes to embed at export for the given space. Returns null when
 * no profile is bundled (sRGB is the untagged default; a Display-P3 profile can
 * be dropped at build time). The JPEG/PNG encoders embed the blob when present
 * (T035). Kept as a seam so wide-gamut fidelity can be turned on without
 * touching the encoders.
 */
export async function getICCProfile(space: WorkingColorSpace): Promise<Uint8Array | null> {
  if (space !== 'display-p3') return null;
  try {
    const res = await fetch('/icc/display-p3.icc');
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
