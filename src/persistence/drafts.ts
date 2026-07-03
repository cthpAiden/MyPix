/**
 * DraftStore (US1.8, T054). Debounced (~1 s) autosave + visibilitychange /
 * pagehide flush, a ≤50 KB thumbnail, navigator.storage.persist(), and graceful
 * QuotaExceededError handling (the caller surfaces the bilingual "export to keep
 * this result" prompt). Never stores pixels beyond the tiny thumbnail.
 */
import { getDB, guardedWrite, requestPersistence, type WriteOutcome } from './db';
import { fingerprintKey, type Draft } from './types';
import type { Engine } from '@/engine';

export async function latestDraft(): Promise<Draft | null> {
  try {
    const db = await getDB();
    const cursor = await db.transaction('drafts').store.index('savedAt').openCursor(null, 'prev');
    return cursor?.value ?? null;
  } catch {
    return null;
  }
}

export async function matchDraft(fpKey: string): Promise<Draft | null> {
  try {
    const db = await getDB();
    return (await db.get('drafts', fpKey)) ?? null;
  } catch {
    return null;
  }
}

export async function deleteDraft(id: string): Promise<void> {
  await guardedWrite(async () => {
    const db = await getDB();
    await db.delete('drafts', id);
  });
}

function makeThumb(canvas: HTMLCanvasElement): string {
  if (!canvas.width || !canvas.height) return '';
  const max = 256;
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(canvas, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.6);
}

/** Build and persist a draft for the engine's current project + state. */
export async function saveDraftNow(engine: Engine): Promise<WriteOutcome> {
  const project = engine.getProject();
  if (!project) return { ok: true };
  await requestPersistence();
  const fpKey = fingerprintKey(project.original.fingerprint);
  const draft: Draft = {
    id: fpKey, // one active draft per fingerprint
    editState: engine.getState(),
    fingerprint: project.original.fingerprint,
    fpKey,
    fileName: project.original.fileName,
    thumbDataUrl: makeThumb(engine.getPreviewCanvas()),
    savedAt: Date.now(),
  };
  return guardedWrite(async () => {
    const db = await getDB();
    await db.put('drafts', draft);
  });
}

/**
 * Wire debounced autosave to the engine. Returns an unsubscribe.
 * `onQuota` fires when a write fails for storage reasons (edge case).
 */
export function attachAutosave(engine: Engine, onQuota?: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const doSave = () => {
    void saveDraftNow(engine).then((r) => {
      if (!r.ok && (r.reason === 'quota' || r.reason === 'unknown')) onQuota?.();
    });
  };

  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(doSave, 1000);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') doSave();
  };

  const unsub = engine.subscribe(debounced);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', doSave);

  return () => {
    if (timer) clearTimeout(timer);
    unsub();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', doSave);
  };
}
