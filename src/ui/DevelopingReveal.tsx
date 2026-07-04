'use client';

/**
 * Darkroom "developing" export reveal (T099). While the full-resolution export
 * renders, the current photo emerges from the fixer bath: it starts dark, soft,
 * and desaturated and resolves to sharp, full-colour as progress → 1, under a
 * faint safelight grain. A tabular percentage anchors the metaphor to real
 * progress. Motion collapses to an instant snap under prefers-reduced-motion
 * (tokens.css). Passing a null thumbnail falls back to a bare progress bar.
 */
import { Readout } from '@/ui/primitives';

export function DevelopingReveal({
  progress,
  thumbnail,
  label,
}: {
  /** 0…1 export progress. */
  progress: number;
  /** data-URL snapshot of the preview, or null. */
  thumbnail: string | null;
  label: string;
}) {
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const pct = Math.round(p * 100);

  // Develop curve: heavy blur/dark early, resolving to a clean print.
  const blur = (1 - p) * 12;
  const brightness = 0.35 + p * 0.65;
  const saturate = 0.2 + p * 0.8;
  const opacity = 0.25 + p * 0.75;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      {thumbnail && (
        <div className="relative aspect-square w-40 overflow-hidden rounded-[var(--radius-control)] bg-stage ring-1 ring-hairline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover transition-[filter,opacity] duration-500 ease-out"
            style={{
              filter: `blur(${blur.toFixed(2)}px) brightness(${brightness.toFixed(2)}) saturate(${saturate.toFixed(2)})`,
              opacity,
            }}
          />
          {/* Safelight grain wash — fades out as the print settles. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: (1 - p) * 0.5,
              animation: 'mp-grain 1.1s ease-in-out infinite',
              background:
                'radial-gradient(120% 90% at 50% 0%, var(--color-safelight-glow), transparent 70%)',
              mixBlendMode: 'screen',
            }}
          />
        </div>
      )}

      <p className="text-center text-sm text-safelight">{label}</p>

      <div className="flex w-full items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-safelight transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <Readout value={`${pct}%`} />
      </div>
    </div>
  );
}
