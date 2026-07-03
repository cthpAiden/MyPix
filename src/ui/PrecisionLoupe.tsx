'use client';

/**
 * Offset precision loupe (T026) shared by the eyedropper (Phase 1) and later
 * warp/retouch (Phase 2/3). Shows a magnified crop of the preview canvas,
 * offset above the finger so the point of interest isn't hidden.
 */
import { useEffect, useRef } from 'react';

export function PrecisionLoupe({
  source,
  clientX,
  clientY,
  visible,
  zoom = 2.6,
  size = 116,
}: {
  source: HTMLCanvasElement | null;
  clientX: number;
  clientY: number;
  visible: boolean;
  zoom?: number;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible || !source || !ref.current) return;
    const ctx = ref.current.getContext('2d');
    if (!ctx) return;
    const rect = source.getBoundingClientRect();
    const scaleX = source.width / rect.width;
    const scaleY = source.height / rect.height;
    const sx = (clientX - rect.left) * scaleX;
    const sy = (clientY - rect.top) * scaleY;
    const sw = size / zoom;
    const sh = size / zoom;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, sx - sw / 2, sy - sh / 2, sw, sh, 0, 0, size, size);
    ctx.restore();

    // crosshair
    ctx.strokeStyle = 'rgba(242,163,94,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2 - 8);
    ctx.lineTo(size / 2, size / 2 + 8);
    ctx.moveTo(size / 2 - 8, size / 2);
    ctx.lineTo(size / 2 + 8, size / 2);
    ctx.stroke();
  }, [source, clientX, clientY, visible, zoom, size]);

  if (!visible) return null;
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      aria-hidden
      className="pointer-events-none fixed z-50 rounded-full border-2 border-safelight/70 shadow-lg"
      style={{
        left: clientX - size / 2,
        top: clientY - size - 44,
      }}
    />
  );
}
