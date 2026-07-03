'use client';

/**
 * In-app iOS install guidance (US1.10, T058). iOS has no install prompt, so we
 * explain Share → Add to Home Screen, and note offline readiness. Hidden once
 * running as an installed standalone PWA.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Surface } from '@/ui/primitives';
import { ShareIcon } from '@/ui/icons';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallGuide() {
  const t = useTranslations('install');
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissed = localStorage.getItem('mypix.installDismissed');
    if (!dismissed) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem('mypix.installDismissed', '1');
    setShow(false);
  };

  return (
    <Surface level={2} className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-safelight">
        <ShareIcon className="h-5 w-5" />
        <p className="text-sm font-medium text-ink">{t('title')}</p>
      </div>
      <ol className="ml-4 list-decimal space-y-1 text-sm text-ink-soft">
        <li>{t('iosStep1')}</li>
        <li>{t('iosStep2')}</li>
        <li>{t('iosStep3')}</li>
      </ol>
      <div className="flex items-center justify-between">
        <span className="text-xs text-ok">{t('offlineReady')}</span>
        <Button onPointerDown={dismiss}>{t('dismiss')}</Button>
      </div>
    </Surface>
  );
}
