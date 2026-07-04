# Phase 0 Research: Editor UX Fixes

All spec clarifications were resolved in `/speckit-clarify` (retention = single most-recent draft; zoom = pinch + double-tap + visible reset; max zoom ≈ 4× actual pixels). The research below resolves the remaining implementation unknowns.

---

## R1 — Root cause of "Couldn't analyze this photo"

**Decision**: The failure is missing static assets, not a code regression. Provision them at build/dev time.

**Evidence**:
- `public/models/` contains only `README.md`; `public/mediapipe/wasm/` does not exist.
- `.gitignore` excludes `public/models/*.task` and `public/mediapipe/` (deliberately not committed).
- `src/vision/modelLoader.ts` resolves the WASM fileset from `/mediapipe/wasm` and loads models from `/models/*.task`. With the files absent, `FilesetResolver.forVisionTasks` / `FaceLandmarker.createFromOptions` reject → `Engine.ensureDetection` rejects → `useVision` sets `error` → `VisionNotice` shows `vision.failed`.
- The MediaPipe WASM fileset **is** present in `node_modules/@mediapipe/tasks-vision/wasm/` (6 files: simd + nosimd internal js/wasm). The `.task` models are **not** in the package and must be fetched.

**Rationale**: Detection code paths (loading, caching, offline guard, no-subject handling) are already correct; only the byte assets are missing. Fixing provisioning restores every subject-aware tool at once.

**Alternatives considered**:
- *Commit the binaries to git* — rejected: large binaries in git; existing `.gitignore` policy intentionally keeps them out.
- *Fetch models from Google's CDN at runtime* — rejected: violates same-origin requirement under COEP `require-corp` and the self-host-for-offline design (SW caches same-origin `/models/`).

## R2 — Asset provisioning mechanism

**Decision**: A small Node ESM script `scripts/provision-vision-assets.mjs`, wired to `predev` and `prebuild` npm lifecycle scripts, that (a) copies the WASM fileset from the installed package into `public/mediapipe/wasm/`, (b) downloads the three `.task` models into `public/models/` if absent, and (c) verifies all expected files exist (non-zero size), exiting non-zero on failure.

