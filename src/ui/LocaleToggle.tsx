'use client';

/**
 * Visible persistent EN/VI toggle (US1.9, T056). Switches locale client-side
 * without remounting the engine/canvas (the engine is a singleton, so the
 * preview survives navigation), persisting to settings + cookie.
 */
import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { mirrorLocale, patchSettings } from '@/persistence/settings';
import { haptic } from '@/ui/feedback';
import type { Locale } from '@/i18n/routing';

const LOCALES: Locale[] = ['en', 'vi'];

export function LocaleToggle() {
  const active = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('a11y');
  const [, startTransition] = useTransition();

  const switchTo = (locale: Locale) => {
    if (locale === active) return;
    haptic();
    mirrorLocale(locale);
    void patchSettings({ locale });
    startTransition(() => {
      router.replace(pathname, { locale });
    });
  };

  return (
    <div
      role="group"
      aria-label={t('localeToggle')}
      className="flex overflow-hidden rounded-full border border-hairline text-xs"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          onPointerDown={() => switchTo(l)}
          aria-pressed={l === active}
          className={[
            'px-3 py-1.5 uppercase tracking-wide transition-colors',
            l === active ? 'bg-safelight text-stage' : 'text-ink-mute hover:text-ink',
          ].join(' ')}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
