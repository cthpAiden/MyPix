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
import { ScrubContext, type BrushHandler, type PickCallback, type ScrubConfig } from '@/ui/scrub';
import { ToolSheet, SHEET_PEEK_FRACTION, type Detent } from '@/ui/ToolSheet';
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

  useEditState(engine); // re-render on edit-state changes (undo/redo, detection)
  const [activeTool, setActiveTool] = useState('adjust');
  const [detent, setDetent] = useState<Detent>('half');
  const [scrubConfig, setScrubConfig] = useState<ScrubConfig | null>(null);
  const [pickCb, setPickCb] = useState<PickCallback | null>(null);
  const [pickPos, setPickPos] = useState<{ x: number; y: number } | null>(null);
  const [brushCb, setBrushCb] = useState<BrushHandler | null>(null);
  const [brushPos, setBrushPos] = useState<{ x: number; y: number } | null>(null);
  const brushingRef = useRef(false);
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

  // Stable action callbacks so brush/pick modules can depend on THEM (not the
  // whole `host`, whose identity churns every render via `scrub`). Depending on
  // the unstable host in an effect that itself calls these setters produced
  // infinite render loops ("Maximum update depth exceeded") — see ScrubPanel.
  const requestPick = useCallback((cb: PickCallback) => setPickCb(() => cb), []);
  const cancelPick = useCallback(() => setPickCb(null), []);
  const requestBrush = useCallback((h: BrushHandler) => setBrushCb(() => h), []);
  const cancelBrush = useCallback(() => setBrushCb(null), []);

  const host = useMemo(
    () => ({
      scrub,
      setConfig: setScrubConfig,
      requestPick,
      cancelPick,
      pickActive: pickCb != null,
      requestBrush,
      cancelBrush,
      brushActive: brushCb != null,
    }),
    [scrub, pickCb, brushCb, requestPick, cancelPick, requestBrush, cancelBrush],
  );

  const toNorm = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = engine.getPreviewCanvas();
      const rect = canvas.getBoundingClientRect();
      return {
        nx: clamp01((clientX - rect.left) / rect.width),
        ny: clamp01((clientY - rect.top) / rect.height),
      };
    },
    [engine],
  );

  const samplePick = useCallback(
    (clientX: number, clientY: number) => {
      if (!pickCb) return;
      const { nx, ny } = toNorm(clientX, clientY);
      const rgb = engine.sampleDisplayPixel(nx, ny);
      if (rgb) pickCb(rgb, nx, ny);
      setPickCb(null);
      setPickPos(null);
    },
    [engine, pickCb, toNorm],
  );

  const endBrush = useCallback(() => {
    if (!brushingRef.current || !brushCb) return;
    brushingRef.current = false;
    brushCb.onEnd();
    setBrushPos(null);
  }, [brushCb]);

  const photoHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (pickCb) {
        setPickPos({ x: e.clientX, y: e.clientY });
        // Capture so a pick drag that leaves the canvas (mouse/pen) still
        // delivers move/up here and completes — mirrors the brush branch.
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } else if (brushCb) {
        brushingRef.current = true;
        const { nx, ny } = toNorm(e.clientX, e.clientY);
        brushCb.onStart(nx, ny);
        setBrushPos({ x: e.clientX, y: e.clientY });
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } else scrub.handlers.onPointerDown(e);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (pickCb) {
        if (pickPos) setPickPos({ x: e.clientX, y: e.clientY });
      } else if (brushCb) {
        if (brushingRef.current) {
          const { nx, ny } = toNorm(e.clientX, e.clientY);
          brushCb.onMove(nx, ny);
          setBrushPos({ x: e.clientX, y: e.clientY });
        }
      } else scrub.handlers.onPointerMove(e);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (pickCb) samplePick(e.clientX, e.clientY);
      else if (brushCb) endBrush();
      else scrub.handlers.onPointerUp(e);
    },
    onPointerCancel: (e: React.PointerEvent) => {
      if (pickCb) setPickPos(null);
      else if (brushCb) endBrush();
      else scrub.handlers.onPointerCancel(e);
    },
  };

  const activeModule = toolModules.find((m) => m.id === activeTool) ?? toolModules[0];
  const landmarks = engine.getLandmarks();
  const ctx = useMemo(() => ({ engine, landmarks, locale }), [engine, landmarks, locale]);

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
          style={{ touchAction: 'none', paddingBottom: `${SHEET_PEEK_FRACTION * 100}dvh` }}
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

        {brushCb && brushPos && (
          <PrecisionLoupe
            source={engine.getPreviewCanvas()}
            clientX={brushPos.x}
            clientY={brushPos.y}
            visible
          />
        )}

        {exportOpen && <ExportSheet engine={engine} onClose={() => setExportOpen(false)} />}
      </div>
    </ScrubContext.Provider>
  );
}