**Model sources** (documented MediaPipe model URLs, Apache-2.0):
- Face Landmarker → `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
- Pose Landmarker (full) → `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`
- Selfie Segmenter → `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite` (served as `.tflite`; stored under `public/models/selfie_segmenter.task` — MediaPipe reads model bytes regardless of extension)

**Idempotency**: Copy WASM every run (cheap, keeps it in sync with the installed package version). Download a model only if the target file is missing or zero-length (network fetch is the slow part; skip when already present).

**WASM source of truth**: `node_modules/@mediapipe/tasks-vision/wasm/` — copy the whole directory so the fileset resolver finds simd + nosimd variants; the resolver picks multithreaded/simd when `crossOriginIsolated` (COEP is enabled), else nosimd.

**Rationale**: `output: 'export'` copies `public/` verbatim into `out/`, so ensuring the files exist before `next build` guarantees they ship. `predev` guarantees the same for the user's `npm run dev` (localhost:3000). No new runtime dependency; Node ≥18 has global `fetch` and `fs/promises`.

**Alternatives considered**:
- *`postinstall` hook* — rejected as the sole mechanism: doesn't re-run when `node_modules` is present but `public/` was cleaned; `predev`/`prebuild` are more reliable at the moment of use. (A `postinstall` could be added later as a convenience but is not required.)
- *Manual copy per README* — rejected: that is the current state and is exactly what broke (a human step that was skipped). Automation + verification is the fix for FR-006.

## R3 — Verification gate (FR-006)

**Decision**: The provision script's verification step is the gate: after copy/fetch it asserts each of `public/models/{face_landmarker,pose_landmarker_full,selfie_segmenter}.task` and the key WASM files exist and are non-empty; a missing/empty file prints a clear message and exits 1, failing `prebuild`. Additionally add a lightweight unit test that asserts the loader's expected asset paths are covered by the provision manifest (guards against path drift between `modelLoader.ts` and the script).

**Rationale**: Turns a silent runtime breakage into a loud build/test failure, satisfying "MUST NOT recur." Dev builds fail fast; the test protects against future path/filename divergence.

**Alternatives considered**: Runtime health check in the UI only — rejected as insufficient: it detects the problem after shipping, not before.

## R4 — Persisting the original for one-tap resume

**Decision**: Store the encoded original bytes as a `Blob` on the `Draft` record (`originalBlob: Blob`), plus `mimeType`. On resume, read the blob and call the existing `Engine.restoreDraft(editState, blob)` (which decodes via `import/decode.ts` and opens the project with the saved edit-state). No fingerprint re-check is needed because the bytes are identical.

**Why a Blob, not decoded pixels**: IndexedDB stores `Blob`s natively and efficiently; the encoded photo is far smaller than raw pixels and re-decoding is the same path `importPhoto` already uses (handles JPEG/PNG/HEIC). This preserves non-destructive editing (original + separate edit-state) and avoids introducing an `ImageBitmap`-serialization concern.

**Source of the blob**: Capture the imported `File` (already a `Blob`) at import time and hand it to the draft store, or re-encode from the original — capturing the source `File` is simplest and lossless. The engine/import layer will expose the source bytes for the draft store to persist. (Exact wiring in data-model.md.)

**Rationale**: Reuses `restoreDraft` verbatim; the only new work is persistence of the blob and passing it back on resume.

**Alternatives considered**:
- *Store decoded `ImageBitmap`* — rejected: not reliably structured-clonable/persistable across browsers; larger; loses original encoding.
- *Keep re-pick* — rejected by the user (spec decision): the whole point is one-tap resume.

## R5 — Single-draft retention

**Decision**: Enforce "one resumable draft overall." On `saveDraftNow`, after writing the current draft, delete every other draft record (all keys except the current `id`). `latestDraft()` continues to return the newest. This keeps storage bounded to a single original blob.

**Rationale**: Matches the confirmed clarification and the home screen, which already surfaces only the latest draft. Bounding to one original blob is the safest choice for iOS storage quotas (Principle III) and eliminates multi-draft eviction complexity.

**Migration**: The `drafts` store currently may hold multiple fingerprint-keyed records. First `saveDraftNow` after the update prunes extras; additionally, prune on read in `latestDraft` is unnecessary since save prunes. No IndexedDB version bump required — adding a value field and pruning records needs no schema/index change (`idb` values are structurally typed, not enforced).

**Alternatives considered**: Last-N drafts — rejected by clarification (chose single). Unbounded — rejected: storage growth + eviction edge cases.

## R6 — Quota handling with the larger draft

**Decision**: Keep the existing `guardedWrite` + `onQuota` path. Because the draft now includes the original blob, a `QuotaExceededError` is more likely on very large photos; the existing bilingual "export to keep this result" guidance (`errors.storageFull`) already covers it. When a write fails on quota, the original may not be stored — so resume must degrade gracefully (see R7).

**Rationale**: No new mechanism; reuse the tested quota path. `navigator.storage.persist()` is already requested to reduce eviction.

## R7 — Resume fallback when the original is missing/evicted

**Decision**: On "Continue editing", if the draft has a usable `originalBlob`, decode + `restoreDraft` directly (no picker). If `originalBlob` is absent (quota failure at save) or fails to decode (corruption/eviction), fall back to the **existing** re-pick + fingerprint-relink flow already implemented in `ResumeCard` (`pickFromLibrary` → `probeForRelink` → adopt/mismatch). Surface a short bilingual note explaining the photo is needed again.

**Rationale**: Preserves a working resume in the degraded case without a blank/broken editor (FR-011). The fallback code already exists and is retained rather than removed.

## R8 — Viewport zoom/pan technique

**Decision**: Implement zoom/pan as a CSS `transform: translate(tx,ty) scale(s)` applied to the existing preview `<canvas>` element (or a thin wrapper), managed by a new `useViewport` hook. Do **not** change the GL render resolution for zoom.

**Why this fits the architecture**:
- The preview canvas is a fixed-resolution 2D surface (`outW×outH`) appended to the editor DOM with `objectFit: contain`. A CSS transform scales/pans it purely visually.
- `edit/page.tsx > toNorm()` maps pointer client coords to normalized image coords via `canvas.getBoundingClientRect()`. `getBoundingClientRect()` reflects CSS transforms, so pick/brush/eyedropper mapping stays correct at any zoom/pan **with no change** — the transformed rect's `left/width/top/height` already encode scale and translate. This is a major simplification and is called out as a validation point in quickstart.
- Export reads from the engine's edited canvas, entirely independent of the view transform (FR-018/SC-005) — verified by construction.

**Default view (comfortable margin)**: Replace the current `maxWidth/maxHeight: 100%` fit with a computed fit-to-container scale multiplied by a margin factor (~0.9) so the whole photo shows with breathing room, not edge-to-edge. The container keeps `overflow-hidden`.

**Max zoom (~4× actual pixels)**: Define the baseline fit scale `fit` (CSS px per canvas px at default framing). "Actual pixels" = 1 canvas pixel : 1 CSS pixel, i.e. transform scale `s = 1/fit` relative to fit. Max zoom target = 4× actual pixels → `sMax = 4/fit` (clamped). Min zoom = 1 (the default margin-framed view; users don't zoom out past the whole photo). Exact constant lives in `useViewport`; expressed so retouch on small features is comfortable on a phone.

**Pan constraint**: Clamp `tx,ty` so the scaled image cannot be dragged completely out of the viewport (keep the image covering/overlapping the visible area). Standard min/max translate computed from scaled size vs. container size.

**Rationale**: Minimal, view-only, reuses existing coordinate mapping, no GL changes, 60 fps via compositor-only transforms.

**Alternatives considered**:
- *Re-render GL at higher resolution on zoom* — rejected: expensive, unnecessary for inspection, and would complicate the export-independence guarantee.
- *Transform inside the canvas 2D context* — rejected: would desync `getBoundingClientRect`-based pointer mapping and require manual inverse transforms everywhere.

## R9 — Gesture coexistence (zoom/pan vs. parameter scrub)

**Decision**: A multi-pointer gesture layer in `useViewport` sits in front of the existing single-pointer `photoHandlers`:
- **2 active pointers** → pinch to zoom (distance ratio) + pan (midpoint delta); the viewport consumes these; scrub/pick/brush are not engaged.
- **1 active pointer** → delegate to the existing `photoHandlers` (parameter scrub, or pick/brush when those modes are active). Single-finger behavior is unchanged.
- **Double-tap** (single pointer, two quick taps) → toggle between default view and a zoomed-in level centered on the tap point.
- **Reset control** → visible button (canvas overlay) that animates back to the default view; respects reduced-motion.

**iOS Safari specifics**: The container already sets `touch-action: none` and uses Pointer Events, which deliver multi-touch as multiple `pointerId`s — the hook tracks a pointer map. `touch-action: none` suppresses the browser's native pinch-zoom so the app controls it. Verified approach for installed Safari PWA.

**Rationale**: Reserving multi-touch for the viewport keeps the whole existing one-finger scrub UX intact (no regression to Phase 1 editing), satisfying FR-020 and the "must not conflict" edge case.

**Alternatives considered**:
- *One-finger drag pans when zoomed* — rejected initially: ambiguous against scrub and risks accidental value changes; two-finger pan is unambiguous. (Can be revisited in UX polish, out of scope.)
- *Native CSS pinch-zoom (`touch-action: pinch-zoom`)* — rejected: doesn't give the app control over max-zoom clamping, pan constraints, focal double-tap, or the reset control, and interacts poorly with the scrub gesture.

## R10 — Localization of new strings

**Decision**: Add keys for the reset control label and any resume/eviction note to both `en.json` and `vi.json`, with correct Vietnamese diacritics. Reuse existing `resume.*` and `errors.*` namespaces where a suitable message exists; add minimal new keys otherwise.

**Rationale**: Constitution IV bilingual gate; no hardcoded strings.
