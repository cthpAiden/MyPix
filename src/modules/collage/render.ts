/**
 * Collage renderer (US3.7, T088). Pure function that paints a CollageProject
 * into a square canvas context at any pixel size — shared by the live preview
 * and the high-resolution export so what you see is what you get.
 */
import { layoutById, type CollageProject } from './types';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function coverDraw(g: Ctx, img: CanvasImageSource, x: number, y: number, w: number, h: number): void {
  const iw = (img as { width: number }).width;
  const ih = (img as { height: number }).height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * Draw the collage. `imageFor(index)` returns the decoded image for a cell, or
 * null (drawn as an empty placeholder).
 */
export function drawCollage(
  g: Ctx,
  project: CollageProject,
  size: number,
  imageFor: (index: number) => CanvasImageSource | null,
): void {
  g.clearRect(0, 0, size, size);
  g.fillStyle = project.background;
  g.fillRect(0, 0, size, size);

  const layout = layoutById(project.layoutId);
  const gap = project.spacing * size * 0.06;
  const radius = project.radius * size * 0.08;

  layout.cells.forEach((cell, i) => {
    const x = cell.x * size + gap / 2;
    const y = cell.y * size + gap / 2;
    const w = cell.w * size - gap;
    const h = cell.h * size - gap;
    g.save();
    roundRect(g, x, y, w, h, radius);
    g.clip();
    const img = imageFor(i);
    if (img) {
      coverDraw(g, img, x, y, w, h);
    } else {
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(x, y, w, h);
    }
    g.restore();
  });
}
