# Implementation Plan: MyPix — Beauty & Photo Editing PWA

**Branch**: `001-beauty-photo-editor` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-beauty-photo-editor/spec.md`

## Summary

MyPix is a fully client-side, bilingual (English/Vietnamese), installable PWA photo and beauty editor targeting iPhone 17 Pro Safari. Users import a photo (library or native camera handoff, with HEIC fallback), edit non-destructively through four phased tool suites (core adjustments → face/body intelligence → creative/makeup layer → polish/verification), and export at full original resolution via tiled processing. The technical approach: Next.js (App Router, TypeScript) with a Fabric.js canvas composition layer, MediaPipe Tasks Vision (Face Landmarker, Pose Landmarker, Image Segmenter) running entirely on-device, landmark-driven mesh warping with barycentric interpolation for reshape, frequency-separation skin smoothing, IndexedDB (idb) for JSON-only draft state, and Vercel free-tier static hosting with zero backend image processing.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Next.js 15 App Router, React 19

**Primary Dependencies**:
- Next.js (App Router) — app shell, routing, static export to Vercel
- Fabric.js v6 — canvas object model for the layered editing surface (stickers, text, frames, collage, draw, overlays)
- @mediapipe/tasks-vision — Face Landmarker (478-point mesh), Pose Landmarker, Image Segmenter (selfie-segmentation mode); all WASM, fully client-side
- Tailwind CSS v4 — UI styling ("Darkroom" design language)
- next-intl — English/Vietnamese localization (chosen over i18next; see research.md R7)
- next/font — Be Vietnam Pro (primary, full Vietnamese diacritics) with Noto Sans fallback, self-hosted for offline
- heic2any — client-side HEIC decode fallback where Safari can't decode natively
- idb — typed IndexedDB wrapper for draft/edit-state JSON (never image pixels)
- Custom WebGL2 pipeline — real-time adjustments, filters, curves, mesh warp, frequency-separation skin smoothing (native browser API, no library dependency)

**Storage**: IndexedDB via idb — edit-state JSON, presets, language preference, sticker-library index. Original image pixels are never persisted; drafts re-link to the source file. localStorage only for tiny flags (locale).

**Testing**: Vitest + React Testing Library (unit: edit-state reducers, preset codec, i18n completeness, geometry/warp math); Playwright (integration: import→edit→export flows, offline mode, locale switching); manual on-device verification matrix for Phase 4 (iPhone 17 Pro Safari installed PWA).

**Target Platform**: iOS Safari (iPhone 17 Pro) as installed home-screen PWA — primary; desktop/Android browsers as secondary dev targets. Deploy: Vercel free tier (static hosting + headers only; no server compute for images).

**Project Type**: Single-page web application (PWA), frontend-only — no backend.

**Performance Goals**: Interactive preview updates while scrubbing adjustments (perceived real-time on a downscaled working preview); auto-beautify incl. face detection ≤ ~3 s on target device; 48 MP full-resolution tiled export completes without canvas blanking, crash, or reload; 120 Hz-safe UI motion (compositor-only properties).

**Constraints**: Zero ongoing cost, zero server-side image processing; offline-capable after install (service worker app-shell + model/asset caching); iOS single-canvas pixel limit (~16.7 MP visible area) → tiled full-res export; iOS PWA memory ceiling → downscaled working preview, full-res only at export, one shared GPU context; canvas context loss on backgrounding → rebuildable render state; 7-day storage eviction risk → export framed as durable save; wide-gamut (Display-P3) color consistency preview↔export; non-destructive edit stack throughout.

**Scale/Scope**: Single user, single primary device; 4 phases, 30 user stories, 56 functional requirements; 17 tool modules over a shared engine; no accounts, no sync, no backend.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Zero Ongoing Cost | ✅ PASS | Vercel free tier static hosting; all libraries free/open-source (MIT/Apache); MediaPipe models are Apache-2.0; no paid APIs, no metered services. |
| II | Client-Side Processing, Free/OSS Tools | ✅ PASS | All processing (decode, adjust, detect, segment, warp, export) on-device: MediaPipe WASM, Fabric.js, native Canvas2D/WebGL2. No image pixels ever leave the device. heic2any, idb, next-intl all MIT/permissive. |
| III | Safari PWA Target Fidelity | ✅ PASS | Camera via `<input type="file" capture>` (no getUserMedia); tiled export for the iOS canvas limit; single shared WebGL context; context-loss recovery; MediaPipe CPU/WASM delegate preferred where the iOS GPU delegate is buggy; on-device verification is Phase 4's whole job. |
| IV | Full Bilingual EN+VI | ✅ PASS | next-intl with `en`/`vi` message catalogs as single source of truth; visible persistent toggle; Be Vietnam Pro (built for Vietnamese diacritics) + Noto Sans fallback via next/font, self-hosted. |
| V | Modular Separation of Concerns | ✅ PASS | Engine (render/edit-state/export) and per-domain modules (adjust, face, body, background, makeup, creative, export) with a shared/common layer; modules communicate only via the edit-state contract (see Project Structure). |
| VI | Non-Destructive Editing | ✅ PASS | Immutable original + ordered edit-stack (operations with parameters) as sole render source of truth; pixels flattened only at export; undo/redo and step re-editing over the stack; drafts persist the stack JSON only. |
| VII | TypeScript Throughout | ✅ PASS | TS strict everywhere; typed edit-state schema (versioned); no `any` escape hatches; idb used with typed schema. |

**Additional constraint gates**: No backend for processing ✅ (static hosting only). Approved stack ✅ (MediaPipe + Fabric.js + native Canvas/WebGL; each addition — next-intl, heic2any, idb — is free, OSS, browser-runnable). PWA requirements ✅ (manifest + service worker, iOS-verified in Phase 4). I18n single source of truth ✅. State model ✅ (original/edit-state separated; export-only flattening).

**Initial gate result: PASS — no violations, Complexity Tracking not required.**

**Post-design re-check (after Phase 1)**: PASS — the data model keeps original image and edit stack separate (Principle VI), module contracts in `contracts/` enforce boundary rules (Principle V), all contract interfaces are client-side and free-stack only (Principles I–II).

## Project Structure

### Documentation (this feature)

```text
specs/001-beauty-photo-editor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── edit-state.md    # Edit-stack operation schema (the central contract)
│   ├── engine.md        # Render engine / tool-module interface
│   ├── vision.md        # Landmark & segmentation provider interface
│   ├── persistence.md   # Draft/preset storage interface + preset share-code format
│   └── i18n.md          # Message catalog & locale contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
public/
├── manifest.json            # PWA manifest (name, icons, standalone)
├── icons/                   # App icons incl. iOS home-screen sizes
├── models/                  # MediaPipe .task model files (self-hosted for offline)
└── stickers/                # Growable sticker library assets + index.json

