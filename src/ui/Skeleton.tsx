'use client';

/**
 * Content-shaped skeleton loading + empty states (T099). Skeletons mirror the
 * silhouette of the content they stand in for (a resume card, a tool grid) so
 * layout never jumps when real content arrives. The shimmer is a colour sweep
 * (not motion) and is neutralized under prefers-reduced-motion (tokens.css).
 */
import type { ReactNode } from 'react';
import { Surface } from '@/ui/primitives';

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** A single shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('mp-skeleton rounded-[var(--radius-control)]', className)} />;
}

/** A stack of shimmering text lines; the last line is shortened. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cx('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Placeholder shaped like the draft resume card (thumbnail + text + actions). */
export function ResumeCardSkeleton() {
  return (
    <Surface level={2} className="flex flex-col gap-3 p-4" >
      <div className="flex items-center gap-3">
        <Skeleton className="h-16 w-16" />
        <div className="flex-1">
          <Skeleton className="mb-2 h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-[var(--radius-control)]" />
        <Skeleton className="h-9 w-24 rounded-[var(--radius-control)]" />
      </div>
    </Surface>
  );
}

/**
 * Empty state for a tool that has produced no content yet (no presets, no
 * stickers placed). Content-shaped: a large muted glyph over a short guiding
 * line, with an optional call to action.
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-hairline text-ink-mute">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {hint && <p className="max-w-xs text-xs text-ink-mute">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
