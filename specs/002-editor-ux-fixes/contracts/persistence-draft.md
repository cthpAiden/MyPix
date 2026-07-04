# Contract: Draft-with-Original & One-Tap Resume

Delivers one-tap "Continue editing" (US2 / FR-007…FR-013) with single-draft retention and a graceful re-pick fallback.

## Persistence changes (`src/persistence`)

**`types.ts` — `Draft`** gains:
- `originalBlob?: Blob` — encoded original photo bytes (may be `undefined` after a quota failure).
- `mimeType: string` — original MIME type for re-decode.

**`drafts.ts`:**
- `saveDraftNow(engine)`:
  - Include `originalBlob` (from the engine's captured source bytes) and `mimeType` in the written `Draft`.
  - After a successful write, **prune**: delete all other draft records so exactly one remains (most-recent). Pruning failures are non-fatal.
  - Keep existing `requestPersistence()` + `guardedWrite` + quota outcome.
- `latestDraft()` — unchanged (newest by `savedAt`).
- No `DB_VERSION` bump.

## Engine source-bytes accessor (`src/engine`)

- `importPhoto(file)` already receives the source `File`. The engine MUST retain the source bytes so the draft store can persist them — e.g. expose `getSourceBlob(): Blob | null`, or attach `sourceBlob` to `Project`/`OriginalImage`.
- `restoreDraft(editState, blob)` **already exists** and is reused verbatim for resume (decodes the blob, opens the project with the saved edit-state). No fingerprint check needed (identical bytes).

## Resume UI (`src/ui/ResumeCard.tsx`)

**Primary path — "Continue editing" (`restore`)**:
1. If `draft.originalBlob` is present: `engine.restoreDraft(draft.editState, draft.originalBlob)` → `onResumed()`. **No file picker.**
2. If decode throws (corrupt/evicted) or `originalBlob` is absent: show a brief bilingual note ("we need that photo again") and fall through to the fallback.

**Fallback path (existing, retained)**:
- `pickFromLibrary()` → `probeForRelink(file, draft.fingerprint)` → match ⇒ `adoptPhoto`; mismatch ⇒ existing "use anyway / pick original" UI.

**"Start fresh" (`discard`)**: unchanged — `deleteDraft` then proceed to import.

## Behavior guarantees

| Requirement | Guarantee |
|-------------|-----------|
| FR-007 | Resume with a stored original shows no picker. |
| FR-008 | Original bytes persisted locally (IndexedDB Blob). |
| FR-009 | Non-destructive: `restoreDraft` opens original + separate edit-state; compare/undo behave as a fresh session. |
| FR-010 | Exactly one draft retained (prune on save). |
| FR-011 | Missing/evicted original ⇒ explained re-pick, never a blank/broken editor. |
| FR-012 | Quota failure ⇒ existing `errors.storageFull` guidance; resume still degrades gracefully. |
| FR-013 | "Start fresh" discards draft and imports. |

## Verification

- **Unit/integration (vitest)**: save a draft with a small `Blob` original → `latestDraft()` returns it with `originalBlob` → simulated resume calls `restoreDraft` with those bytes (no `pickFromLibrary`). Saving a second, different photo prunes the first (store holds one record).
- **Fallback**: draft with `originalBlob = undefined` → `restore` invokes the re-pick path.
- **Manual (quickstart)**: edit → leave → return → one tap reopens with edits, no upload dialog.
