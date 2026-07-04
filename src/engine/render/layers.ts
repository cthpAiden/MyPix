/**
 * Overlay layer compositor (Phase 3 — T079/T082). Draws the EditState's
 * z-ordered Layer list onto a 2D context that already holds the rendered photo:
 * makeup (landmark-anchored), text, stickers, frames, blend images, doodles.
 *
 * The SAME function draws the working-resolution preview (orchestrator) and each
 * full-resolution export band (rasterizeLayers), so overlays are resolution-
 * independent and preview ≡ export (SC-003, FR-309). All layer coordinates are
 * output-normalized [0,1] except makeup, which re-derives geometry from
 * landmarks every call so it tracks the face.
 */
import { canvasBlend } from '@/shared/layers';
import { fontCss } from '@/shared/fonts';
import { makeupShapes } from './makeupShapes';
import { getImage } from './layerAssets';
import type {
  BlendPayload,
  DoodlePayload,
  FramePayload,
  Layer,
  LayerKind,
  MakeupPayload,
  Point2D,
  StickerPayload,
  TextPayload,
} from '@/engine/editState';
import type { DetectedLandmarkSet } from '@/vision/types';

/**
 * The layer kinds drawLayers composites. Must equal editState LAYER_KINDS so
 * every creative layer rasterizes into the full-resolution export (FR-309); a
 * unit test asserts the two sets match (T098).
 */
export const HANDLED_LAYER_KINDS: readonly LayerKind[] = [
  'makeup',
  'text',
  'sticker',
  'frame',
  'blendImage',
  'doodle',
];

