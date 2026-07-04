'use client';

/**
 * Long-press-the-logo private note (T100). Press and hold the app title for a
 * beat and a private, hand-written note fades in — and quietly unlocks a hidden
 * filter look. Discovery persists (settings.unlocks). A plain tap still does
 * nothing, so it never interferes with normal use.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives';
import { haptic } from '@/ui/feedback';
import { UNLOCK, SECRET_FILTER_ID, useUnlocks } from './unlocks';

const HOLD_MS = 650;

export function HiddenNote({ children }: { children: ReactNode }) {
  const t = useTranslations('gift');
  const tRoot = useTranslations();
  const { has, unlock } = useUnlocks();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstReveal = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    timer.current = setTimeout(() => {
      firstReveal.current = !has(UNLOCK.note);
      haptic();
      setOpen(true);
      void unlock(UNLOCK.note, UNLOCK.secretFilter);
    }, HOLD_MS);
  }, [clear, has, unlock]);

  return (
    <>
      <span
        onPointerDown={start}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        className="select-none"
      >
        {children}
      </span>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[var(--radius-panel)] bg-surface-1 p-6 text-center ring-1 ring-hairline"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-base leading-relaxed text-ink">{t('hiddenNote')}</p>
            {firstReveal.current && (
              <p className="mb-4 text-xs text-safelight">
                {t('secretUnlocked', {
                  name: tRoot(`tools.filters.items.${SECRET_FILTER_ID}`),
                })}
              </p>
            )}
            <Button variant="primary" onPointerDown={() => setOpen(false)}>
              {t('close')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
