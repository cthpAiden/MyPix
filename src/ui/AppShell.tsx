'use client';

/**
 * Safe-area, one-handed app shell (T027). `env()` insets, `100dvh` sizing,
 * pull-to-refresh / text-selection suppression (in tokens.css), and the
 * reduced-motion + sound-toggle plumbing that gates the feedback layer.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { configureFeedback } from '@/ui/feedback';
import { getSettings, patchSettings } from '@/persistence/settings';

interface UIState {
  reducedMotion: boolean;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
}

const UIContext = createContext<UIState>({
  reducedMotion: false,
  soundEnabled: true,
  setSoundEnabled: () => {},
});

export function useUI(): UIState {
  return useContext(UIContext);
}

export function AppShell({ children }: { children: ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [soundEnabled, setSound] = useState(true);

  // prefers-reduced-motion, live.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Load persisted sound preference.
  useEffect(() => {
    getSettings().then((s) => setSound(s.soundEnabled));
  }, []);

  // Keep the feedback layer in sync.
  useEffect(() => {
    configureFeedback({ sound: soundEnabled, reducedMotion });
  }, [soundEnabled, reducedMotion]);

  // Register the service worker for offline/installability (US1.10).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline features degrade gracefully */
    });
  }, []);

  const setSoundEnabled = (v: boolean) => {
    setSound(v);
    void patchSettings({ soundEnabled: v });
  };

  const value = useMemo(
    () => ({ reducedMotion, soundEnabled, setSoundEnabled }),
    [reducedMotion, soundEnabled],
  );

  return (
    <UIContext.Provider value={value}>
      <div
        className="relative flex flex-col bg-stage text-ink"
        style={{
          height: '100dvh',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {children}
      </div>
    </UIContext.Provider>
  );
}
