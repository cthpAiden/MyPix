/**
 * Landmark-region mask rasterization (research R6, used by skin/targeted/bg).
 *
 * Builds a feathered single-channel mask (packed into RGBA8, value in R) from a
 * filled outer polygon minus hole polygons — e.g. the skin mask = face-oval
 * minus eyes/brows/lips. Polygons are in normalized [0,1] image space and in
 * contour order. Feathering is a separable box blur so strength ramps smoothly
 * at the region edge (no hard cut-outs).
 */
import type { Point2D } from '@/engine/editState';

/** Even-odd point-in-polygon test. */
export function pointInPolygon(px: number, py: number, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function featherChannel(src: Float32Array, res: number, radius: number): Float32Array {
  const r = Math.round(radius);
  if (r < 1) return src;
  const tmp = new Float32Array(res * res);
  const out = new Float32Array(res * res);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[y * res + Math.min(res - 1, Math.max(0, x + k))];
      tmp[y * res + x] = sum * norm;
    }
  }
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[Math.min(res - 1, Math.max(0, y + k)) * res + x];
      out[y * res + x] = sum * norm;
    }
  }
  return out;
}

/** Pack a single 0…1 channel into an RGBA8 buffer (value in R,G,B; A=255). */
function pack(channel: Float32Array, res: number): Uint8Array {
  const buf = new Uint8Array(res * res * 4);
  for (let i = 0; i < channel.length; i++) {
    const v = Math.round(Math.max(0, Math.min(1, channel[i])) * 255);
    buf[i * 4] = v;
    buf[i * 4 + 1] = v;
    buf[i * 4 + 2] = v;
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

/**
 * Rasterize `outer` minus `holes` into a feathered RGBA8 mask (res×res). Row 0
 * = v 0 to match the GL data-texture upload orientation.
 */
export function rasterizePolygonMask(
  res: number,
  outer: Point2D[],
  holes: Point2D[][],
  feather = 3,
): Uint8Array {
  const channel = new Float32Array(res * res);
  for (let y = 0; y < res; y++) {
    const ny = (y + 0.5) / res;
    for (let x = 0; x < res; x++) {
      const nx = (x + 0.5) / res;
      let v = 0;
      if (pointInPolygon(nx, ny, outer)) {
        v = 1;
        for (const hole of holes) {
          if (pointInPolygon(nx, ny, hole)) {
            v = 0;
            break;
          }
        }
      }
      channel[y * res + x] = v;
    }
  }
  return pack(featherChannel(channel, res, feather), res);
}

/** Rasterize a single filled polygon (no holes) as a feathered mask. */
export function rasterizeFilledMask(res: number, poly: Point2D[], feather = 2): Uint8Array {
  return rasterizePolygonMask(res, poly, [], feather);
}

/** Rasterize the union of several filled polygons as one feathered mask. */
export function rasterizeMultiFilledMask(res: number, polys: Point2D[][], feather = 2): Uint8Array {
  const channel = new Float32Array(res * res);
  for (let y = 0; y < res; y++) {
    const ny = (y + 0.5) / res;
    for (let x = 0; x < res; x++) {
      const nx = (x + 0.5) / res;
      let v = 0;
      for (const poly of polys) {
        if (pointInPolygon(nx, ny, poly)) {
          v = 1;
          break;
        }
      }
      channel[y * res + x] = v;
    }
  }
  return pack(featherChannel(channel, res, feather), res);
}

/** Extract the R channel (0…1) from an RGBA8 mask buffer. */
export function maskChannel(mask: Uint8Array): Float32Array {
  const out = new Float32Array(mask.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = mask[i * 4] / 255;
  return out;
}
