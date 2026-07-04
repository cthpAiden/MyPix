# Validation Report — MyPix (T101)

**Branch**: `001-beauty-photo-editor` | **Date**: 2026-07-04 | **Against**: [quickstart.md](./quickstart.md), [plan.md](./plan.md)

Records the quickstart V1–V8 validation outcomes and re-confirms the plan's
Constitution Check after Phase 33 (Polish) landed. Split into **automated gates**
(runnable in this environment) and **device-gated scenarios** (require the target
iPhone 17 Pro Safari installed PWA and a browser build; recorded in the
`tests/device/` matrices).

## Automated gates (green)

| Gate | Command | Result |
|------|---------|--------|
| Unit suites | `npm test` | ✅ 5 files / 29 tests pass (editState round-trip, preset codec, warp math, i18n parity + full coverage, layer-rasterization coverage) |
| Types (strict) | `npm run typecheck` | ✅ `tsc --noEmit` exit 0, no `any` |
| Lint incl. module-boundary rule (Constitution V) | `npm run lint` | ✅ no warnings or errors |
| Static export / PWA build | `npm run build` | ✅ 10 routes exported (`/en`, `/vi`, `/en/edit`, `/vi/edit`, `/en/collage`, …); service worker bundled |

Interactive Phase 33 UI verified in a live WebKit-family preview:

- **T100 gift layer** — long-press the home logo reveals the private note **and**
  "A hidden look appeared: First Light"; the unlock persists to IndexedDB
  (`settings.unlocks = ["gift.note", "firstlight"]`), so the secret filter then
  shows in the Filters panel. `mp-shimmer` / `mp-sparkle` keyframes resolve.
- **T099 developing/skeleton** — `.mp-skeleton` shimmer and the developing-reveal
  progress component compile, mount, and animate (auto-neutralized under
  `prefers-reduced-motion`).

## Quickstart scenarios

| Scenario | Coverage | Status |
|---|---|---|
| **V1** Import → full-res export | Playwright `flows.spec.ts` (import→edit→export download) + `gl-golden.spec.ts` (dimensions preserved, tile stitch) | Automated spec authored; run on-device / in CI with `npx playwright install webkit` |
| **V2** Adjustments, curves, filters | `gl-golden.spec.ts` (Noir → grey-axis proves adjust pass at export scale) | Automated spec authored; full scrub-live-preview is device-gated |
| **V3** Compare, undo, drafts | `flows.spec.ts` (draft recovery via reload) | Automated spec authored; compare/hold-reveal device-gated |
| **V4** Bilingual & PWA | `flows.spec.ts` (locale switch mid-edit, offline via `setOffline`) + i18n-parity unit test | Parity ✅ automated; install/airplane-mode device-gated → `tests/device/pwa-offline.md` |
| **V5** Face intelligence | Manual on target device | `tests/device/performance.md` |
| **V6** Body, warp, background | Manual on target device | `tests/device/performance.md` |
| **V7** Creative layer (FR-309) | `layer-rasterization.test.ts` asserts every creative layer kind composites into export; retouch verified as a registered pixel op | Coverage ✅; visual fidelity device-gated |
| **V8** Target-device certification | Manual, installed PWA | `tests/device/{performance,pwa-offline,vietnamese-fonts}.md` |

The Playwright flow + golden specs (T096/T097) drive the real WebGL2 pipeline,
IndexedDB, and tiled export in WebKit; they are type-checked and follow the app's
live DOM. They were **not executed in this headless environment** (WebKit browser
not installed; no GPU for the WebGL2 pipeline) — run them with a real browser via
`npm run test:e2e`.

## Constitution Check (re-confirmed post-implementation)

Phase 33 added only client-side UI (skeletons, developing reveal, gift easter
eggs) plus tests — no new dependencies.

| # | Principle | Status | Note |
|---|-----------|--------|------|
| I | Zero ongoing cost | ✅ | No new deps; nothing metered. |
| II | Client-side, free/OSS | ✅ | Gift/skeleton/reveal are pure client UI; specs reuse the existing `fast-png`. |
| III | Safari PWA fidelity | ✅ | Static export builds; SW bundled; no `getUserMedia`. |
| IV | Full EN+VI | ✅ | New `gift.*` + `tools.filters.items.firstlight` strings added to both catalogs; parity test passes. |
| V | Modular separation | ✅ | Filters module imports `@/ui/gift` (ui layer, allowed) — never a sibling module; boundary lint passes. |
| VI | Non-destructive | ✅ | Unlocks live in `settings`, not the edit stack; the secret look is an ordinary portable `filter` op; reveal/skeleton are view-only. |
| VII | TypeScript throughout | ✅ | `tsc --noEmit` clean; `LayerKind` now derives from a runtime `LAYER_KINDS` source of truth. |

**Result: PASS — the Constitution Check in plan.md still holds.**

## Outstanding (by design, not blocking)

- V5/V6/V8 and the install/airplane-mode legs of V4 require the physical target
  device; procedures + numeric thresholds are recorded in `tests/device/`.
- Execute `flows.spec.ts` / `gl-golden.spec.ts` in CI or locally with WebKit
  installed to turn V1–V4's automated legs green in a headed run.
