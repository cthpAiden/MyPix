import { getRequestConfig } from 'next-intl/server';
import { routing, type Locale } from './routing';

/** Load the message catalog for the active locale (static-export friendly). */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = routing.locales.includes(requested as Locale)
    ? (requested as Locale)
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
