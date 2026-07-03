/**
 * SettingsStore (contracts/persistence.md). Locale is additionally mirrored to
 * localStorage + a cookie for pre-hydration / i18n-routing reads.
 */
import { getDB, guardedWrite } from './db';
import { defaultSettings, type Settings } from './types';

const SETTINGS_KEY = 'app';
const LOCALE_LS = 'mypix.locale';

export async function getSettings(): Promise<Settings> {
  try {
    const db = await getDB();
    const stored = await db.get('settings', SETTINGS_KEY);
    return { ...defaultSettings(), ...stored };
  } catch {
    return defaultSettings();
  }
}

export async function patchSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch };
  await guardedWrite(async () => {
    const db = await getDB();
    await db.put('settings', next, SETTINGS_KEY);
  });
  if (patch.locale) mirrorLocale(patch.locale);
}

/** Persist locale to localStorage + cookie so it survives and pre-hydrates. */
export function mirrorLocale(locale: 'en' | 'vi'): void {
  try {
    localStorage.setItem(LOCALE_LS, locale);
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* private mode / disabled storage — locale still works per-session */
  }
}

export function readMirroredLocale(): 'en' | 'vi' | null {
  try {
    const v = localStorage.getItem(LOCALE_LS);
    return v === 'en' || v === 'vi' ? v : null;
  } catch {
    return null;
  }
}
