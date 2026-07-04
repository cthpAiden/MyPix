/**
 * Draft-with-original round-trip, single-draft retention, and one-tap resume
 * (US2 / contracts/persistence-draft.md Verification).
 *
 * Runs under vitest+jsdom with fake-indexeddb providing a real IndexedDB, so
 * saveDraftNow/latestDraft exercise the actual persistence path. The resume
 * decision is checked against the real ResumeCard component with the intake
 * layer mocked.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { createElement } from 'react';
// fake-indexeddb's structured clone preserves Node's Blob (jsdom's Blob is
// flattened to {}); real browser IndexedDB clones the platform Blob natively.
// Use Node's Blob only where a value round-trips through IndexedDB.
import { Blob as IdbBlob } from 'node:buffer';
import { saveDraftNow, latestDraft } from '@/persistence/drafts';
import { getDB } from '@/persistence/db';
import { emptyEditState } from '@/engine/editState';
import type { Engine } from '@/engine';
import type { ImageFingerprint } from '@/engine/types';
import type { Draft } from '@/persistence/types';
import { ResumeCard } from '@/ui/ResumeCard';
import en from '@/i18n/messages/en.json';

// Intake layer mocked so "re-pick" is observable without a real file dialog.
const { pickFromLibrary, probeForRelink } = vi.hoisted(() => ({
  pickFromLibrary: vi.fn(),
  probeForRelink: vi.fn(),
}));
vi.mock('@/engine/import/intake', () => ({ pickFromLibrary }));
vi.mock('@/engine/import/relink', () => ({ probeForRelink }));

/** A canvas with no dimensions makes makeThumb a no-op (avoids jsdom 2d). */
function emptyCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 0;
  c.height = 0;
  return c;
}

function fakeEngine(opts: {
  blob: Blob | null;
  fingerprint: ImageFingerprint;
  fileName: string;
  mimeType: string;
}): Engine {
  return {
    getProject: () => ({
      id: 'proj',
      original: {
        fingerprint: opts.fingerprint,
        fileName: opts.fileName,
        mimeType: opts.mimeType,
      },
      createdAt: 0,
      modifiedAt: 0,
    }),
    getState: () => emptyEditState(),
    getPreviewCanvas: () => emptyCanvas(),
    getSourceBlob: () => opts.blob,
  } as unknown as Engine;
}

const fp = (sampleHash: string, byteSize: number): ImageFingerprint => ({
  byteSize,
  width: 10,
  height: 10,
  sampleHash,
});

function makeDraft(over: Partial<Draft> = {}): Draft {
  return {
    id: 'd1',
    editState: emptyEditState(),
    fingerprint: fp('a1', 3),
    fpKey: 'd1',
    fileName: 'a.jpg',
    thumbDataUrl: '',
    savedAt: 0,
    mimeType: 'image/jpeg',
    originalBlob: new Blob(['photo-bytes'], { type: 'image/jpeg' }),
    ...over,
  };
}

describe('draft persistence with original', () => {
  beforeEach(async () => {
    const db = await getDB();
    await db.clear('drafts');
  });

  it('persists the original blob + mimeType and reads them back', async () => {
    const blob = new IdbBlob(['hello-photo'], { type: 'image/jpeg' }) as unknown as Blob;
    const out = await saveDraftNow(
      fakeEngine({ blob, fingerprint: fp('a1', blob.size), fileName: 'a.jpg', mimeType: 'image/jpeg' }),
    );
    expect(out.ok).toBe(true);

    const d = await latestDraft();
    expect(d).not.toBeNull();
    expect(d!.originalBlob).toBeInstanceOf(IdbBlob);
    expect(d!.originalBlob!.size).toBe(blob.size);
    expect(d!.mimeType).toBe('image/jpeg');
  });

  it('retains exactly one draft — editing a different photo prunes the first', async () => {
    await saveDraftNow(
      fakeEngine({
        blob: new IdbBlob(['a'], { type: 'image/jpeg' }) as unknown as Blob,
        fingerprint: fp('a1', 1),
        fileName: 'a.jpg',
        mimeType: 'image/jpeg',
      }),
    );
    await saveDraftNow(
      fakeEngine({
        blob: new IdbBlob(['bb'], { type: 'image/png' }) as unknown as Blob,
        fingerprint: fp('b2', 2),
        fileName: 'b.png',
        mimeType: 'image/png',
      }),
    );

    const db = await getDB();
    const keys = await db.getAllKeys('drafts');
    expect(keys).toHaveLength(1);
    const d = await latestDraft();
    expect(d!.fileName).toBe('b.png');
  });

  it('stores no original blob when the engine has none (quota-degraded)', async () => {
    await saveDraftNow(
      fakeEngine({ blob: null, fingerprint: fp('c3', 0), fileName: 'c.jpg', mimeType: 'image/jpeg' }),
    );
    const d = await latestDraft();
    expect(d!.originalBlob).toBeUndefined();
  });
});

describe('ResumeCard one-tap resume', () => {
  beforeEach(() => {
    cleanup();
    pickFromLibrary.mockReset();
    probeForRelink.mockReset();
  });

  function renderCard(draft: Draft, engine: Engine) {
    return render(
      createElement(NextIntlClientProvider, {
        locale: 'en',
        messages: en,
        children: createElement(ResumeCard, {
          draft,
          engine,
          onResumed: vi.fn(),
          onDiscard: vi.fn(),
        }),
      }),
    );
  }

  it('resumes from the stored original without opening the picker', async () => {
    const engine = {
      restoreDraft: vi.fn().mockResolvedValue(undefined),
      adoptPhoto: vi.fn(),
    } as unknown as Engine;
    const draft = makeDraft();

    renderCard(draft, engine);
    fireEvent.pointerDown(screen.getByText('Continue editing'));

    await waitFor(() =>
      expect(engine.restoreDraft).toHaveBeenCalledWith(draft.editState, draft.originalBlob),
    );
    expect(pickFromLibrary).not.toHaveBeenCalled();
  });

  it('falls back to re-pick when the original is absent', async () => {
    pickFromLibrary.mockResolvedValue(null); // user cancels the picker
    const engine = {
      restoreDraft: vi.fn(),
      adoptPhoto: vi.fn(),
    } as unknown as Engine;
    const draft = makeDraft({ originalBlob: undefined });

    renderCard(draft, engine);
    fireEvent.pointerDown(screen.getByText('Continue editing'));

    await waitFor(() => expect(pickFromLibrary).toHaveBeenCalled());
    expect(engine.restoreDraft).not.toHaveBeenCalled();
  });
});
