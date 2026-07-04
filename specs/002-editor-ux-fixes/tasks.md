---
description: "Task list for Editor UX Fixes — Viewport Zoom, Continue-Editing, Face Detection"
---

# Tasks: Editor UX Fixes — Viewport Zoom, Continue-Editing, Face Detection

**Input**: Design documents from `/specs/002-editor-ux-fixes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{vision-assets,persistence-draft,viewport}.md, quickstart.md

**Tests**: Included. The plan (Technical Context) and every contract explicitly specify vitest coverage (asset-manifest guard, draft round-trip + retention, viewport clamp math). Only those specified tests are listed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (P1, face detection) · US2 (P2, continue editing) · US3 (P3, viewport zoom)
- All paths are repository-root-relative and verified against the current tree.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the one new shared location. The project is already initialized (Next.js 15.1, React 19, TS strict, vitest ^2.1.8); no scaffolding is required beyond this.

- [X] T001 Create the top-level `scripts/` directory (new build-tooling location referenced by plan.md Project Structure).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-story blocking work.

**None.** The three user stories are fully independent (vision-asset provisioning, draft persistence, and the view-only viewport touch disjoint files). There is no shared code that must land before story work begins. Each story below can start immediately after Setup and be delivered on its own.

**Checkpoint**: Setup complete → all three user stories may proceed (in priority order for MVP-first, or in parallel if staffed).

---

## Phase 3: User Story 1 - Face-aware tools work again (Priority: P1) 🎯 MVP

**Goal**: Restore every subject-aware tool (face, skin, retouch, makeup, reshape, body, background) by guaranteeing the on-device MediaPipe assets (`public/mediapipe/wasm/*` + `public/models/*.task`) exist in every dev run and build, and by adding a gate so their absence fails loudly (FR-001…FR-006).

**Independent Test**: Open a photo with a clearly visible face, open Retouch (or Skin/Makeup) → detection completes and the tool becomes usable ("Looking at your photo…" → working tool), not "Couldn't analyze this photo." (SC-001). Independent of resume and zoom.

### Implementation for User Story 1

- [X] T002 [US1] Read `src/vision/modelLoader.ts` and record the exact WASM base path and the three model file names/URLs it expects (`/mediapipe/wasm`, `/models/{face_landmarker,pose_landmarker_full,selfie_segmenter}.task`); these are the single source of truth the provision manifest must match (contracts/vision-assets.md).
- [X] T003 [US1] Create `scripts/provision-vision-assets.mjs` (Node ESM, no new deps) that: (a) copies every file from `node_modules/@mediapipe/tasks-vision/wasm` → `public/mediapipe/wasm/` (overwrite; error if source dir missing); (b) for each model in the manifest, fetches its URL → `public/models/<name>` only when missing/zero-length (URLs in research.md R2); (c) verifies each expected WASM file and each `public/models/<name>` exists and is non-empty, printing offending paths and `process.exit(1)` on failure; (d) prints a one-line success summary. Manifest paths MUST equal those recorded in T002.
- [X] T004 [US1] Wire provisioning into `package.json` scripts: add `"predev": "node scripts/provision-vision-assets.mjs"` and `"prebuild": "node scripts/provision-vision-assets.mjs"` (leave `dev`/`build` as-is).
- [X] T005 [US1] Run `npm run dev` once and confirm the predev step populated `public/mediapipe/wasm/*` and `public/models/face_landmarker.task`, `pose_landmarker_full.task`, `selfie_segmenter.task` (all non-empty); confirm a face tool on a photo with a face reaches the working state, not `vision.failed`.
- [X] T006 [P] [US1] Add guard test `tests/unit/vision-assets-manifest.test.ts` asserting the provision script's served asset paths (WASM base + the three `/models/*.task` URLs) exactly equal the paths `src/vision/modelLoader.ts` resolves, so filename/path drift fails CI (contracts/vision-assets.md).

**Checkpoint**: All subject-aware tools work on-device online and (after one online load) offline; deleting a model and running `npm run build` fails with a clear message. US1 is independently shippable as the MVP.

---

## Phase 4: User Story 2 - Continue editing resumes instantly (Priority: P2)

**Goal**: One-tap "Continue editing" that reopens the previous photo + edits with no file-picker, by persisting the original photo `Blob` on the single retained draft and resuming via the existing `Engine.restoreDraft(editState, blob)` path, with a graceful re-pick fallback (FR-007…FR-013).

**Independent Test**: Edit a photo (visible change), navigate away/close, reopen the app, tap "Continue editing" → editor reopens with the same photo and edits, no upload dialog (SC-002). Editing a different photo then returning offers only the newest photo. Independent of vision and zoom.

### Implementation for User Story 2

- [X] T007 [P] [US2] Add `originalBlob?: Blob` and `mimeType: string` to the `Draft` interface in `src/persistence/types.ts` (data-model.md; no `DB_VERSION` bump).
- [X] T008 [US2] Ensure the engine retains and exposes the imported source bytes: capture the `File`/`Blob` passed to `importPhoto` and add an accessor (e.g. `getSourceBlob(): Blob | null`) in `src/engine/index.ts` so the draft store can persist the original (contracts/persistence-draft.md).
- [X] T009 [US2] Update `saveDraftNow` in `src/persistence/drafts.ts` to include `originalBlob` (from the engine source blob) + `mimeType` in the written `Draft`, and after a successful write prune all other draft records so exactly one remains (pruning failures non-fatal); keep the existing `requestPersistence`/`guardedWrite`/quota outcome (research.md R5–R6).
- [X] T010 [US2] Update `src/ui/ResumeCard.tsx`: on "Continue editing", if `draft.originalBlob` is present call `engine.restoreDraft(draft.editState, draft.originalBlob)` → `onResumed()` with no picker; if absent or decode throws, show a brief bilingual note and fall through to the existing `pickFromLibrary` → `probeForRelink` re-pick flow. "Start fresh" unchanged (contracts/persistence-draft.md).
- [X] T011 [P] [US2] Add the resume/eviction "we need that photo again" bilingual strings to `src/i18n/messages/en.json` and `src/i18n/messages/vi.json` (reuse `resume.*`/`errors.*` namespaces where suitable; correct VI diacritics).
- [X] T012 [P] [US2] Add integration test `tests/integration/draft-resume.test.ts`: save a draft with a small `Blob` original → `latestDraft()` returns it with `originalBlob` → simulated resume calls `restoreDraft` (not `pickFromLibrary`); saving a second different photo prunes the first (store holds one record); `originalBlob = undefined` → resume takes the re-pick fallback (contracts/persistence-draft.md Verification).

**Checkpoint**: Returning users resume in one tap with the original stored; missing/evicted original degrades to an explained re-pick; exactly one draft is retained. US1 + US2 both work independently.

---

## Phase 5: User Story 3 - Comfortable default view with zoom to inspect (Priority: P3)

**Goal**: Default to the whole photo with a comfortable margin (not edge-to-edge), with pinch/double-tap zoom to ~4× actual pixels, two-finger constrained pan, and a visible reset control — implemented as a CSS transform on the preview canvas so pointer→image mapping and export are unaffected (FR-014…FR-020).

**Independent Test**: Open photos of each aspect ratio → whole image visible with margin; pinch to ~4× and pan (clamped); tap reset → default view; pick a color while zoomed → samples the correct point; export while zoomed → full-frame full-res output unaffected (SC-003…SC-005). Single-finger scrub still works. Independent of vision and resume.

### Implementation for User Story 3

- [X] T013 [US3] Create `src/ui/useViewport.ts` implementing the `Viewport` contract: state `scale`/`tx`/`ty`/derived `fit`; multi-pointer handlers (2 pointers → pinch scale + midpoint pan, consumed; 1 pointer → delegate to `fallback`); double-tap toggle centered on tap; clamp `fit = min(containerW/outW, containerH/outH) * 0.9`, `scale ∈ [1, 4/fit]`, `tx/ty` so the image stays overlapping the viewport; `reset()` animated with reduced-motion respect; `isZoomed`; `style` transform (contracts/viewport.md).
- [X] T014 [US3] Wire `useViewport` into `src/app/[locale]/edit/page.tsx`: replace the canvas fit styling (`maxWidth/maxHeight:100%; objectFit:contain`) with sizing to `fit` + `viewport.style`; route the canvas host through `viewport.handlers` (viewport first, delegating single-pointer events to the existing `photoHandlers`); keep the container `overflow-hidden` and `touch-action: none`. Do not modify `toNorm`/pointer mapping (it reads `getBoundingClientRect`, which already reflects the transform).
- [X] T015 [US3] Add a visible reset control as a canvas overlay in the edit screen, shown when `viewport.isZoomed`, reusing existing `IconButton`/primitives + an icon; add its bilingual label key to `src/i18n/messages/en.json` and `vi.json` (contracts/viewport.md).
- [X] T016 [P] [US3] Add unit test `tests/unit/viewport-clamp.test.ts`: `scale` bounds `[1, sMax]`, `tx/ty` bounds for representative container/photo sizes, and `fit` recompute on container resize (contracts/viewport.md Verification).

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Bilingual + quality gates across the three stories.

- [X] T017 [P] Run `tests/unit/i18n-parity.test.ts` and confirm all newly added EN/VI keys (resume/eviction note, reset label) are present in both locales with correct diacritics (FR-021 / SC-006).
- [X] T018 Run `npm run typecheck` and `npm run lint`; resolve any issues introduced by T003–T016.
- [ ] T019 Execute `specs/002-editor-ux-fixes/quickstart.md` end-to-end — Scenario 1 (US1) incl. the FR-006 build-gate check (delete a model → `npm run build` fails, then restore), Scenario 2 (US2), Scenario 3 (US3) — and validate against the installed iOS Safari PWA target (FR-022).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: none (empty) — does not block anything.
- **User Stories (Phases 3–5)**: each depends only on Setup. Independent of each other; run in priority order (P1→P2→P3) for MVP-first, or in parallel.
- **Polish (Phase 6)**: depends on the stories whose output it validates (T017 after T011/T015; T018 after all code; T019 after all three stories).

### Within each user story

- **US1**: T002 (record paths) → T003 (script) → T004 (npm wiring) → T005 (run/verify). T006 (guard test) [P] once the manifest paths from T002/T003 are agreed.
- **US2**: T007 (type) and T008 (engine accessor) → T009 (save+prune) → T010 (resume UI). T011 (i18n) and T012 (test) [P].
- **US3**: T013 (hook) → T014 (wire) → T015 (reset control + i18n). T016 (test) [P].

### Cross-story independence

No user story imports another's new code. US2's i18n edits (T011) and US3's i18n edits (T015) both touch `en.json`/`vi.json` — if US2 and US3 run concurrently, serialize those two edits (or merge keys in one pass) to avoid a same-file conflict.

---

## Parallel Opportunities

- After Setup, **US1 / US2 / US3 can be developed in parallel** by different people.
- Within stories, the test/i18n tasks marked **[P]** (T006, T011, T012, T016) run alongside their story's implementation.
- Watch the shared-file note above: T011 and T015 both write the i18n message files.

### Parallel example (US2)

```bash
# Alongside the US2 implementation chain (T007→T008→T009→T010):
Task: "T011 Add resume/eviction strings to src/i18n/messages/en.json + vi.json"
Task: "T012 Add integration test tests/integration/draft-resume.test.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1: Setup (T001).
2. Phase 3: US1 (T002–T006) — restores the largest broken surface (all subject-aware tools).
3. **STOP and VALIDATE**: quickstart Scenario 1 + build-gate. Ship as MVP — it is the highest-impact, lowest-risk fix and depends on nothing else.

### Incremental delivery

1. Setup → US1 (MVP: face detection works) → validate → ship.
2. Add US2 (one-tap continue editing) → validate → ship.
3. Add US3 (comfortable view + zoom) → validate → ship.
4. Polish (Phase 6) after the stories it covers.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Surgical scope: every task traces to an FR in spec.md; do not refactor adjacent code or remove pre-existing dead code (CLAUDE.md §3).
- Provisioned assets stay gitignored — the provision script + FR-006 gate (T003/T006) is what guarantees they ship, not a commit.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
