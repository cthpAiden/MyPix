'use client';

/**
 * Reusable panel body for scrub-based tools (adjust, white balance, finishing,
 * color). Registers its params with the ScrubHost so the whole-photo gesture
 * drives them, and renders a tappable param strip with live values + reset.
 */
import { useEffect, useRef } from 'react';
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

  // Keep the latest params/onChange in refs so a single registration can read
  // fresh values without re-registering on every render.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Re-register only when param *content* changes (value / range / label), never
  // on mere object-identity churn. Callers frequently recompute `params` each
  // render (e.g. a `?? defaultX()` fallback when no live op exists yet), which
  // returns a new array of equal values every time. Depending on that identity
  // looped forever: setConfig → editor re-render → new params identity →
  // effect → setConfig … ("Maximum update depth exceeded"). The signature makes
  // the effect fire only on real changes, and the gesture reads fresh values
  // from the refs regardless.
  const sig = params.map((p) => `${p.key}:${p.value}:${p.min}:${p.max}:${p.label}`).join('|');
  useEffect(() => {
    setConfig({
      params: paramsRef.current,
      onChange: (key, value, coalesceKey) => onChangeRef.current(key, value, coalesceKey),
    });
    return () => setConfig(null);
  }, [sig, setConfig]);

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
