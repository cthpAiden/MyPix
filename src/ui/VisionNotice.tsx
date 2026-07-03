'use client';

/**
 * Shared bilingual notice for a Phase 2 tool's detection state (loading, offline
 * with an uncached model, or failure). No-subject fallbacks are rendered by the
 * modules themselves since their suggested manual tool differs.
 */
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives';
import type { VisionStatus } from './useVision';

export function VisionNotice({ status, onRetry }: { status: VisionStatus; onRetry?: () => void }) {
  const t = useTranslations();
  if (status === 'ready') return null;
  if (status === 'loading') {
    return <p className="px-1 py-3 text-sm text-ink-mute">{t('vision.detecting')}</p>;
  }
  const msg = status === 'offline' ? t('errors.offlineModel') : t('vision.failed');
  return (
    <div className="flex flex-col items-start gap-2 py-2">
      <p className="text-sm text-danger">{msg}</p>
      {onRetry && (
        <Button variant="ghost" onPointerDown={onRetry}>
          {t('vision.retry')}
        </Button>
      )}
    </div>
  );
}
