'use client';

/**
 * The visible half of the date-triggered accent (T100): a small safelight
 * sparkle beside a short greeting, shown only on a notable day. Subtle by
 * design — it honours the Darkroom palette (one amber accent) and collapses
 * under reduced motion.
 */
import { useTranslations } from 'next-intl';
import { useGiftDate } from './useGiftDate';

export function GiftAccent() {
  const t = useTranslations('gift');
  const { active, greetingKey } = useGiftDate();
  if (!active || !greetingKey) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-safelight">
      <span aria-hidden className="mp-sparkle">
        ✦
      </span>
      <span>{t(greetingKey)}</span>
    </div>
  );
}
