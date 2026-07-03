'use client';

/**
 * Reusable panel body for scrub-based tools (adjust, white balance, finishing,
 * color). Registers its params with the ScrubHost so the whole-photo gesture
 * drives them, and renders a tappable param strip with live values + reset.
 */
import { useEffect } from 'react';
import { useScrubHost } from '@/ui/scrub';
import { haptic } from '@/ui/feedback';
import type { ScrubParam } from '@/ui/useParamScrub';

export function ScrubPanel({
  params,
  onChange,
  onReset,
  hint,
}: {
  params: ScrubParam[];
  onChange: (key: string, value: number, coalesceKey: string) => void;
  onReset?: (key: string) => void;
  hint?: string;
}) {
  const { scrub, setConfig } = useScrubHost();

  useEffect(() => {
    setConfig({ params, onChange });
    return () => setConfig(null);
    // Re-register when the param values change so the gesture reads fresh values.
  }, [params, onChange, setConfig]);

  return (
    <div className="flex flex-col gap-3">
      {hint && <p className="text-xs text-ink-mute">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {params.map((p) => {
          const isActive = scrub.activeKey === p.key;
          const shown = p.format ? p.format(p.value) : Math.round(p.value);
          const changed = Math.round(p.value) !== 0;
          return (
            <button
              key={p.key}
              onPointerDown={() => {
                haptic();
                scrub.setActiveKey(p.key);
              }}
              onDoubleClick={() => onReset?.(p.key)}
              className={[
                'flex min-w-[84px] flex-col items-start rounded-[var(--radius-control)] border px-3 py-2 text-left transition-colors',
                isActive
                  ? 'border-safelight bg-surface-3'
                  : 'border-hairline hover:border-ink-faint',
              ].join(' ')}
            >
              <span className="text-[11px] uppercase tracking-wide text-ink-mute">{p.label}</span>
              <span
                className={[
                  'tnum text-lg',
                  changed ? 'text-safelight' : 'text-ink-soft',
                ].join(' ')}
              >
                {shown}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