export interface LayerDrawEnv {
  outW: number;
  outH: number;
  landmarks: DetectedLandmarkSet | null;
  imageWidth: number;
  imageHeight: number;
  /** Map an original-normalized point through crop geometry to output-normalized. */
  mapSrc: (p: Point2D) => Point2D;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** URLs a layer set needs decoded before a synchronous composite (export). */
export function layerAssetUrls(layers: Layer[]): string[] {
  const urls: string[] = [];
  for (const l of layers) {
    if (!l.enabled) continue;
    if (l.kind === 'sticker') urls.push((l.payload as unknown as StickerPayload).src);
    else if (l.kind === 'blendImage') urls.push((l.payload as unknown as BlendPayload).src);
  }
  return urls.filter(Boolean);
}

export function drawLayers(g: Ctx, layers: Layer[], env: LayerDrawEnv): void {
  for (const layer of layers) {
    if (!layer.enabled) continue;
    g.save();
    g.globalAlpha = clamp01(layer.opacity);
    g.globalCompositeOperation = canvasBlend(layer.blendMode);
    switch (layer.kind) {
      case 'makeup':
        drawMakeup(g, layer, env);
        break;
      case 'text':
        drawText(g, layer, env);
        break;
      case 'sticker':
        drawSticker(g, layer, env);
        break;
      case 'frame':
        drawFrame(g, layer, env);
        break;
      case 'blendImage':
        drawBlend(g, layer, env);
        break;
      case 'doodle':
        drawDoodle(g, layer, env);
        break;
      default:
        // Exhaustiveness guard: a new LayerKind without a draw case (and thus
        // absent from the export composite) fails the type check here (FR-309).
        ((_: never) => void _)(layer.kind);
    }
    g.restore();
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/* ------------------------------- makeup -------------------------------- */

function drawMakeup(g: Ctx, layer: Layer, env: LayerDrawEnv): void {
  const p = layer.payload as unknown as MakeupPayload;
  const faces = env.landmarks?.faces ?? [];
  const face = faces[p.faceIndex] ?? faces[env.landmarks?.selectedFaceIndex ?? 0];
  if (!face) return; // landmark-dependent → no-op when the face is absent

  const shape = makeupShapes(p.makeupType, face, env.imageWidth, env.imageHeight);
  const minDim = Math.min(env.outW, env.outH);
  const toPx = (pt: Point2D): Point2D => {
    const o = env.mapSrc(pt);
    return { x: o.x * env.outW, y: o.y * env.outH };
  };

  g.globalAlpha = clamp01(layer.opacity * p.intensity);
  g.fillStyle = p.color;
  g.strokeStyle = p.color;
  const feather = shape.softRel * minDim;
  try {
    g.filter = `blur(${feather.toFixed(1)}px)`;
  } catch {
    /* filter unsupported — hard edges are an acceptable fallback */
  }

  for (const poly of shape.fills) {
    if (poly.length < 3) continue;
    tracePath(g, poly.map(toPx), true);
    g.fill();
  }
  for (const s of shape.strokes) {
    if (s.path.length < 2) continue;
    g.lineWidth = Math.max(1, s.widthRel * minDim);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    tracePath(g, s.path.map(toPx), false);
    g.stroke();
  }
  for (const b of shape.blobs) {
    const c = toPx({ x: b.cx, y: b.cy });
    const rx = b.rx * env.outW;
    const ry = b.ry * env.outH;
    // Map a unit circle to the rx-by-ry ellipse. (The previous max(rx,ry)
    // circle + single-axis scale collapsed to a circle of the larger radius
    // whenever ry > rx — i.e. every portrait — making blush too wide.)
    g.save();
    g.translate(c.x, c.y);
    g.scale(Math.max(rx, 0.01), Math.max(ry, 0.01));
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, p.color);
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Gloss/shimmer: a soft brighter highlight on top of matte coverage.
  if (p.finish !== 'matte' && shape.fills.length) {
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = clamp01(layer.opacity * p.intensity * (p.finish === 'shimmer' ? 0.35 : 0.22));
    g.fillStyle = '#ffffff';
    for (const poly of shape.fills) {
      if (poly.length < 3) continue;
      tracePath(g, poly.map(toPx), true);
      g.fill();
    }
  }
}

function tracePath(g: Ctx, pts: Point2D[], close: boolean): void {
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  if (close) g.closePath();
}

/* -------------------------------- text --------------------------------- */

function drawText(g: Ctx, layer: Layer, env: LayerDrawEnv): void {
  const p = layer.payload as unknown as TextPayload;
  if (!p.content) return;
  const px = Math.max(6, p.sizeRel * env.outH);
  const cx = layer.transform.x * env.outW;
  const cy = layer.transform.y * env.outH;
  const lines = p.content.split('\n');
  const lineH = px * 1.28; // generous leading so stacked tone marks never clip

  g.translate(cx, cy);
  if (layer.transform.rotation) g.rotate(layer.transform.rotation);
  g.font = fontCss(p.fontId, px);
  g.textAlign = p.align;
  g.textBaseline = 'middle';

  if (p.shadow) {
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = px * 0.16;
    g.shadowOffsetY = px * 0.04;
  }

  const startY = -((lines.length - 1) * lineH) / 2;
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineH;
    if (p.outline > 0) {
      g.shadowColor = 'transparent';
      g.lineWidth = px * 0.08 * p.outline;
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.strokeText(lines[i], 0, y);
      if (p.shadow) {
        g.shadowColor = 'rgba(0,0,0,0.55)';
        g.shadowBlur = px * 0.16;
      }
    }
    g.fillStyle = p.color;
    g.fillText(lines[i], 0, y);
  }
}

/* ------------------------------- sticker ------------------------------- */

function drawSticker(g: Ctx, layer: Layer, env: LayerDrawEnv): void {
  const p = layer.payload as unknown as StickerPayload;
  const img = getImage(p.src);
  if (!img) return;
  const w = layer.transform.scaleX * env.outW;
  const aspect = p.aspect || (img.width && img.height ? img.width / img.height : 1);
  const h = w / aspect;
  g.translate(layer.transform.x * env.outW, layer.transform.y * env.outH);
  if (layer.transform.rotation) g.rotate(layer.transform.rotation);
  g.drawImage(img as CanvasImageSource, -w / 2, -h / 2, w, h);
}

/* -------------------------------- frame -------------------------------- */

function drawFrame(g: Ctx, layer: Layer, env: LayerDrawEnv): void {
  const p = layer.payload as unknown as FramePayload;
  const { outW, outH } = env;
  const t = Math.max(1, p.width * Math.min(outW, outH));

  if (p.style === 'filmstrip') {
    g.fillStyle = p.color;
    g.fillRect(0, 0, outW, t);
    g.fillRect(0, outH - t, outW, t);
    // Sprocket holes.
    g.fillStyle = 'rgba(255,255,255,0.85)';
    const holeW = t * 0.5;
    const holeH = t * 0.32;
    const gap = holeW * 2;
    for (let x = gap; x < outW - holeW; x += gap) {
      g.fillRect(x, t * 0.34, holeW, holeH);
      g.fillRect(x, outH - t + t * 0.34, holeW, holeH);
    }
    return;
  }

  if (p.style === 'instant') {
    // Instant-photo: even border, thick chin at the bottom.
    g.fillStyle = p.color;
    g.fillRect(0, 0, outW, t);
    g.fillRect(0, 0, t, outH);
    g.fillRect(outW - t, 0, t, outH);
    g.fillRect(0, outH - t * 3, outW, t * 3);
    return;
  }

  // Solid color border on all four edges.
  g.fillStyle = p.color;
  g.fillRect(0, 0, outW, t);
  g.fillRect(0, outH - t, outW, t);
  g.fillRect(0, 0, t, outH);
  g.fillRect(outW - t, 0, t, outH);
}

/* ---------------------------- blend image ------------------------------ */

function drawBlend(g: Ctx, layer: Layer, env: LayerDrawEnv): void {
  const p = layer.payload as unknown as BlendPayload;
  const img = getImage(p.src);
  if (!img) return;
  // Cover-fit the second image across the whole frame.
  const iw = img.width;
  const ih = img.height;
  const scale = Math.max(env.outW / iw, env.outH / ih);
  const w = iw * scale;
  const h = ih * scale;
  g.drawImage(img as CanvasImageSource, (env.outW - w) / 2, (env.outH - h) / 2, w, h);
}

/* -------------------------------- doodle ------------------------------- */

function drawDoodle(g: Ctx, layer: Layer, env: LayerDrawEnv): void {
  const p = layer.payload as unknown as DoodlePayload;
  const minDim = Math.min(env.outW, env.outH);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const stroke of p.strokes) {
    if (stroke.points.length < 1) continue;
    g.strokeStyle = stroke.color;
    g.lineWidth = Math.max(1, stroke.width * minDim);
    g.beginPath();
    const p0 = stroke.points[0];
    g.moveTo(p0.x * env.outW, p0.y * env.outH);
    if (stroke.points.length === 1) {
      // A dot.
      g.lineTo(p0.x * env.outW + 0.01, p0.y * env.outH);
    } else {
      for (let i = 1; i < stroke.points.length; i++) {
        g.lineTo(stroke.points[i].x * env.outW, stroke.points[i].y * env.outH);
      }
    }
    g.stroke();
  }
}