src/
├── app/                     # Next.js App Router
│   ├── [locale]/            # next-intl locale segment (en | vi)
│   │   ├── layout.tsx       # Fonts (Be Vietnam Pro + Noto Sans), theme, safe areas
│   │   ├── page.tsx         # Home / import screen
│   │   └── edit/page.tsx    # Editor screen (single-page editing surface)
│   └── sw.ts                # Service worker source (app-shell + model caching)
│
├── engine/                  # SHARED CORE — the only code tool modules depend on
│   ├── editState/           # Edit stack: operation types, reducer, undo/redo, versioned schema
│   ├── render/              # Render orchestrator: preview pipeline (downscaled) + Fabric.js layer compositing
│   ├── gl/                  # Single shared WebGL2 context, shader pipeline, context-loss recovery
│   ├── color/               # Color management (P3-aware import→working-space→export)
│   ├── import/              # File/camera intake, HEIC fallback (heic2any), EXIF orientation
│   └── export/              # Tiled full-resolution renderer + PNG/JPEG encode + share/save
│
├── vision/                  # MediaPipe wrappers (lazy-loaded per tool)
│   ├── faceLandmarker.ts    # Face Landmarker lifecycle + typed landmark sets
│   ├── poseLandmarker.ts    # Pose Landmarker lifecycle
│   └── segmenter.ts         # Image Segmenter (selfie-segmentation) lifecycle
│
├── modules/                 # ONE FOLDER PER EDITING DOMAIN (constitution Principle V)
│   ├── adjust/              # Phase 1: light/color adjustments, curves, mixer, grading, WB
│   ├── crop/                # Phase 1: crop/rotate/straighten/perspective
│   ├── filters/             # Phase 1: filter library, film looks, grain/vignette/finishing
│   ├── presets/             # Phase 1: recipes — save/apply/manage/share-code
│   ├── face/                # Phase 2: face reshape (mesh warp), targeted enhancements, auto-beautify
│   ├── skin/                # Phase 2: frequency-separation smoothing, tone
│   ├── body/                # Phase 2: pose-driven body reshape
│   ├── warp/                # Phase 2: manual liquify (push/pull/freeze/reconstruct + loupe)
│   ├── background/          # Phase 2: segmentation blur / removal / replacement
│   ├── makeup/              # Phase 3: landmark-anchored lipstick/blush/eyeshadow/liner/brow
│   ├── text/                # Phase 3: Vietnamese-capable text overlays
│   ├── stickers/            # Phase 3: sticker library & placement
│   ├── frames/              # Phase 3: borders & frame styles
│   ├── retouch/             # Phase 3: clone stamp & heal
│   ├── blend/               # Phase 3: double exposure / blend modes
│   ├── collage/             # Phase 3: multi-photo layouts
│   └── draw/                # Phase 3: freehand doodle brush
│
├── persistence/             # idb-backed draft autosave, presets store, settings
├── i18n/                    # next-intl config + messages/en.json + messages/vi.json
├── ui/                      # Darkroom design system: sheet tray, gesture editing,
│                            # before/after, loupe, haptic/sound feedback, safe-area shell
└── shared/                  # Cross-cutting utils (geometry, barycentric math, image math)

tests/
├── unit/                    # editState reducer, preset codec, warp math, color math, i18n completeness
├── integration/             # Playwright: import→edit→export, offline, locale switch, draft recovery
└── device/                  # Phase 4 manual verification checklists (target device)
```

**Structure Decision**: Single Next.js frontend project (no backend exists to warrant a split). The constitution's module-separation principle is enforced structurally: `src/engine/` is the shared core; each editing domain lives in its own `src/modules/<domain>/` folder and may import from `engine/`, `vision/`, `shared/`, and `ui/` but never from a sibling module — all inter-domain effects flow through the edit-state contract. `vision/` isolates MediaPipe so face, body, makeup, and background modules share one detection layer without coupling to each other.

## Phase Delivery Mapping

| Spec Phase | Modules delivered | Key engine work |
|---|---|---|
| Phase 1 | adjust, crop, filters, presets | engine (editState, render, gl, color, import, export), persistence, i18n, ui shell, PWA/service worker |
| Phase 2 | face, skin, body, warp, background | vision/ wrappers, mesh-warp geometry (shared/), frequency separation shaders (gl/) |
| Phase 3 | makeup, text, stickers, frames, retouch, blend, collage, draw | Fabric.js layer system fully engaged in render/ |
| Phase 4 | — (verification & hardening) | i18n audit tooling, performance passes, device test matrix |

## Complexity Tracking

> No constitution violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
