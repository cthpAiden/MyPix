'use client';

/**
 * Date-triggered accent (T100). On a small set of notable days the app wears a
 * quiet celebratory accent (a faint safelight bloom + a greeting). Deterministic
 * Gregorian dates keep it simple and offline-safe — no calendar service.
 */
import { useEffect, useState } from 'react';

/** `MM-DD` → greeting message key under the `gift.*` namespace. */
const NOTABLE_DATES: Record<string, string> = {
  '01-01': 'greetingNewYear',
  '12-25': 'greetingSeason',
};

export interface GiftDate {
  active: boolean;
  greetingKey: string | null;
}

export function useGiftDate(): GiftDate {
  // Read the date on the client only (avoids SSR/hydration mismatch).
  const [state, setState] = useState<GiftDate>({ active: false, greetingKey: null });

  useEffect(() => {
    const now = new Date();
    const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const key = NOTABLE_DATES[mmdd];
    if (key) setState({ active: true, greetingKey: key });
  }, []);

  return state;
}
