'use client';

/**
 * Export UI (US1.1, T036). Format (PNG/JPEG), social aspect-ratio preset,
 * JPEG quality, share/download, and the "developing" progress reveal. Applies
 * the choices to the full-resolution render (FR-113/116/117/118).
 */
import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Chip, Segmented } from '@/ui/primitives';
import { DevelopingReveal } from '@/ui/DevelopingReveal';
import { CloseIcon, DownloadIcon, ShareIcon } from '@/ui/icons';
import { ASPECT_RATIOS } from '@/shared/aspectRatios';
import type { Engine } from '@/engine';
import type { AspectRatioId, BackgroundEffectParams } from '@/engine/editState';
import type { ExportFormat } from '@/persistence/types';

export function ExportSheet({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const t = useTranslations();
  // A transparent-background cut-out is available when the edit stack has an
  // enabled transparent backgroundEffect op; it forces the lossless PNG path.
  const canTransparent = engine
    .getState()
    .operations.some(
      (o) =>
        o.type === 'backgroundEffect' &&
        o.enabled &&
        (o.params as BackgroundEffectParams).mode === 'transparent',
    );
  const [format, setFormat] = useState<ExportFormat>(canTransparent ? 'png' : 'jpeg');
  const [ratio, setRatio] = useState<AspectRatioId>('free');
  const [quality, setQuality] = useState(0.92);
  const [transparent, setTransparent] = useState(canTransparent);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);

  const run = useCallback(
    async (delivery: 'share' | 'download') => {
      setProgress(0);
      setMessage(null);
      // Snapshot the current preview so it can "develop" during the export.
      try {
        setThumb(engine.getPreviewCanvas().toDataURL('image/jpeg', 0.6));
      } catch {
        setThumb(null);
      }
      try {
        const result = await engine.export({
          format: transparent ? 'png' : format,
          jpegQuality: quality,
          ratio,
          transparentBackground: transparent,
          delivery,
          onProgress: (done, total) => setProgress(total ? done / total : 0),
        });
        setProgress(1);
        setMessage(
          result.delivered === 'shared'
            ? t('export.finished')
            : delivery === 'share'
              ? t('export.shareFailed')
              : t('export.finished'),
        );
      } catch {
        setMessage(t('errors.exportFailed'));
        setProgress(null);
      }
    },
    [engine, format, quality, ratio, transparent, t],
  );

  const developing = progress != null && progress < 1;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-[var(--radius-sheet)] bg-surface-1 p-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{t('export.title')}</h2>
          <button aria-label={t('common.close')} onPointerDown={onClose} className="text-ink-mute">
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-ink-mute">{t('export.format')}</p>
            <Segmented
              value={format}
              onChange={setFormat}
              options={[
                { value: 'jpeg', label: t('export.jpeg') },
                { value: 'png', label: t('export.png') },
              ]}
            />
          </div>

          {canTransparent && (
            <Chip active={transparent} onClick={() => setTransparent((v) => !v)}>
              {t('export.transparent')}
            </Chip>
          )}

          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-ink-mute">{t('export.aspect')}</p>
            <div className="flex flex-wrap gap-2">
              {ASPECT_RATIOS.map((r) => (
                <Chip key={r.id} active={ratio === r.id} onClick={() => setRatio(r.id)}>
                  {t(`aspect.${r.id}`)}
                </Chip>
              ))}
            </div>
          </div>

          {format === 'jpeg' && !transparent && (
            <div>
              <p className="mb-1.5 text-xs uppercase tracking-wide text-ink-mute">
                {t('export.quality')} · {Math.round(quality * 100)}
              </p>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.01}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full accent-[var(--color-safelight)]"
              />
            </div>
          )}

          {developing ? (
            <DevelopingReveal
              progress={progress ?? 0}
              thumbnail={thumb}
              label={t('export.developing')}
            />
          ) : (
            <div className="flex gap-2">
              <Button variant="primary" onPointerDown={() => run('share')} className="flex-1 py-3">
                <ShareIcon className="h-5 w-5" /> {t('export.share')}
              </Button>
              <Button onPointerDown={() => run('download')} className="flex-1 py-3">
                <DownloadIcon className="h-5 w-5" /> {t('export.download')}
              </Button>
            </div>
          )}

          {message && <p className="text-center text-sm text-ok">{message}</p>}
        </div>
      </div>
    </div>
  );
}
