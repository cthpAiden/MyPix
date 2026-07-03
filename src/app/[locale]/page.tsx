'use client';

/**
 * Home / import-launch screen (US1.1 intake UI, T030). Library pick or native
 * camera handoff, resume card, install guidance, language toggle.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { getEngine } from '@/engine';
import { pickFromLibrary, captureFromCamera } from '@/engine/import/intake';
import { ImportError } from '@/engine/import/validate';
import { latestDraft } from '@/persistence/drafts';
import { Button } from '@/ui/primitives';
import { LocaleToggle } from '@/ui/LocaleToggle';
import { ResumeCard } from '@/ui/ResumeCard';
import { InstallGuide } from '@/ui/InstallGuide';
import { ImportIcon } from '@/ui/icons';
import type { Draft } from '@/persistence/types';

export default function Home() {
  const t = useTranslations();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    latestDraft().then(setDraft);
  }, []);

  const openEditor = () => router.push('/edit');

  const doImport = async (capture: boolean) => {
    const file = capture ? await captureFromCamera() : await pickFromLibrary();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await getEngine().importPhoto(file);
      openEditor();
    } catch (e) {
      const code = e instanceof ImportError ? e.code : 'importFailed';
      setError(t(`errors.${code}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="flex items-center justify-between px-5 py-4">
        <span className="text-lg font-semibold tracking-tight text-ink">{t('home.title')}</span>
        <LocaleToggle />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 pb-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-hairline text-safelight">
            <ImportIcon className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">{t('home.title')}</h1>
          <p className="mt-1 text-sm text-ink-mute">{t('home.subtitle')}</p>
        </div>

        {draft && (
          <ResumeCard
            draft={draft}
            engine={getEngine()}
            onResumed={openEditor}
            onDiscard={() => setDraft(null)}
          />
        )}

        <div className="flex flex-col gap-2">
          <Button variant="primary" onPointerDown={() => doImport(false)} disabled={busy} className="py-3.5">
            {t('import.choosePhoto')}
          </Button>
          <Button onPointerDown={() => doImport(true)} disabled={busy} className="py-3">
            {t('import.takePhoto')}
          </Button>
          {error && <p className="text-center text-sm text-danger">{error}</p>}
          <p className="mt-1 text-center text-xs text-ink-faint">{t('home.importHint')}</p>
        </div>

        <InstallGuide />
      </main>

      <footer className="pb-[calc(env(safe-area-inset-bottom)+1rem)] text-center text-xs text-ink-faint">
        {t('home.giftNote')}
      </footer>
    </div>
  );
}
