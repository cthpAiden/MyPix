import { defineRouting } from 'next-intl/routing';

/** English/Vietnamese, English default, prefix always present (`/en`, `/vi`). */
export const routing = defineRouting({
  locales: ['en', 'vi'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
