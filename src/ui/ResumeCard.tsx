'use client';

/**
 * Draft resume card + fingerprint re-link flow (US1.8, T055). On mismatch it
 * asks explicitly (use anyway / pick the original) — never a silent wrong-apply
 * (story 1.8 acceptance 3).
 */
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button, Surface } from '@/ui/primitives';
import { pickFromLibrary } from '@/engine/import/intake';
import { probeForRelink } from '@/engine/import/relink';
import { deleteDraft } from '@/persistence/drafts';
import type { Engine } from '@/engine';
import type { Draft } from '@/persistence/types';
import type { OriginalImage } from '@/engine/types';

export function ResumeCard({
  draft,
  engine,
  onResumed,
  onDiscard,
}: {
  draft: Draft;
  engine: Engine;
  onResumed: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations('resume');
  const locale = useLocale();
  const [mismatch, setMismatch] = useState<OriginalImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [needPhoto, setNeedPhoto] = useState(false);

  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(draft.savedAt));

  // Primary "Continue editing": one tap resumes from the stored original with no
  // picker. Missing/undecodable original degrades to the re-pick fallback.
  const restore = async () => {
    if (draft.originalBlob) {
      setBusy(true);
      try {
        await engine.restoreDraft(draft.editState, draft.originalBlob);
        onResumed();
        return;
      } catch {
        // corrupt/evicted bytes — fall through to re-pick
      } finally {
        setBusy(false);
      }
    }
    setNeedPhoto(true);
    await pick();
  };

  const pick = async () => {
    const file = await pickFromLibrary();
    if (!file) return;
    setBusy(true);
    try {
      const { original, matches } = await probeForRelink(file, draft.fingerprint);
      if (matches) {
        engine.adoptPhoto(original, draft.editState);
        onResumed();
      } else {
        setMismatch(original);
      }
    } finally {
      setBusy(false);
    }
  };

  const useAnyway = () => {
    if (!mismatch) return;
    engine.adoptPhoto(mismatch, draft.editState);
    onResumed();
  };

  const discard = async () => {
    await deleteDraft(draft.id);
    onDiscard();
  };

  return (
    <Surface level={2} className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        {draft.thumbDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.thumbDataUrl}
            alt=""
            className="h-16 w-16 rounded-[var(--radius-control)] object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-[var(--radius-control)] bg-surface-3" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{draft.fileName}</p>
          <p className="text-xs text-ink-mute">{t('savedAt', { when })}</p>
        </div>
      </div>

      {mismatch ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">{t('mismatchTitle')}</p>
          <p className="text-xs text-ink-mute">{t('mismatchBody')}</p>
          <div className="flex gap-2">
            <Button variant="primary" onPointerDown={useAnyway}>
              {t('useAnyway')}
            </Button>
            <Button onPointerDown={() => setMismatch(null)}>{t('pickOriginal')}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {needPhoto && <p className="text-xs text-ink-mute">{t('needPhoto')}</p>}
          <div className="flex gap-2">
            <Button variant="primary" onPointerDown={restore} disabled={busy}>
              {t('restore')}
            </Button>
            <Button variant="danger" onPointerDown={discard}>
              {t('discard')}
            </Button>
          </div>
        </div>
      )}
      {!mismatch && !draft.originalBlob && (
        <p className="text-xs text-ink-faint">{t('pickPhoto')}</p>
      )}
    </Surface>
  );
}
