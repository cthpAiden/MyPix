'use client';

/**
 * Gift easter-egg unlocks (T100). Small, tasteful surprises persisted in
 * settings.unlocks so a discovery stays discovered across sessions. Nothing here
 * affects the edit stack or export — it's pure delight, gated so it never
 * intrudes on the core flow.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSettings, patchSettings } from '@/persistence/settings';

/** The id of the hidden filter revealed by discovering the private note. */
export const SECRET_FILTER_ID = 'firstlight';

/** Unlock tokens stored in settings.unlocks. */
export const UNLOCK = {
  note: 'gift.note',
  secretFilter: SECRET_FILTER_ID,
} as const;

export function useUnlocks() {
  const [unlocks, setUnlocks] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    getSettings().then((s) => {
      if (live) setUnlocks(s.unlocks);
    });
    return () => {
      live = false;
    };
  }, []);

  const unlock = useCallback(async (...keys: string[]) => {
    const s = await getSettings();
    const next = Array.from(new Set([...s.unlocks, ...keys]));
    if (next.length !== s.unlocks.length) {
      await patchSettings({ unlocks: next });
    }
    setUnlocks(next);
  }, []);

  const has = useCallback((key: string) => unlocks.includes(key), [unlocks]);

  return { unlocks, unlock, has };
}
