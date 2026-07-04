'use client';

/**
 * Collage screen (US3.7, T088). A standalone mode that composes several photos
 * into a layout — pick a layout, add photos to cells, adjust spacing/corners/
 * background, tap two cells to swap, then export at high resolution. Separate
 * from the single-photo editor because a collage composes Projects.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button, Chip, Slider } from '@/ui/primitives';
import { CloseIcon, DownloadIcon, ShareIcon } from '@/ui/icons';
import { deliver } from '@/engine/export/deliver';
import { AssetStore } from '@/engine/render/assetStore';
import { drawCollage } from './render';
import { LAYOUTS, defaultCollage, layoutById, type CollageProject } from './types';

const PREVIEW = 720;
const EXPORT = 2048;

export function CollageScreen() {
  const t = useTranslations('collage');
  const router = useRouter();
  const [project, setProject] = useState<CollageProject>(defaultCollage);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const [, force] = useState(0);

  // Owns the picked cell images' object URLs. Collage has no undo history, so
  // nothing can reference them once the screen unmounts — revoke them all then.
  const assetsRef = useRef<AssetStore | null>(null);
  if (!assetsRef.current) assetsRef.current = new AssetStore();
  const assets = assetsRef.current;
  useEffect(() => () => assets.clear(), [assets]);

  const loadImage = useCallback((url: string) => {
    if (images.current.has(url)) return;
    const img = new Image();
    img.onload = () => {
      images.current.set(url, img);
      force((n) => n + 1);
    };
    img.src = url;
  }, []);

  const imageFor = useCallback(
    (i: number): CanvasImageSource | null => {
      const url = project.cells[i];
      return url ? images.current.get(url) ?? null : null;
    },
    [project.cells],
  );

  // Redraw the preview whenever the project or a loaded image changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawCollage(ctx, project, PREVIEW, imageFor);
  });

  const changeLayout = (id: string) => {
    const count = layoutById(id).cellCount;
    const cells = Array.from({ length: count }, (_, i) => project.cells[i] ?? null);
    setProject({ ...project, layoutId: id, cells });
    setSelected(null);
  };

  const addPhoto = (file: File) => {
    const url = assets.url(assets.register(file))!;
    loadImage(url);
    const cells = [...project.cells];
    const target =
      selected != null && cells[selected] == null
        ? selected
        : cells.findIndex((c) => c == null);
    const idx = target >= 0 ? target : (selected ?? 0);
    cells[idx] = url;
    setProject({ ...project, cells });
  };

  const tapCell = (i: number) => {
    if (selected == null) {
      setSelected(i);
      return;
    }
    if (selected === i) {
      setSelected(null);
      return;
    }
    const cells = [...project.cells];
    [cells[selected], cells[i]] = [cells[i], cells[selected]];
    setProject({ ...project, cells });
    setSelected(null);
  };

  const removeSelected = () => {
    if (selected == null) return;
    const cells = [...project.cells];
    cells[selected] = null;
    setProject({ ...project, cells });
    setSelected(null);
  };

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const layout = layoutById(project.layoutId);
    const i = layout.cells.findIndex(
      (c) => nx >= c.x && nx <= c.x + c.w && ny >= c.y && ny <= c.y + c.h,
    );
    if (i >= 0) tapCell(i);
  };

  const exportCollage = async (delivery: 'share' | 'download') => {
    setBusy(true);
    setMessage(t('developing'));
    try {
      const out = document.createElement('canvas');
      out.width = EXPORT;
      out.height = EXPORT;
      const ctx = out.getContext('2d')!;
      drawCollage(ctx, project, EXPORT, imageFor);
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('encode failed');
      const delivered = await deliver(blob, 'mypix-collage.jpg', delivery);
      setMessage(delivered === 'shared' ? t('saved') : delivery === 'share' ? t('shareFailed') : t('saved'));
    } catch {
      setMessage(t('shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const hasPhoto = project.cells.some((c) => c != null);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-3 py-2">
        <button aria-label={t('back')} onPointerDown={() => router.push('/')} className="text-ink-mute">
          <CloseIcon />
        </button>
        <span className="text-sm font-medium text-ink">{t('title')}</span>
        <span className="w-6" />
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3">
        <canvas
          ref={canvasRef}
          width={PREVIEW}
          height={PREVIEW}
          onClick={onCanvasClick}
          className="max-h-full max-w-full rounded-[var(--radius-panel)]"
          style={{ aspectRatio: '1 / 1', touchAction: 'manipulation' }}
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addPhoto(f);
          e.target.value = '';
        }}
      />

      <div className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto rounded-t-[var(--radius-sheet)] bg-surface-1 p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
        <p className="text-xs text-ink-mute">{hasPhoto ? t('cellHint') : t('empty')}</p>

        <div className="flex gap-2">
          <Button variant="primary" onPointerDown={() => fileRef.current?.click()} className="flex-1">
            {t('addPhoto')}
          </Button>
          {selected != null && project.cells[selected] != null && (
            <Button variant="danger" onPointerDown={removeSelected}>
              {t('back')}
            </Button>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-mute">{t('layout')}</p>
          <div className="flex flex-wrap gap-2">
            {LAYOUTS.map((l) => (
              <Chip key={l.id} active={project.layoutId === l.id} onClick={() => changeLayout(l.id)}>
                {l.cellCount}
              </Chip>
            ))}
          </div>
        </div>

        <Slider label={t('spacing')} value={project.spacing} onChange={(v) => setProject({ ...project, spacing: v })} />
        <Slider label={t('radius')} value={project.radius} onChange={(v) => setProject({ ...project, radius: v })} />

        <label className="flex items-center justify-between text-sm text-ink-soft">
          {t('background')}
          <input
            type="color"
            value={project.background}
            onChange={(e) => setProject({ ...project, background: e.target.value })}
            className="h-8 w-12 rounded bg-transparent"
          />
        </label>

        <div className="flex gap-2">
          <Button variant="primary" onPointerDown={() => exportCollage('share')} disabled={busy || !hasPhoto} className="flex-1 py-3">
            <ShareIcon className="h-5 w-5" /> {t('export')}
          </Button>
          <Button onPointerDown={() => exportCollage('download')} disabled={busy || !hasPhoto} className="py-3">
            <DownloadIcon className="h-5 w-5" />
          </Button>
        </div>
        {message && <p className="text-center text-sm text-ok">{message}</p>}
      </div>
    </div>
  );
}
