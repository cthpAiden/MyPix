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
  await guardedWrite(async () => {
    const db = await getDB();
    // Read-merge-write inside ONE readwrite transaction. IndexedDB serializes
    // readwrite transactions on a store, so two concurrent patches of different
    // fields (e.g. unlock + sound toggle) no longer clobber each other — the
    // second re-reads the first's committed value before merging.
    const tx = db.transaction('settings', 'readwrite');
    const stored = await tx.store.get(SETTINGS_KEY);
    const next: Settings = { ...defaultSettings(), ...stored, ...patch };
    await tx.store.put(next, SETTINGS_KEY);
    await tx.done;
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
