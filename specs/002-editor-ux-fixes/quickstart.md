# Quickstart: Validate the Editor UX Fixes

End-to-end validation for the three fixes. Assumes the feature is implemented per `plan.md` and contracts.

## Prerequisites

- Node ≥ 18, dependencies installed (`npm install`).
- A test photo with a clearly visible face, plus a few of different aspect ratios (portrait, landscape, square, panorama).

## Setup / run

```bash
npm run dev        # runs provision-vision-assets.mjs (predev), then next dev
# open http://localhost:3000
```

The `predev` step must print a success summary and populate:
- `public/mediapipe/wasm/` (WASM fileset copied from node_modules)
- `public/models/face_landmarker.task`, `pose_landmarker_full.task`, `selfie_segmenter.task` (fetched once)

If any asset is missing it exits non-zero — that is the FR-006 gate working.

## Automated checks

```bash
npm run test        # vitest: asset-manifest guard, draft round-trip + retention, viewport clamp math
npm run typecheck   # strict TS
npm run lint
```

## Scenario 1 — Face-aware tools work (US1 / P1)

1. Import the photo with a face.
2. Open **Retouch** (or Skin / Makeup / Reshape / Body / Background).
3. **Expected**: "Looking at your photo…" then the working tool. **Not** "Couldn't analyze this photo."
4. Reopen the same tool → opens instantly (cached).
5. Import a photo with **no** face → open a face tool → the module's "no subject" fallback appears (a purposeful message + manual option), **not** the generic failure.
6. Offline check: with assets already loaded once, go offline (DevTools) and reopen a tool → still works. In a fresh profile while offline, the first attempt shows the "needs one online load" message (not the generic failure).

**Build-gate check (FR-006)**: delete `public/models/face_landmarker.task`, run `npm run build` → build fails with a clear message. Restore by re-running `npm run dev`/`build`.

## Scenario 2 — One-tap Continue editing (US2 / P2)

1. Import a photo, make a visible edit (e.g., raise Exposure).
2. Navigate Home (or close the tab) so the draft autosaves.
3. Reopen `http://localhost:3000`.
4. **Expected**: the "Continue editing" card. Tap it → the editor reopens with the same photo and edits applied, **no file-picker**.
5. Confirm Compare (hold original) and Undo behave as in the original session.
6. Edit a **different** photo, then return Home → only the newest photo is offered (single-draft retention).
7. Fallback: in DevTools > Application, clear the draft's stored original (or use a pre-update draft) → tap "Continue editing" → a brief note explains the photo is needed, then the re-pick flow runs.

## Scenario 3 — Comfortable default view + zoom (US3 / P3)

1. Open each aspect-ratio photo. **Expected**: the whole image is visible with a comfortable margin — never scaled edge-to-edge.
2. Pinch out → the image magnifies smoothly toward the pinch point, up to ~4× actual pixels.
3. Two-finger drag → pans; the image cannot be dragged fully out of view.
4. Tap the **reset** control → returns to the default whole-photo view (animated; instant if reduced-motion is on).
5. While zoomed in, use the eyedropper/pick (or a brush tool) → it samples/acts on the correct point on the photo.
6. While zoomed in, **Export** → the output is the full edited photo at full resolution, unaffected by zoom/pan.
7. Single-finger drag still performs parameter scrub (unchanged) — zoom did not hijack it.

## Success = all of

- No `vision.failed` on photos with a subject; tools reach `ready` (SC-001).
- Resume is a single tap with zero pickers when the original is stored (SC-002).
- Whole photo framed with margin for every aspect ratio (SC-003).
- Zoom to detail and back in ≤2 gestures; reset in one tap (SC-004).
- Export identical regardless of zoom/pan (SC-005).
- New strings correct in EN and VI (SC-006).

Details live in the contracts (`contracts/*.md`) and `data-model.md`; implementation belongs in `tasks.md`.
