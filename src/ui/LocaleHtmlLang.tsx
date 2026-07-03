'use client';

/** Keeps <html lang> in sync with the active locale for assistive tech (i18n rule 5). */
import { useEffect } from 'react';

export function LocaleHtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
