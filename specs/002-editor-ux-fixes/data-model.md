# Phase 1 Data Model: Editor UX Fixes

This feature adds one persisted field and one transient UI state object. It does not introduce new stores or indexes.

---

## Entity: Draft (MODIFIED)

Location: `src/persistence/types.ts`. Persisted in IndexedDB store `drafts` (keyPath `id`, indexes `savedAt`, `fpKey`).

| Field | Type | New? | Notes |
|-------|------|------|-------|
| `id` | `string` | — | Draft key. With single-draft retention, one record survives at a time. |
| `editState` | `EditState` | — | Non-pixel edit state (operations, layers, crop). Unchanged. |
| `fingerprint` | `ImageFingerprint` | — | Retained for the re-pick fallback path. |
| `fpKey` | `string` | — | Indexable fingerprint key. Retained for fallback relink. |
| `fileName` | `string` | — | Display name in the resume card. |
| `thumbDataUrl` | `string` | — | ≤~50 KB preview thumbnail. Unchanged. |
| `savedAt` | `number` | — | Newest wins in `latestDraft()`. |
| **`originalBlob`** | **`Blob \| undefined`** | **NEW** | The encoded original photo bytes for one-tap resume. `undefined` only when a quota failure prevented storing it. |
| **`mimeType`** | **`string`** | **NEW** | Original MIME type (e.g. `image/jpeg`, `image/heic`) for correct re-decode. |

**Validation / rules**:
- On resume, `originalBlob` present + decodable → one-tap restore (no picker).
- `originalBlob` absent or decode fails → degrade to re-pick fallback (fingerprint relink).
- Only **one** draft is retained: `saveDraftNow` deletes all draft records except the one it just wrote (R5).
- No IndexedDB `DB_VERSION` bump: adding value fields and pruning records requires no schema/index migration. Old drafts without `originalBlob` naturally take the fallback path.

**Lifecycle**:
1. Import a photo → engine holds the source `File`; first edit triggers debounced autosave.
2. `saveDraftNow` builds the `Draft` including `originalBlob` (from the captured source `File`) and prunes other drafts.
3. Home screen `latestDraft()` returns it → `ResumeCard` shows "Continue editing".
4. Resume → decode `originalBlob` → `Engine.restoreDraft(editState, blob)` → editor opens with edits applied.
5. Editing a **different** photo replaces the draft (prune) and releases the prior original.

**Source-bytes wiring**: The draft store needs the original encoded bytes. The engine captures the imported `File`/`Blob` at `importPhoto` time and exposes it (e.g. `engine.getSourceBlob()` or the project retains `original.sourceBlob`) so `saveDraftNow(engine)` can persist it. Exact accessor defined during implementation; contract in `contracts/persistence-draft.md`.

---

## Entity: ViewportState (NEW, transient — not persisted)

Location: `src/ui/useViewport.ts` (React state/refs in the editor screen). Never written to IndexedDB; never part of export.

| Field | Type | Notes |
|-------|------|-------|
| `scale` | `number` | Current zoom multiplier relative to the default margin-framed fit. Range `[1, sMax]` where `sMax ≈ 4 / fit` (≈4× actual pixels). |
| `tx` | `number` | Horizontal pan translate (CSS px), clamped so the image can't leave the viewport. |
| `ty` | `number` | Vertical pan translate (CSS px), clamped likewise. |
| `fit` | `number` (derived) | Baseline CSS-px-per-canvas-px at default framing (whole photo + ~0.9 margin). Recomputed on container resize / photo change. |

**Rules**:
- Default state: `scale = 1`, `tx = ty = 0` (whole photo, comfortable margin).
- Applied as `transform: translate(tx,ty) scale(scale)` on the preview canvas element (transform-origin center).
- `reset()` returns to default (animated unless reduced-motion).
- View-only: no effect on `EditState`, engine render, or export output.
- Pointer→image mapping is unaffected (relies on `getBoundingClientRect`, which reflects the transform).

---

## Static assets (provisioned, not a data entity)

| Asset | Path (served) | Source |
|-------|---------------|--------|
| Face Landmarker model | `/models/face_landmarker.task` | MediaPipe models CDN (R2) |
| Pose Landmarker model | `/models/pose_landmarker_full.task` | MediaPipe models CDN (R2) |
| Selfie Segmenter model | `/models/selfie_segmenter.task` | MediaPipe models CDN (R2) |
| MediaPipe WASM fileset | `/mediapipe/wasm/*` | `node_modules/@mediapipe/tasks-vision/wasm/` |

Runtime-cached by `src/app/sw.ts` (already matches `/models/` and `/mediapipe/`). Must exist in the build output; guaranteed by `scripts/provision-vision-assets.mjs` + verification (contracts/vision-assets.md).
