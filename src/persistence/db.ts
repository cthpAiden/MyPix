/**
 * The only module that opens IndexedDB (contracts/persistence.md). Typed idb
 * schema for drafts / presets / settings. Image pixels are never stored (sole
 * exception: the tiny draft thumbnail). All writes surface a typed result so
 * the UI can turn QuotaExceededError into bilingual guidance.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Draft, Preset, Settings } from './types';

const DB_NAME = 'mypix';
const DB_VERSION = 1;

interface MyPixDB extends DBSchema {
  drafts: {
    key: string;
    value: Draft;
    indexes: { savedAt: number; fpKey: string };
  };
  presets: {
    key: string;
    value: Preset;
    indexes: { sortOrder: number };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

let dbPromise: Promise<IDBPDatabase<MyPixDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<MyPixDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = openDB<MyPixDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('drafts')) {
          const drafts = db.createObjectStore('drafts', { keyPath: 'id' });
          drafts.createIndex('savedAt', 'savedAt');
          drafts.createIndex('fpKey', 'fpKey');
        }
        if (!db.objectStoreNames.contains('presets')) {
          const presets = db.createObjectStore('presets', { keyPath: 'id' });
          presets.createIndex('sortOrder', 'sortOrder');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

export type WriteOutcome =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'unavailable' | 'unknown'; error: unknown };

/** Wrap a write so QuotaExceededError / IDB failure never throws to the caller. */
export async function guardedWrite(fn: () => Promise<void>): Promise<WriteOutcome> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return { ok: false, reason: 'quota', error };
    }
    if (error instanceof Error && error.message.includes('IndexedDB unavailable')) {
      return { ok: false, reason: 'unavailable', error };
    }
    return { ok: false, reason: 'unknown', error };
  }
}

let persistRequested = false;

/** Ask the browser to keep our storage (reduce 7-day eviction risk). Once. */
export async function requestPersistence(): Promise<void> {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* best-effort */
  }
}
