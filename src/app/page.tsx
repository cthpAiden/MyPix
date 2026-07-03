'use client';

/**
 * Root redirect to the remembered (or default) locale. Static-export friendly:
 * a client-side redirect rather than a server redirect (which needs a runtime).
 */
import { useEffect } from 'react';
import { readMirroredLocale } from '@/persistence/settings';

export default function RootRedirect() {
  useEffect(() => {
    const locale = readMirroredLocale() ?? 'en';
    window.location.replace(`/${locale}`);
  }, []);

  return (
    <div className="flex h-[100dvh] items-center justify-center bg-stage text-ink-mute">
      <span className="text-sm">MyPix…</span>
    </div>
  );
}
