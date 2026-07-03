'use client';

/**
 * Editor screen (US1.7/1.8, T028/T033/T053). Hosts the single preview canvas,
 * the whole-photo scrub gesture + eyedropper pick, the ToolSheet with the tool
 * switcher and active module Panel, compare, undo/redo, and export. The engine
 * is a singleton so switching locale (navigation) never remounts it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { getEngine, type Engine } from '@/engine';
import { useEditState } from '@/ui/useEngine';
import { useParamScrub } from '@/ui/useParamScrub';
import { ScrubContext, type PickCallback, type ScrubConfig } from '@/ui/scrub';
import { ToolSheet, type Detent } from '@/ui/ToolSheet';
import { Toolbar } from '@/ui/editor/Toolbar';
import { ExportSheet } from '@/ui/editor/ExportSheet';
import { Compare } from '@/ui/Compare';
import { LocaleToggle } from '@/ui/LocaleToggle';
import { PrecisionLoupe } from '@/ui/PrecisionLoupe';
import { Readout, IconButton } from '@/ui/primitives';
import { UndoIcon, RedoIcon, ExportIcon, CloseIcon } from '@/ui/icons';
import { toolModules } from '@/ui/moduleRegistry';
import { attachAutosave } from '@/persistence/drafts';
import { useUI } from '@/ui/AppShell';
import { clamp01 } from '@/shared/math';
import type { Locale } from '@/i18n/routing';

/** Defers engine access to the client (getEngine throws during prerender). */
export default function EditPage() {
  const [engine, setEngine] = useState<Engine | null>(null);
  useEffect(() => {
    setEngine(getEngine());
  }, []);
  if (!engine) {
    return <div className="flex flex-1 items-center justify-center text-sm text-ink-mute">MyPix…</div>;
  }
  return <Editor engine={engine} />;
}

function Editor({ engine }: { engine: Engine }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { reducedMotion } = useUI();

  useEditState(engine); // re-render on edit-state changes (undo/redo availability, etc.)
  const [activeTool, setActiveTool] = useState('adjust');
  const [detent, setDetent] = useState<Detent>('half');
  const [scrubConfig, setScrubConfig] = useState<ScrubConfig | null>(null);
  const [pickCb, setPickCb] = useState<PickCallback | null>(null);
  const [pickPos, setPickPos] = useState<{ x: number; y: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [quotaWarn, setQuotaWarn] = useState(false);

  const canvasHostRef = useRef<HTMLDivElement>(null);

  const scrub = useParamScrub({
    params: scrubConfig?.params ?? [],
    onChange: scrubConfig?.onChange ?? (() => {}),
    onGestureEnd: () => engine.endGesture(),
  });

  // Mount the single preview canvas; bounce home if no project.
  useEffect(() => {
    if (!engine.getProject()) {
      router.replace('/');
      return;
    }
    const host = canvasHostRef.current;
    if (!host) return;
    const canvas = engine.getPreviewCanvas();
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.objectFit = 'contain';
    canvas.style.touchAction = 'none';
    host.appendChild(canvas);
    engine.renderPreview();
    return () => {
      if (canvas.parentElement === host) host.removeChild(canvas);
    };
  }, [engine, router]);

  // Debounced autosave with quota guard.
  useEffect(() => attachAutosave(engine, () => setQuotaWarn(true)), [engine]);

  const host = useMemo(
    () => ({
      scrub,
      setConfig: setScrubConfig,
      requestPick: (cb: PickCallback) => setPickCb(() => cb),
      cancelPick: () => setPickCb(null),
      pickActive: pickCb != null,
    }),
    [scrub, pickCb],
  );

  const samplePick = useCallback(
    (clientX: number, clientY: number) => {
      if (!pickCb) return;
      const canvas = engine.getPreviewCanvas();
      const rect = canvas.getBoundingClientRect();
      const nx = clamp01((clientX - rect.left) / rect.width);
      const ny = clamp01((clientY - rect.top) / rect.height);
      const rgb = engine.sampleDisplayPixel(nx, ny);
      if (rgb) pickCb(rgb, nx, ny);
      setPickCb(null);
      setPickPos(null);
    },
    [engine, pickCb],
  );

  const photoHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (pickCb) setPickPos({ x: e.clientX, y: e.clientY });
      else scrub.handlers.onPointerDown(e);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (pickCb) {
        if (pickPos) setPickPos({ x: e.clientX, y: e.clientY });
      } else scrub.handlers.onPointerMove(e);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (pickCb) samplePick(e.clientX, e.clientY);
      else scrub.handlers.onPointerUp(e);
    },
    onPointerCancel: (e: React.PointerEvent) => {
      if (pickCb) setPickPos(null);
      else scrub.handlers.onPointerCancel(e);
    },
  };

  const activeModule = toolModules.find((m) => m.id === activeTool) ?? toolModules[0];
  const ctx = useMemo(() => ({ engine, landmarks: null, locale }), [engine, locale]);

  return (
    <ScrubContext.Provider value={host}>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 px-3 py-2">
          <IconButton label={t('common.back')} onPointerDown={() => router.push('/')}>
            <CloseIcon />
          </IconButton>
          <div className="flex items-center gap-1">
            <IconButton
              label={t('common.undo')}
              disabled={!engine.canUndo()}
              onPointerDown={() => engine.dispatch({ kind: 'history/undo' })}
            >
              <UndoIcon />
            </IconButton>
            <IconButton
              label={t('common.redo')}
              disabled={!engine.canRedo()}
              onPointerDown={() => engine.dispatch({ kind: 'history/redo' })}
            >
              <RedoIcon />
            </IconButton>
            <Compare engine={engine} />
          </div>
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <IconButton label={t('common.export')} onPointerDown={() => setExportOpen(true)}>
              <ExportIcon />
            </IconButton>
          </div>
        </header>

        <div
          ref={canvasHostRef}
          {...photoHandlers}
          className="relative flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden px-2"
          style={{ touchAction: 'none' }}
        >
          {scrub.isScrubbing && (
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
              <div className="rounded-2xl bg-black/40 px-6 py-3 backdrop-blur">
                <Readout large value={scrub.readout} label={scrub.activeLabel} />
              </div>
            </div>
          )}
          {quotaWarn && (
            <div className="pointer-events-none absolute inset-x-4 bottom-2 rounded-xl bg-black/60 px-3 py-2 text-center text-xs text-danger">
              {t('errors.storageFull')}
            </div>
          )}
        </div>

        <ToolSheet
          detent={detent}
          onDetentChange={setDetent}
          reducedMotion={reducedMotion}
          header={<Toolbar modules={toolModules} activeId={activeTool} onSelect={setActiveTool} />}
        >
          <activeModule.Panel ctx={ctx} />
        </ToolSheet>

        {pickCb && pickPos && (
          <PrecisionLoupe
            source={engine.getPreviewCanvas()}
            clientX={pickPos.x}
            clientY={pickPos.y}
            visible
          />
        )}

        {exportOpen && <ExportSheet engine={engine} onClose={() => setExportOpen(false)} />}
      </div>
    </ScrubContext.Provider>
  );
}
