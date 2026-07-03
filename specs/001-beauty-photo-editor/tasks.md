---
description: "Task list for MyPix — Beauty & Photo Editing PWA"
---

# Tasks: MyPix — Beauty & Photo Editing PWA

**Input**: Design documents from `/specs/001-beauty-photo-editor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (edit-state, engine, vision, persistence, i18n)

**Tests**: This app is a single-user gift with no CI gate beyond a few contract-mandated unit tests. Only the unit tests the contracts explicitly require ("unit-tested" / "CI-enforced": edit-state round-trip, preset codec round-trip, warp math, i18n parity) plus the Phase 4 device matrix and a small Playwright flow set are included. No blanket per-story test tasks.

**Organization**: Tasks are grouped by user story (spec numbering: US1.1 … US4.4). The spec's four phases map to task phases; within each phase, priority order (P1 → P2 → P3) is preserved.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (e.g., US1.1, US2.3)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js frontend project (plan.md "Structure Decision"). Source at `src/`, static assets at `public/`, tests at `tests/`. No backend.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, tooling, and static/PWA scaffolding

- [X] T001 Create the Next.js 15 App Router project skeleton and the full folder tree per plan.md (`src/app/[locale]/`, `src/engine/{editState,render,gl,color,import,export}/`, `src/vision/`, `src/modules/`, `src/persistence/`, `src/i18n/`, `src/ui/`, `src/shared/`, `public/{icons,models,stickers}/`, `tests/{unit,integration,device}/`)
- [X] T002 Initialize `package.json` and install dependencies: next@15, react@19, typescript@5, tailwindcss@4, fabric@6, @mediapipe/tasks-vision, next-intl, heic2any, idb, @serwist/next, @jsquash/jpeg, fast-png, vitest, @testing-library/react, @playwright/test
- [X] T003 [P] Configure TypeScript strict mode (no implicit any, no `any` escape hatch) in `tsconfig.json`
- [X] T004 [P] Configure Tailwind v4 with the Darkroom design tokens (layered near-blacks, single amber safelight accent, off-white type, tabular numerals) in `src/ui/theme/tokens.css` + `tailwind.config`
- [X] T005 [P] Configure ESLint incl. a module-boundary import rule that forbids `src/modules/*` importing a sibling `src/modules/*` (Constitution V) in `.eslintrc`
- [X] T006 [P] Configure Vitest + React Testing Library (`vitest.config.ts`) and Playwright (WebKit + mobile viewport) (`playwright.config.ts`)
- [X] T007 [P] Configure Next.js static export (`output: 'export'`) in `next.config.ts` and COOP/COEP cross-origin-isolation headers in `vercel.json` (research R13)
- [X] T008 [P] Author `public/manifest.json` (standalone, portrait, theme_color near-black) and generate app + apple-touch icons in `public/icons/`
- [X] T009 [P] Configure self-hosted fonts via `next/font` (Be Vietnam Pro primary + Noto Sans fallback) in `src/app/[locale]/layout.tsx` (research R8)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared engine core, design system, i18n, persistence, and service-worker infrastructure that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 Define the EditState / Operation / Layer types and the OperationType registry with per-op param ranges in `src/engine/editState/types.ts` (contracts/edit-state.md)
- [X] T011 Implement the pure, synchronous edit-state reducer with per-param clamping and per-gesture history coalescing in `src/engine/editState/reducer.ts`
- [X] T012 Implement the bounded undo/redo history ring (inverse-patch entries, historyIndex) in `src/engine/editState/history.ts`
- [X] T013 Implement lossless serialize/deserialize and the `migrate(vN→vN+1)` chain in `src/engine/editState/serialize.ts`
- [X] T014 [P] Unit test: reducer clamp + serialize round-trip (`deserialize(serialize(s))` deep-equals) in `tests/unit/editState.test.ts`
- [X] T015 Create the single shared WebGL2 context, framebuffer-ping-pong pass framework, and `webglcontextlost` rebuild-from-EditState recovery in `src/engine/gl/context.ts` + `src/engine/gl/pass.ts`
- [X] T016 Implement Display-P3 end-to-end color management with uniform sRGB fallback in `src/engine/color/space.ts` (research R14)
- [X] T017 Implement the Engine surface (dispatch/getState/subscribe, project lifecycle, invalidate/renderPreview, getPreviewCanvas, setCompareMode) in `src/engine/index.ts` (contracts/engine.md)
- [X] T018 Implement the render orchestrator skeleton: working-resolution GL preview pipeline + Fabric.js overlay composite onto the single on-screen canvas in `src/engine/render/orchestrator.ts`
- [X] T019 Configure next-intl request/routing config and the `[locale]` (`en`|`vi`) segment layout in `src/i18n/request.ts`, `src/i18n/routing.ts`, `src/app/[locale]/layout.tsx`
- [X] T020 Create the `en.json` + `vi.json` catalog skeletons with `common.*` and `errors.*` namespaces in `src/i18n/messages/`
- [X] T021 [P] Unit test: catalog parity (`keys(en) === keys(vi)`, no empty/key-equal values) in `tests/unit/i18n-parity.test.ts`
- [X] T022 Implement the idb typed schema (`drafts`/`presets`/`settings` stores) and SettingsStore (locale/sound/exportDefaults/unlocks) in `src/persistence/db.ts` + `src/persistence/settings.ts` (contracts/persistence.md)
- [X] T023 Build the Darkroom design-system primitives (layered surfaces, safelight-accent active state, off-white type, ledger numerals) in `src/ui/primitives/`
- [X] T024 Build the bottom-sheet ToolSheet with peek/half/full detents, velocity-honoring interruptible spring physics in `src/ui/ToolSheet.tsx`
- [X] T025 Build the `useParamScrub` whole-photo gesture hook (horizontal = value, vertical = switch param, large readout; dispatch throttled, readout not) in `src/ui/useParamScrub.ts`
- [X] T026 Build the shared `PrecisionLoupe` component and the compare hook mapped to `engine.setCompareMode` in `src/ui/PrecisionLoupe.tsx` + `src/ui/useCompare.ts`
- [X] T027 Build the safe-area one-handed app shell (`env()` insets, `100dvh`, pull-to-refresh/text-selection suppression) with reduced-motion + sound-toggle plumbing, plus the interface-feedback layer that plays the single real haptic tick on discrete taps and the short low-volume simulated-detent tick sound during scrubbing — both gated by the sound toggle and reduced-motion (FR-012, design §Motion & feedback) — in `src/ui/AppShell.tsx` + `src/ui/feedback.ts`
- [X] T028 Implement the ToolModule registry + editor-screen scaffold that hosts module Panels in the ToolSheet in `src/app/[locale]/edit/page.tsx` + `src/ui/moduleRegistry.ts` (contracts/engine.md)
- [X] T029 Implement the Serwist service worker: app-shell precache + navigation fallback in `src/app/sw.ts` (runtime caching of models/assets added by their stories)
- [X] T030 Build the home / import-launch screen scaffold in `src/app/[locale]/page.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1.1 - Import → full-resolution result out (Priority: P1) 🎯 MVP

**Goal**: Import a photo (library or native camera handoff, HEIC-safe), display it, and export/share at full original resolution.

**Independent Test**: Add a 48 MP JPEG and a HEIC photo; export both as PNG and JPEG; confirm exported dimensions equal the original with no blank/crash; Share opens the sheet with download fallback.

- [X] T031 [US1.1] Implement photo intake via `<input type="file" capture>` for library pick and native camera handoff (no live camera) in `src/engine/import/intake.ts` + import UI on the home screen
- [X] T032 [US1.1] Implement native-first decode with heic2any lazy fallback and EXIF-orientation application, normalized into the working color space, producing an `OriginalImage` in `src/engine/import/decode.ts` (research R9)
- [X] T033 [US1.1] Display the imported `OriginalImage` on the preview canvas at correct orientation/aspect via the render orchestrator in `src/engine/render/orchestrator.ts`
- [X] T034 [US1.1] Implement the tiled full-resolution export renderer (2048² tiles through the same GL pipeline, OffscreenCanvas worker with main-thread fallback) in `src/engine/export/tiler.ts` (research R11)
- [X] T035 [US1.1] Implement streaming JPEG (@jsquash) + PNG (fast-png) encoders fed stitched row bands, embedding the Display-P3 ICC profile, in `src/engine/export/encode.ts`
- [X] T036 [US1.1] Implement export delivery: define the canonical social aspect-ratio preset set (IG 1:1 & 4:5, vertical 9:16, a Facebook ratio, freeform) in `src/shared/aspectRatios.ts` and offer it at export, applied to the full-resolution render (FR-113); PNG/JPEG format choice; `navigator.share({files})` files-only; and anchor-download fallback in `src/engine/export/deliver.ts` + export UI
- [X] T037 [P] [US1.1] Handle import edge cases (corrupt/zero-dimension/unsupported) with bilingual errors in `src/engine/import/validate.ts` + `errors.*` catalog

**Checkpoint**: The import→view→export backbone every other tool plugs into is functional.

---

## Phase 4: User Story 1.2 - Adjust light and color (Priority: P1)

**Goal**: Real-time, non-destructive global light/color adjustments (12 params).

**Independent Test**: Scrub each control → preview updates live; reset returns exactly to prior state; export reflects all adjustments.

- [X] T038 [P] [US1.2] Implement the global-adjustment GL shader pass (brightness…sharpness, 12 params) in `src/engine/gl/passes/adjust.ts`
- [X] T039 [US1.2] Build the adjust module Panel wiring the 12 params through `useParamScrub` → `adjust` op dispatch with per-control reset in `src/modules/adjust/`

---

## Phase 5: User Story 1.3 - Crop, rotate, straighten, perspective (Priority: P1)

**Goal**: Reframe with ratio/freeform crop, 90° rotate, fine straighten, perspective correction, with guides.

**Independent Test**: Crop to a preset ratio, rotate, straighten with grid, apply perspective; composition updates and exports correctly.

- [X] T040 [US1.3] Implement the geometry stage (crop rect + rotate90 + straighten angle + perspective quad) applied before pixel passes in the render pipeline in `src/engine/render/geometry.ts`
- [X] T041 [US1.3] Build the crop module Panel: preset ratios from the shared aspect-ratio set (`src/shared/aspectRatios.ts` — 1:1, 4:5, 9:16, FB, freeform), rotate/straighten, perspective, rule-of-thirds/grid guides in `src/modules/crop/`
- [X] T042 [US1.3] Track a `cropStateHash` on geometry-changing ops in the edit-state so downstream detection can later invalidate against it (the `DetectedLandmarkSet` cache itself is built with the vision layer in T061) in `src/engine/editState/`

---

## Phase 6: User Story 1.4 - Advanced color control (Priority: P2)

**Goal**: Curves, color mixer, color grading/split-tone, white balance with eyedropper.

**Independent Test**: Bend the red curve only; desaturate only the red band; pick a neutral gray; each isolated, correct, preserved through export.

- [X] T043 [P] [US1.4] Implement the curves GL pass (per-channel 256×1 LUT texture) and Panel in `src/engine/gl/passes/curves.ts` + `src/modules/adjust/curves/`
- [X] T044 [P] [US1.4] Implement colorMixer (8 bands H/S/L), colorGrade (S/M/H + split-tone) GL passes and Panels in `src/engine/gl/passes/color.ts` + `src/modules/adjust/color/`
- [X] T045 [US1.4] Implement whiteBalance (temp/tint + image-space neutral-picker eyedropper) GL pass and Panel in `src/engine/gl/passes/whiteBalance.ts` + `src/modules/adjust/whiteBalance/`

---

## Phase 7: User Story 1.5 - Filters, film looks, creative finishing (Priority: P2)

**Goal**: One-tap filter library with adjustable intensity plus finishing effects.

**Independent Test**: Apply filters at 0–100% intensity; stack vignette + grain; all combinable, adjustable, exported faithfully.

- [X] T046 [US1.5] Create the filter index and LUT loader with `filter` op (filterId + intensity 0–1) blended proportionally in `public/filters/index.json` + `src/modules/filters/` + `src/engine/gl/passes/filter.ts`
- [X] T047 [P] [US1.5] Implement the finishing GL passes (vignette, grain, clarity/texture, dehaze, fade/matte, bloom) and Panel in `src/engine/gl/passes/finishing.ts` + `src/modules/filters/finishing/`
- [X] T048 [US1.5] Wire the two-tap intensity interaction (tap to apply, tap again for strength) into the filters Panel in `src/modules/filters/`

---

## Phase 8: User Story 1.6 - Save and reuse presets/recipes (Priority: P2)

**Goal**: Save/apply/manage named recipes and export/import a shareable code.

**Independent Test**: Save a look, apply to another photo → identical result; export a code and re-import → equivalent preset.

- [X] T049 [US1.6] Implement the PresetStore (save/apply/rename/reorder/delete over portable op types only) + presets module Panel in `src/persistence/presets.ts` + `src/modules/presets/`
- [X] T050 [US1.6] Implement the `MYPIX1.` share-code encode/decode (deflate-raw via CompressionStream → base64url, schema-validate + migrate on import) in `src/persistence/presetCode.ts`
- [X] T051 [P] [US1.6] Unit test: preset codec round-trip (`importCode(exportCode(p)) ≡ p`) in `tests/unit/preset-codec.test.ts`

---

## Phase 9: User Story 1.7 - Compare, undo/redo, re-edit any step (Priority: P1)

**Goal**: Before/after compare, press-and-hold reveal, undo/redo, non-destructive re-edit of prior steps.

**Independent Test**: Use divider + hold-reveal; undo/redo several steps; reopen an earlier adjustment and change it without losing later independent edits.

- [X] T052 [US1.7] Build the before/after divider + press-and-hold "peek at the negative" UI wired to `engine.setCompareMode` in `src/ui/Compare.tsx` + editor screen
- [X] T053 [US1.7] Build undo/redo controls and the reopen-prior-step re-edit affordance (`op/update` on stack id) in the editor screen `src/app/[locale]/edit/page.tsx`

---

## Phase 10: User Story 1.8 - Draft autosave and recovery (Priority: P1)

**Goal**: Auto-persist edit state (never pixels) and restore after close/reload/reclaim.

**Independent Test**: Begin editing, reload, reopen → in-progress edit restored with working undo; re-pick a different photo → clear mismatch message.

- [X] T054 [US1.8] Implement the DraftStore: debounced (~1 s) autosave + `visibilitychange`/`pagehide` flush + ≤50 KB thumbnail + `navigator.storage.persist()`, and graceful handling of IndexedDB write failures / `QuotaExceededError` (catch, surface a bilingual "export to keep this result" prompt rather than failing silently — spec Edge Case "Storage full / eviction") in `src/persistence/drafts.ts` + `errors.*` catalog
- [X] T055 [US1.8] Build the resume card + fingerprint re-link flow (`engine.restoreDraft`) with explicit non-silent mismatch UX in `src/ui/ResumeCard.tsx` + `src/engine/import/relink.ts`

---

## Phase 11: User Story 1.9 - Full English/Vietnamese use (Priority: P1)

**Goal**: Visible language toggle switching the whole UI in-place, with correct Vietnamese diacritics, persisted.

**Independent Test**: Toggle EN↔VI mid-edit → every string switches, edit state untouched, tone marks (ế ộ ữ ẫ ợ) render unclipped; restart → language remembered.

- [X] T056 [US1.9] Build the visible persistent EN/VI toggle that switches locale client-side without remounting the engine/canvas, persisting to settings + cookie in `src/ui/LocaleToggle.tsx`
- [X] T057 [US1.9] Populate full `en`/`vi` catalog entries for all Phase 1 tool namespaces (`tools.adjust.*`, `tools.crop.*`, `import.*`, `export.*`, `gift.*`) with generous line-height/no-clip layout in `src/i18n/messages/`

---

## Phase 12: User Story 1.10 - Install to home screen and use offline (Priority: P1)

**Goal**: Installable standalone PWA that loads and functions offline, updating without disrupting an in-progress session.

**Independent Test**: Install, enable airplane mode, launch → shell loads; import→edit→export works fully offline; a new version updates cleanly.

- [X] T058 [US1.10] Build the in-app iOS install guidance (Share → Add to Home Screen) and first-run-offline bilingual explanation in `src/ui/InstallGuide.tsx`
- [X] T059 [US1.10] Extend the service worker with runtime cache-first for assets, offline navigation fallback, and a `skipWaiting`-on-user-consent update flow in `src/app/sw.ts`

**Checkpoint**: Phase 1 is a complete, installable, offline, bilingual standalone editor (MVP+).

---

## Phase 13: User Story 2.1 - Detect the face and reshape features (Priority: P1)

**Goal**: On-device face detection with natural, feature-confined reshape controls.

**Independent Test**: Detect face; adjust each reshape control → only the targeted feature changes with smooth falloff, background stable; handle no-face and multi-face.

- [X] T060 [US2.1] Implement the FaceLandmarkProvider (MediaPipe Face Landmarker, 478 pts) as a lazy singleton with CPU/WASM-default delegate selection in `src/vision/faceLandmarker.ts` (research R3, contracts/vision.md)
- [X] T061 [US2.1] Implement region-polygon derivation + `DetectedLandmarkSet` caching keyed by `{fingerprint, cropStateHash}` (invalidated by the `cropStateHash` tracked in T042) in `src/vision/regions.ts` + `src/vision/cache.ts`
- [X] T062 [US2.1] Implement the barycentric mesh-warp geometry (face tessellation + border anchor ring, Delaunay) and the GL warp pass in `src/shared/warp/mesh.ts` + `src/engine/gl/passes/warp.ts` (research R5)
- [X] T063 [US2.1] Build the faceReshape module: per-feature `params→displacement` functions (jaw…eyeSpacing) and Panel in `src/modules/face/`
- [X] T064 [P] [US2.1] Unit test: warp displacement math (per-feature confinement, anchor-ring zero falloff) in `tests/unit/warp.test.ts`
- [X] T065 [US2.1] Build the multi-face picker and the no-face availability fallback suggesting manual warp in `src/modules/face/FaceSelect.tsx`
- [X] T066 [US2.1] Add service-worker runtime caching of the face `.task` model with a bilingual "needs one online load" offline message in `src/vision/modelLoader.ts` + `src/app/sw.ts`

---

## Phase 14: User Story 2.2 - Retouch skin naturally (Priority: P1)

**Goal**: Texture-preserving skin smoothing and natural tone/whitening, confined to skin.

**Independent Test**: Smooth skin → pores/texture remain visible at full res while uneven areas even out; strength ramps smoothly; tone shift looks natural.

- [X] T067 [US2.2] Implement frequency-separation smoothing GL passes (guided-filter low-freq blur, high-freq preserve, recombine, strength lerp) in `src/engine/gl/passes/skinSmooth.ts` (research R6)
- [X] T068 [US2.2] Implement the skin mask (faceOval minus eyes/brows/lips/nostrils + YCbCr chroma test, feathered) and tone/whitening shift + skin module Panel in `src/modules/skin/`

---

## Phase 15: User Story 2.3 - Targeted eye, teeth, under-eye enhancements (Priority: P2)

**Goal**: Region-confined teeth whitening, eye brightening, under-eye reduction.

**Independent Test**: Apply each → effect confined to the correct facial region, looks natural.

- [X] T069 [US2.3] Build the targetedEnhance module (teeth/eye/under-eye strengths, each masked to its landmark region) with GL pass + Panel in `src/modules/face/targeted/` + `src/engine/gl/passes/targeted.ts`

---

## Phase 16: User Story 2.4 - One-tap auto-beautify (Priority: P1)

**Goal**: One action applying a tasteful default combination of Phase 2 face enhancements, each still adjustable.

**Independent Test**: Tap auto-beautify on a portrait → balanced result in ≤~3 s; components individually adjustable/undoable; no-face → guarded.

- [X] T070 [US2.4] Implement autoBeautify as a composite that inserts its component ops (skinSmooth + targetedEnhance + subtle faceReshape) at default strengths so each stays individually editable, with a no-face guard, in `src/modules/face/autoBeautify.ts`

---

## Phase 17: User Story 2.5 - Detect the body and reshape it (Priority: P2)

**Goal**: On-device pose detection with waist/leg/arm/height reshape that protects the background.

**Independent Test**: Detect body; slim waist / lengthen legs → subject reshapes naturally, straight background lines acceptably intact; no-body → manual-warp fallback.

- [X] T071 [US2.5] Implement the PoseLandmarkProvider (MediaPipe Pose Landmarker, 33 pts) as a lazy singleton in `src/vision/poseLandmarker.ts`
- [X] T072 [US2.5] Build the bodyReshape module: coarse pose+limb-axis+border-anchor mesh, waist/leg/arm/height displacement functions, no-body fallback, Panel in `src/modules/body/`

---

## Phase 18: User Story 2.6 - Manual push/pull warp with precision (Priority: P2)

**Goal**: Liquify brush (push/pull, size/strength), freeze/protect, reconstruct, offset loupe.

**Independent Test**: Push/pull with falloff; freeze an area → stays fixed; loupe appears offset; reconstruct eases warp back.

- [X] T073 [US2.6] Implement the liquify displacement-field accumulation (push/pull strokes → offsets, adjustable radius/strength) sampled in the warp pass in `src/modules/warp/liquify.ts` + `src/engine/gl/passes/warp.ts`
- [X] T074 [US2.6] Add the freeze/protect mask + reconstruct (lerp field toward zero) and integrate the shared `PrecisionLoupe` in `src/modules/warp/`

---

## Phase 19: User Story 2.7 - Portrait-style background blur (Priority: P2)

**Goal**: On-device segmentation with adjustable, clean-edged background blur.

**Independent Test**: Enable blur → subject sharp, background blurs, edge clean at moderate strength; strength scales smoothly.

- [X] T075 [US2.7] Implement the SegmentationProvider (MediaPipe Image Segmenter selfie model) lazy singleton with `refineEdges` guided-filter post-process in `src/vision/segmenter.ts` (research R16)
- [X] T076 [US2.7] Build the backgroundEffect blur mode: mask-confined variable blur with feathered edge + background module Panel in `src/modules/background/` + `src/engine/gl/passes/bgBlur.ts`

---

## Phase 20: User Story 2.8 - Remove and replace the background (Priority: P3)

**Goal**: Cutout with solid-color/grayscale/transparent replacement, edge refinement, transparent PNG export.

**Independent Test**: Remove background; replace with color and grayscale; refine edge; export a transparent PNG with transparency preserved.

- [X] T077 [US2.8] Extend backgroundEffect with replace/grayscale/transparent modes and edge-refinement level in `src/modules/background/`
- [X] T078 [US2.8] Implement the transparent-background PNG export path (`ExportJob.transparentBackground`, alpha composite in tiler/encoder) in `src/engine/export/tiler.ts` + `src/engine/export/encode.ts`

**Checkpoint**: Phase 2 face/body/background intelligence complete.

---

## Phase 21: User Story 3.1 - Apply makeup anchored to the face (Priority: P1)

**Goal**: Landmark-anchored lipstick/blush/eyeshadow/liner/brow, each adjustable and removable.

**Independent Test**: Apply each type → color/opacity/finish adjustable, tracks facial features, individually removable.

- [ ] T079 [US3.1] Implement the makeup Layer with `LandmarkAnchor` (stores intent, re-derives geometry from landmarks at render time) in the render orchestrator in `src/engine/render/layers.ts`
- [ ] T080 [US3.1] Build the makeup module: lipstick/blush/eyeshadow/liner/brow with color/opacity/finish, per-item add/remove, Panel in `src/modules/makeup/`

---

## Phase 22: User Story 3.2 - Text with full Vietnamese support (Priority: P2)

**Goal**: Vietnamese-capable text overlays with styling, correct in full-resolution export.

**Independent Test**: Type stacked-tone-mark Vietnamese, style/move/resize; renders correctly on canvas and in full-res export.

- [ ] T081 [US3.2] Build the text module as a Fabric text Layer: NFC normalization, verified-Vietnamese font restriction, size/color/align/outline/shadow styling in `src/modules/text/`
- [ ] T082 [P] [US3.2] Implement per-tile full-resolution rasterization of Fabric text/overlay layers at export scale in `src/engine/export/rasterizeLayers.ts`

---

## Phase 23: User Story 3.3 - Stickers from a growing library (Priority: P2)

**Goal**: Browse/place/transform stickers from a content-droppable library.

**Independent Test**: Place, move/scale/rotate/opacity, layer, export; a new file + index entry appears without code change.

- [ ] T083 [US3.3] Build the stickers module: `public/stickers/index.json`-driven library, placement + transform + opacity as Layers, SW runtime caching in `src/modules/stickers/` + `public/stickers/index.json`

---

## Phase 24: User Story 3.4 - Frames and borders (Priority: P2)

**Goal**: Adjustable color borders and film-strip/instant-photo frame styles.

**Independent Test**: Apply frames, adjust width/color; compose correctly and export at full resolution.

- [ ] T084 [US3.4] Build the frames module: adjustable-width color borders + film-strip/instant styles that adapt to aspect ratio in `src/modules/frames/` + `public/frames/index.json`

---

## Phase 25: User Story 3.5 - Manual clone stamp and heal (Priority: P2)

**Goal**: Source-sampled clone and texture-blending heal, no AI.

**Independent Test**: Clone over an object and heal over a blemish → repairs blend acceptably and export at full resolution.

- [ ] T085 [US3.5] Implement the retouch module clone-stamp (`retouch` op: source-offset stroke copy) with GL pass in `src/modules/retouch/` + `src/engine/gl/passes/retouch.ts`
- [ ] T086 [US3.5] Add the heal variant (sampled texture blended into surrounding tone) in `src/modules/retouch/heal.ts`

---

## Phase 26: User Story 3.6 - Double exposure and blend modes (Priority: P3)

**Goal**: Combine a second image via blend modes with adjustable opacity.

**Independent Test**: Blend a second image, cycle blend modes and opacity; composite previews and exports correctly.

- [ ] T087 [US3.6] Build the blend module: second-image Layer with blend modes (screen/multiply/overlay…) + opacity in `src/modules/blend/`

---

## Phase 27: User Story 3.7 - Collage maker (Priority: P3)

**Goal**: Multi-photo layouts with adjustable cells/spacing/background, high-res export.

**Independent Test**: Create a collage, adjust layout/spacing, reposition/swap a cell, export at high resolution.

- [ ] T088 [US3.7] Build the collage mode as a `CollageProject` (cells referencing multiple source images, layouts, spacing, background) with high-res export in `src/modules/collage/`

---

## Phase 28: User Story 3.8 - Freehand draw/doodle (Priority: P3)

**Goal**: Freehand brush with adjustable size/color/opacity.

**Independent Test**: Draw with different brush settings → smooth strokes; export at full resolution.

- [ ] T089 [US3.8] Build the draw module: freehand doodle brush Layer (size/color/opacity) via Fabric free-draw in `src/modules/draw/`

**Checkpoint**: Phase 3 creative & makeup layer complete; all creative content is a Layer that rasterizes into export.

---

## Phase 29: User Story 4.1 - Verified complete bilingual experience (Priority: P1)

**Goal**: Every user-facing string present, correct, natural in EN+VI with no clipping.

**Independent Test**: Walk the whole app in each language → no missing/untranslated/placeholder strings, no clipped labels, natural Vietnamese.

- [ ] T090 [US4.1] Audit every module's `tools.<id>.*` namespace for full EN+VI coverage and natural (human-reviewed) Vietnamese phrasing; fix any clipping/overflow in `src/i18n/messages/` + affected components
- [ ] T091 [P] [US4.1] Extend the i18n-parity test to assert full coverage across all namespaces and fail on any English-fallback in `vi` in `tests/unit/i18n-parity.test.ts`

---

## Phase 30: User Story 4.2 - Verified Vietnamese font rendering (Priority: P1)

**Goal**: Tone-mark-heavy Vietnamese verified on screen and in exported images.

**Independent Test**: Render tone-mark-heavy strings across UI and exported text overlays → correct, unclipped glyphs everywhere.

- [ ] T092 [US4.2] Verify tone-mark-heavy Vietnamese rendering across UI and full-res exported text overlays (adequate vertical spacing, no clipping); screen out any offending overlay font in `tests/device/vietnamese-fonts.md` + `src/modules/text/fonts.ts`

---

## Phase 31: User Story 4.3 - Verified performance on the target device (Priority: P1)

**Goal**: iPhone 17 Pro Safari (installed PWA) meets export/detection performance with no memory crashes.

**Independent Test**: On device, run repeated 48 MP exports + face/body/segmentation across a session → acceptable speed, no memory-driven crash/reload.

- [ ] T093 [US4.3] Author and run the device performance matrix (48 MP tiled export, face/body/segmentation repetition, memory ceiling), recording concrete numeric pass thresholds that make SC-009 (scrub preview frame rate — e.g., target fps) and SC-011 (full-res export completion time) independently measurable, in `tests/device/performance.md`
- [ ] T094 [US4.3] Apply performance hardening from matrix findings (working-res preview caps, tile size, provider disposal on project close, GL resource reuse) across `src/engine/` + `src/vision/`

---

## Phase 32: User Story 4.4 - Verified installability and offline behavior (Priority: P1)

**Goal**: End-to-end install → offline edit/export → clean update without draft corruption on the target device.

**Independent Test**: Install, go offline, complete import→edit→export, reconnect → update applies cleanly, in-progress draft survives.

- [ ] T095 [US4.4] Author and run the device install/offline/update matrix (install, airplane-mode full flow, online update preserving an in-progress draft) in `tests/device/pwa-offline.md`

**Checkpoint**: All four phases verified on the target device.

---

## Phase 33: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story hardening, automated flow coverage, and gift-personal delight

- [ ] T096 [P] Playwright flow tests: import→edit→export, draft recovery via reload, locale switch mid-edit, offline via route interception in `tests/integration/flows.spec.ts`
- [ ] T097 [P] GL golden-image tile render spot-checks (WebKit) in `tests/integration/gl-golden.spec.ts`
- [ ] T098 Verify FR-309: all Phase 3 creative layers (makeup/text/stickers/frames/blend/collage/doodle/retouch) rasterize into the full-resolution export in `src/engine/export/rasterizeLayers.ts`
- [ ] T099 [P] Implement the "developing" export reveal + content-shaped skeleton loading/empty states in `src/ui/`
- [ ] T100 [P] Implement the tasteful gift easter-eggs (long-press-logo private note, date-triggered accent, secret filter unlock) behind `settings.unlocks` in `src/ui/gift/`
- [ ] T101 Run the full quickstart.md validation V1–V8 and confirm the Constitution Check in plan.md still holds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**.
- **Phase 1 stories (US1.1–1.10)**: Depend on Foundational. US1.1 is the backbone; US1.2/1.3 depend on US1.1's render/export; US1.4/1.5 build on the adjust engine (US1.2); US1.6 depends on US1.2/1.5; US1.7/1.8/1.9/1.10 depend only on Foundational + US1.1.
- **Phase 2 stories (US2.1–2.8)**: Depend on all Phase 1 being shippable. US2.1 establishes vision + mesh warp (blocks US2.2–2.6 face work); US2.5 adds pose; US2.7 adds segmentation (blocks US2.8).
- **Phase 3 stories (US3.1–3.8)**: Depend on Phase 2 (makeup needs face landmarks; layers need the Fabric composite). US3.2's export rasterization (T082) is reused by all creative stories.
- **Phase 4 stories (US4.1–4.4)**: Depend on all prior features existing (they verify the finished set).
- **Polish (Phase 33)**: Depends on the desired stories being complete.

### Within Each User Story

- Vision provider before the module that consumes it; GL pass before the Panel that dispatches it; models/services before UI.
- Story complete and independently testable before moving to the next priority.

### Parallel Opportunities

- All `[P]` Setup tasks (T003–T009) run together.
- Foundational `[P]` tests (T014, T021) run alongside their implementation once types exist.
- Within a story, `[P]` tasks touch different files (e.g., T038 shader vs T039 Panel; T043/T044 different passes).
- Once Foundational completes, Phase 1 stories US1.7/1.8/1.9/1.10 can proceed in parallel with the US1.2–1.6 tool chain (different files, independent).

---

## Parallel Example: User Story 1.4

```bash
# Different GL passes, independent files:
Task: "T043 curves GL pass + Panel in src/engine/gl/passes/curves.ts"
Task: "T044 colorMixer + colorGrade GL passes + Panels in src/engine/gl/passes/color.ts"
# T045 (whiteBalance) follows since it shares the color Panel host.
```

---

## Implementation Strategy

### MVP First (Phase 1)

1. Complete Setup (Phase 1) + Foundational (Phase 2).
2. Deliver US1.1 (import→export backbone) → **STOP and VALIDATE** (quickstart V1) — this alone proves the hardest constraint (full-res export on device).
3. Layer US1.2/1.3/1.7/1.8/1.9/1.10 to reach a complete, installable, offline, bilingual editor (quickstart V2–V4).

### Incremental Delivery

- **Phase 1 ship**: a complete standalone photo editor (MVP).
- **Phase 2 ship**: + face/body/background intelligence.
- **Phase 3 ship**: + creative & makeup layer.
- **Phase 4 ship**: verified on the target device.

Each phase is a self-contained, shippable slice that does not break earlier phases (spec "Phased Delivery Model").

---

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- `[Story]` labels use the spec's own numbering (US1.1 … US4.4) for direct traceability.
- Constitution V is enforced structurally: modules communicate only via `engine.dispatch()` and the edit-state contract — never sibling-import (lint rule T005).
- Tests included are only the contract-mandated unit tests, the Phase 4 device matrix, and a small Playwright flow set — not blanket per-story tests.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
