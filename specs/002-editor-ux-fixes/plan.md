# Implementation Plan: Editor UX Fixes — Viewport Zoom, Continue-Editing, Face Detection

**Branch**: `002-editor-ux-fixes` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-editor-ux-fixes/spec.md`

## Summary

Three targeted UI/UX fixes to the existing MyPix editor, in priority order:

1. **P1 — Restore face-aware tools.** Root cause is not a code regression: the on-device MediaPipe assets (`public/models/*.task` and the `public/mediapipe/wasm/` fileset) are gitignored and absent from the running build, so every detector 404s on load and `useVision` reports `error` → "Couldn't analyze this photo." Fix by provisioning those assets deterministically (copy the WASM fileset from the installed `@mediapipe/tasks-vision` package; fetch the three `.task` models) and adding a build/dev verification gate so their absence fails loudly instead of silently breaking tools.
2. **P2 — One-tap "Continue editing."** Today the resume flow re-opens the file picker because only a thumbnail is persisted. Persist the original photo bytes (the encoded `Blob`) alongside the draft, keep exactly one draft (most-recent), and resume by decoding the stored blob via the existing `Engine.restoreDraft(state, blob)` path — no picker. Fall back to the existing re-pick flow only when the stored original is missing/evicted.
3. **P3 — Comfortable default view + zoom/pan.** The editor currently scales the preview canvas edge-to-edge (`objectFit: contain` at 100%) with no zoom capability. Add a viewport layer: default to the whole photo with a comfortable margin, and support pinch/double-tap zoom (up to ~4× actual pixels), two-finger pan (constrained), and a visible reset control — implemented as a CSS transform on the preview canvas so existing pointer-based pick/brush coordinate mapping (via `getBoundingClientRect`) keeps working, and single-finger parameter scrub is preserved.

**Technical approach**: All three are contained to the existing Next.js static-export PWA. No new runtime dependencies. The vision fix is build tooling + a verification script. The resume fix is a persistence-schema field + wiring in `ResumeCard`/`drafts`. The zoom fix is a new `useViewport` UI hook + reset control in the editor screen, with the multi-pointer gesture layer sitting in front of the existing single-pointer scrub/pick/brush handlers.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 15.1 (App Router, `output: 'export'`)

**Primary Dependencies**: `@mediapipe/tasks-vision` (on-device detection), `idb` (IndexedDB), `fabric` (canvas objects, unaffected here), `@serwist/next` + `serwist` (service worker / offline caching), native Canvas 2D + WebGL (render pipeline)

**Storage**: IndexedDB via `idb` (`mypix` DB, `drafts`/`presets`/`settings` stores). This feature adds an original-photo `Blob` to the `Draft` value. Vision models + WASM are static assets under `public/`, runtime-cached by the service worker.

**Testing**: Vitest + Testing Library (unit/integration, jsdom); Playwright (e2e). New tests: draft round-trip with stored original, retention (single draft), viewport transform/clamp math, and an asset-presence verification test.

**Target Platform**: Installed iOS Safari PWA on iPhone (primary), modern desktop/mobile browsers (secondary). Static hosting only (no server compute).

**Project Type**: Single-project web application (Next.js PWA). Source under `src/`; static assets under `public/`.

**Performance Goals**: Zoom/pan interaction at 60 fps (CSS-transform driven, no re-render of the GL pipeline). Detection latency unchanged (cached per photo+geometry). No added main-thread work in the steady state.

**Constraints**: Zero ongoing cost; fully client-side; no user pixels leave the device; offline-capable after first model load; COOP/COEP `require-corp` (assets must be same-origin — satisfied by self-hosting). Bounded local storage: exactly one resumable draft retained.

**Scale/Scope**: Small, surgical. ~3 code areas touched (vision provisioning/tooling, persistence + resume UI, editor viewport), one persistence field addition, one new UI hook + reset control, one build script + verification.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| I. Zero Ongoing Cost | Models are Apache-2.0, fetched once at build and self-hosted; no paid APIs, no server compute. Storing a blob locally is free. | ✅ Pass |
| II. Client-Side Processing w/ Free OSS | Fix keeps all detection on-device via MediaPipe; provisioning self-hosts the existing library's WASM + Google's public models. No pixels sent to a server. | ✅ Pass |
| III. Safari PWA Target Fidelity | Zoom uses pinch/double-tap gestures suited to touch; assets self-hosted for COEP/offline; all three fixes validated against installed iOS Safari. Camera intake unchanged (still file-input `capture`). | ✅ Pass |
| IV. Full Bilingual Support | New/changed strings (reset control label, any resume/eviction message) added to `en` + `vi` with diacritics. No hardcoded text. | ✅ Pass |
| V. Modular Separation | Vision provisioning is build tooling; resume touches persistence + its own UI card; viewport is a self-contained UI hook. No module reaches into another's internals. | ✅ Pass |
| VI. Non-Destructive Editing | Resume restores original + separate edit-state exactly as a fresh session; zoom/pan is view-only and never mutates pixels or export output. | ✅ Pass |
| VII. TypeScript Throughout | All code TypeScript strict; provisioning script may be a small Node script (`.mjs`/`.ts`) — build tooling, not app code. No `any` escape hatches in app code. | ✅ Pass |

**Result**: PASS — no violations. Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
specs/002-editor-ux-fixes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── vision-assets.md      # Provisioning + verification contract
│   ├── persistence-draft.md  # Draft-with-original schema + retention
│   └── viewport.md           # Zoom/pan/reset interaction contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
public/
├── models/                    # (provisioned) face/pose/segmenter .task — gitignored
│   └── README.md
└── mediapipe/wasm/            # (provisioned) MediaPipe WASM fileset — gitignored

scripts/                       # NEW — build tooling
└── provision-vision-assets.mjs   # copy WASM fileset + fetch models + verify

src/
├── app/
│   ├── sw.ts                  # (unchanged) already runtime-caches /models & /mediapipe
│   └── [locale]/edit/page.tsx # MODIFIED — mount viewport transform + reset control
├── engine/
│   ├── index.ts               # (reuse) restoreDraft(state, blob) already exists
│   └── import/decode.ts       # (reuse) decodes Blob → OriginalImage
├── persistence/
│   ├── types.ts               # MODIFIED — Draft gains originalBlob
│   └── drafts.ts              # MODIFIED — persist original; retain single draft
├── ui/
│   ├── ResumeCard.tsx         # MODIFIED — one-tap resume via stored blob; re-pick fallback
│   ├── useViewport.ts         # NEW — zoom/pan/reset transform + gesture layer
│   └── ...                    # reset control (small addition, reuse primitives/icons)
├── i18n/messages/
│   ├── en.json                # MODIFIED — new strings (reset, resume/eviction)
│   └── vi.json                # MODIFIED — Vietnamese counterparts
└── vision/                    # (unchanged) loader/providers already correct

package.json                   # MODIFIED — predev/prebuild → provision script
```

**Structure Decision**: Single Next.js app (existing layout). Changes are surgical and land in the modules that own each concern: build tooling in a new top-level `scripts/`, persistence in `src/persistence`, resume UI in `src/ui/ResumeCard.tsx`, and the new viewport concern in a self-contained `src/ui/useViewport.ts` consumed by the editor screen. No architectural restructuring.

## Complexity Tracking

> No Constitution violations — table intentionally empty.
