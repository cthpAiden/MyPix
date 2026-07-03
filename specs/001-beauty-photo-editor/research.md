# Phase 0 Research: MyPix — Beauty & Photo Editing PWA

**Branch**: `001-beauty-photo-editor` | **Date**: 2026-07-04 | **Plan**: [plan.md](./plan.md)

All Technical Context unknowns are resolved below. Each entry records the decision, rationale, and alternatives considered. The user-supplied stack directives (Next.js PWA, Fabric.js, MediaPipe Tasks Vision, Tailwind, next-intl-or-i18next, Be Vietnam Pro/Noto Sans, heic2any, idb, Vercel free tier, no backend image work, barycentric mesh warp, frequency-separation skin smoothing) are treated as fixed constraints; research below selects within them and fills the gaps they leave open.

---

## R1 — App framework & delivery: Next.js App Router, static export

**Decision**: Next.js 15 App Router with TypeScript strict mode, built with `output: 'export'` (fully static) and deployed to Vercel free tier. No server components doing per-request work; the app is a static shell + client bundles.

**Rationale**: User-directed. Static export guarantees zero server compute (Constitution I/II) and makes offline caching tractable — every asset is a static file the service worker can precache. Vercel free tier serves static assets and custom headers at no cost.

**Alternatives considered**: Vite + React SPA (simpler, but user specified Next.js; Next's `next/font` self-hosting and route-level code-splitting are genuinely useful here). Next.js with server runtime (rejected: nothing server-side to do, and dynamic rendering complicates offline caching).

## R2 — Canvas/composition layer: Fabric.js v6

**Decision**: Fabric.js v6 (MIT) as the object/layer model for overlay content — stickers, text, frames, doodle strokes, blend images, collage cells — composited above the WebGL-rendered photo. Fabric is *not* used for pixel adjustments; it owns interactive object manipulation (select/move/scale/rotate, hit-testing, serialization).

**Rationale**: User-directed, and the right split: Fabric excels at an interactive scene graph with touch controls and JSON (de)serialization (which maps directly onto the non-destructive Layer entities in the edit state); it is poor at high-throughput per-pixel work, which the WebGL2 pipeline (R4) handles.

**Alternatives considered**: Konva (similar scope, no advantage), hand-rolled scene graph (large effort for solved problems), doing everything in Fabric filters (rejected: Fabric's filter pipeline can't express curves/frequency-separation/mesh-warp at the needed quality/perf).

## R3 — On-device vision: MediaPipe Tasks Vision (`@mediapipe/tasks-vision`)

**Decision**: MediaPipe Tasks Vision (Apache-2.0) for all detection:
- **Face Landmarker** (478-point mesh) → face reshape control points, region masks for teeth/eyes/under-eye/lips/brows, makeup anchoring.
- **Pose Landmarker** (33-point) → body reshape control points.
- **Image Segmenter**, selfie-segmentation model → background blur/removal confidence mask.

Models (`.task` files) are self-hosted in `public/models/` and precached by the service worker for offline use. Run in `IMAGE` mode (single-shot, not video). On iOS Safari, initialize with the **CPU/WASM delegate**; the GPU delegate is attempted only behind a capability check because it has known instability in iOS Safari WebGL-backed inference.

**Rationale**: User-directed; Apache-2.0 satisfies the cost/licensing gates; the three tasks cover every Phase 2/3 detection need with one dependency and one wrapper layer (`src/vision/`).

**Alternatives considered**: face-api.js (stale, lower-quality 68-point landmarks — insufficient for lip/eyelid-accurate makeup); TensorFlow.js models directly (MediaPipe Tasks wraps the same models with a better lifecycle API); higher-quality matting models e.g. RVM/MODNet/BiRefNet (better hair edges but copyleft or non-commercial weights and much heavier; see R16 — deferred as an optional later upgrade, permissive baseline chosen now).

## R4 — Pixel pipeline: custom WebGL2 shader engine, one shared context

**Decision**: A single shared WebGL2 context (created once, owned by `engine/gl/`) runs the entire adjustment pipeline as shader passes over the working-resolution texture: global adjustments (FR-104) → curves via 256×1 LUT texture (FR-105) → color mixer / grading / split-tone (FR-106) → filter LUT + intensity (FR-109) → finishing effects (FR-110) → mesh warp (R5) → skin frequency separation (R6). Framebuffer ping-pong between passes; float16 intermediate textures where supported. Context-loss (`webglcontextlost`) is handled by rebuilding all GL resources from the edit stack — the edit state is the only source of truth, so recovery is a re-render, not data loss.

**Rationale**: Real-time scrubbing (SC-009) on a phone requires GPU pixel work; WebGL2 is universally available in target Safari, needs no library (zero-dep, Constitution II), and one shared context respects iOS's low limit on concurrent GPU contexts (spec platform-hazard list).

**Alternatives considered**: WebGPU (better API but still inconsistent in installed iOS PWAs; may be added later as a progressive path — the engine's pass abstraction keeps shaders swappable); Canvas2D filters (far too slow, no curves/warp); libraries like glfx.js/pixi (unmaintained or heavyweight; the needed shader set is small and bespoke).

## R5 — Reshape: landmark-driven mesh warp with barycentric interpolation

**Decision**: User-directed technique, concretized as:
1. Build a triangulated mesh over the photo: MediaPipe's canonical face-mesh tessellation for the face region (it ships a fixed triangle topology for the 478 landmarks), plus a ring of border/anchor points around the face and along image edges, Delaunay-triangulated, so warping falls off to zero and the background stays pinned. For body: a coarser Delaunay mesh seeded from pose landmarks + limb-axis offset points + image-border anchors.
2. Each reshape control (jaw, chin, nose tip, eye size, waist, leg length, …) is a pure function `params → per-landmark displacement vectors` acting on a named subset of control points.
3. Render the warp in the WebGL pipeline by drawing the mesh with displaced vertex positions and original UVs — barycentric interpolation of the displacement across each triangle is exactly what the GPU rasterizer does natively, so the "barycentric coordinate interpolation" requirement is met by construction, at full speed.
4. Manual liquify (FR-209) is a separate displacement-field texture (brush strokes accumulate offsets; freeze brush writes a protection mask; reconstruct lerps the field back toward zero), sampled in the same warp pass.

**Rationale**: GPU mesh rendering gives smooth, natural falloff (FR-202, SC-005) at interactive rates; anchor rings mathematically guarantee background pinning; per-feature displacement functions keep each slider's effect confined to its feature.

**Alternatives considered**: Moving-least-squares image deformation on CPU (quality comparable but too slow at preview resolution every frame); per-pixel radial warp functions per feature (simpler but composes badly across overlapping features and distorts backgrounds).

## R6 — Skin smoothing: frequency separation on GPU, mask-confined

**Decision**: User-directed technique, concretized as shader passes:
1. **Low-frequency layer** = edge-preserving blur of the image (guided-filter approximation implemented as separable passes — cheap and halo-free vs. plain Gaussian).
2. **High-frequency layer** = original − low (texture, pores, fine detail).
3. Smooth **only the low layer** (further blur/even-out of color and tone), then recombine `low' + high`, so pores and fine detail survive untouched (FR-204, SC-004).
4. Effect confined by a **skin mask**: face-oval region from Face Landmarker minus eyes/brows/lips/nostrils polygons, refined by a YCbCr skin-tone chroma test, feathered. Strength slider lerps original↔smoothed within the mask. Skin tone/"whitening" (FR-205) is a lightness/tint shift applied through the same mask.

**Rationale**: Frequency separation is the standard texture-preserving retouch technique and maps naturally onto 3–4 small shader passes; the landmark-derived mask keeps it off hair/background/clothes.

**Alternatives considered**: Bilateral filter alone (flattens texture at higher strengths — the exact "plastic" failure the spec forbids); ML skin-retouch models (violates weight-licensing/zero-cost gates and is unnecessary).

## R7 — i18n: next-intl (over i18next)

**Decision**: next-intl with a `[locale]` App Router segment, `messages/en.json` + `messages/vi.json` as the single source of truth, locale persisted (localStorage + cookie) and switchable in-place without losing edit state. A unit test asserts key-set equality between the two catalogs (guards FR-401 continuously, not just in Phase 4).

**Rationale**: The user offered either; next-intl is purpose-built for the App Router (typed messages, locale segment routing, smaller client footprint than i18next+react-i18next+language-detector stack). ICU message format handles the few pluralization/interpolation needs.

**Alternatives considered**: i18next (more plugins, but plugin breadth is unneeded here and its App Router integration is more manual); hand-rolled context + JSON (viable at this scale but forfeits typed keys and ICU formatting for no real saving).

## R8 — Fonts: Be Vietnam Pro + Noto Sans, self-hosted via next/font

**Decision**: Be Vietnam Pro (OFL; designed for Vietnamese — verified full diacritic/stacked-tone-mark coverage) as primary UI and default text-overlay font; Noto Sans (OFL, full Vietnamese coverage) as fallback and alternate overlay font. Loaded with `next/font/google` which self-hosts the files at build time — no runtime Google Fonts requests, so fonts work offline and no data leaves the device. Text-overlay rendering normalizes strings to NFC before drawing to canvas (spec bilingual layout rule) and every candidate overlay font added later must pass a diacritic render test (tone-mark-heavy sample strings rendered and visually verified — Phase 4 FR-402).

**Rationale**: User-directed; `next/font` self-hosting satisfies offline + privacy constraints for free.

**Alternatives considered**: Inter/SF-style faces (attractive but several popular display faces mangle stacked Vietnamese marks — screened out per spec); runtime Google Fonts CDN (rejected: offline + privacy).

## R9 — HEIC intake: native decode first, heic2any fallback

**Decision**: On import, attempt native decode (`createImageBitmap` / `<img>` with the HEIC blob) — current iOS Safari decodes HEIC natively. If decode fails (non-Safari browsers, odd variants), fall back to **heic2any** (LGPL wrapper over libheif-wasm), lazy-loaded only when needed so it never weighs on the common path. EXIF orientation is read and applied at import; the decoded result is normalized into the working color space (R14).

**Rationale**: User-directed fallback; native-first keeps the primary device fast and the wasm decoder covers the rest.

**Alternatives considered**: Always-wasm decode (wastes MBs and CPU on the primary device); no fallback (breaks acceptance scenario 1.1-3 on secondary browsers).

## R10 — Persistence: idb (IndexedDB), edit-state JSON only

**Decision**: `idb` (MIT) with a typed schema; stores: `drafts` (versioned edit-stack JSON + photo fingerprint + thumbnail ≤ ~50 KB for the resume card), `presets` (recipes), `settings` (locale, sound on/off, unlocks). **Never image pixels** (user constraint). Drafts re-link to the original by content fingerprint (size + dimensions + hash of a downsampled sample); if the user re-picks a file that doesn't match, the app explains rather than silently mis-applying (edge case "original no longer available"). Autosave is debounced (~1 s after last change) and flushed on `visibilitychange`. `navigator.storage.persist()` is requested to reduce 7-day eviction risk; UI frames **export** as the durable save.

**Preset share-code format**: versioned JSON → deflate (`CompressionStream`) → base64url, prefixed `MYPIX1.` — copy-paste shareable, no server (FR-112).

**Rationale**: User-directed; JSON-only keeps storage tiny, avoids iOS IndexedDB blob flakiness, and honors "drafts are state, not pixels".

**Alternatives considered**: localStorage for drafts (size limits, synchronous jank); storing pixels in IndexedDB (explicitly excluded by user); File System Access API persistence (not available in iOS Safari).

## R11 — Full-resolution export: tiled WebGL render + WASM/manual encode

**Decision**: Export renders the edit stack at **full original resolution in tiles** (e.g., 2048×2048), each tile rendered through the same GL pipeline with adjusted viewport/UV window, then encoded row-band by row-band:
- **JPEG**: a WASM build of a free encoder (MozJPEG-class, e.g. `@jsquash/jpeg`, permissive licensing) fed stitched RGBA rows — never allocates a full-size canvas, sidesteps the iOS single-canvas limit (~16.7 MP) that would otherwise silently blank (FR-116, SC-011). Default quality ≈ 92.
- **PNG**: streaming scanline encoder (e.g. `fast-png` or equivalent free encoder) for the lossless/transparency path (FR-117, FR-211).
Export runs in a Web Worker where possible (OffscreenCanvas WebGL2 is available in target Safari; a main-thread chunked fallback with progress UI is kept for safety). Overlay layers (Fabric content) are rasterized per-tile at full scale so text/stickers stay crisp (FR-309). Share via `navigator.share({files})` — files-only payload (iOS drops files when mixed with text/URL) — with anchor-download fallback (FR-118).

**Rationale**: The single-canvas ceiling makes naive `canvas.toBlob` at 48 MP impossible on the target device; tiling + streaming encode is the standard zero-cost answer and keeps peak memory to one tile + one row band.

**Alternatives considered**: `canvas.toBlob` on a full-size canvas (blanks/crashes above the iOS limit); server-side encode (constitutionally prohibited); downscaled export (violates FR-116/SC-001).

## R12 — PWA: manifest + Serwist service worker

**Decision**: Hand-authored `manifest.json` (standalone display, portrait, icons incl. apple-touch sizes, `theme_color` matching the Darkroom near-black) plus a **Serwist** (MIT, maintained Workbox successor with first-class Next.js support) service worker: precache the exported app shell (HTML/JS/CSS/fonts/icons), runtime cache-first for MediaPipe `.task` models and sticker assets, navigation fallback for offline launch, and a `skipWaiting`-on-user-consent update flow so an update never yanks the rug mid-edit (acceptance 1.10-3). In-app iOS install guidance (Share → Add to Home Screen) since iOS has no install prompt. First-run-offline (nothing cached) shows a clear bilingual explanation (edge case).

**Rationale**: Serwist gives tested precache-manifest generation for Next static export at zero cost; hand-rolling a SW risks subtle update/caching bugs in exactly the area Phase 4 must certify.

**Alternatives considered**: next-pwa (unmaintained), raw hand-written SW (max control, higher defect risk in update lifecycle), no runtime model caching (breaks offline Phase 2 tools).

## R13 — Hosting & cross-origin isolation on Vercel free tier

**Decision**: Vercel free tier, static output. Response headers set via `vercel.json`: `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless` where supported) to enable cross-origin isolation → `SharedArrayBuffer` → MediaPipe WASM **multithreading**. All assets are same-origin (models/fonts self-hosted) so COEP is satisfiable; heic2any's wasm is served same-origin too. If an embedded asset ever can't satisfy COEP, the fallback is single-threaded WASM (slower but functional) — the vision wrapper detects `crossOriginIsolated` and configures accordingly.

**Rationale**: The spec's threading assumption requires these headers; Vercel free tier allows custom static headers, satisfying it at zero cost. This is also why "no Supabase Edge Functions" is moot: nothing runs server-side at all.

**Alternatives considered**: GitHub Pages (no custom headers without a SW shim), Netlify free (equivalent; Vercel user-directed), COI service-worker shim (kept as documented plan B only).

## R14 — Color management: Display-P3 end to end

**Decision**: The working space is **Display-P3**: import decodes into a P3-tagged context (`createImageBitmap` → canvas with `colorSpace: 'display-p3'`), the GL pipeline treats texels as P3-encoded values, on-screen canvases are created P3 where supported, and export encodes pixels with an embedded Display-P3 ICC profile (both JPEG and PNG paths — the WASM encoders accept an ICC blob). If P3 canvas support is absent (secondary browsers), the whole chain uniformly falls back to sRGB — consistency preserved either way (FR-120, SC-003).

**Rationale**: iPhone photos are P3; an untagged pipeline visibly desaturates them between preview and export (spec platform-hazard). One declared space end-to-end is the simplest correct scheme.

**Alternatives considered**: sRGB everywhere (loses wide-gamut fidelity of the primary device's own photos); per-image ICC honoring with LittleCMS-wasm (correct but heavy; unnecessary when sources are overwhelmingly P3/sRGB — revisit only if a real photo surfaces a shift).

## R15 — UI/UX distinctiveness: bespoke "Darkroom" design system, no component library

**Decision**: The spec's Darkroom design-direction section is adopted as binding design requirements, implemented as a **bespoke design system** in `src/ui/` — no off-the-shelf component library (no shadcn/Radix-styled kits, no Material) so nothing reads as templated. Tailwind v4 is used as the styling engine with a custom theme as the single design-token source: layered near-black surfaces (stage `#0A0908`-class, elevated warm panels), a single amber "safelight" accent for active state, soft off-white type, ledger-style tabular numerals for value readouts. Signature interactions are first-class engineering tasks, not decoration:
- whole-photo gesture editing (horizontal drag = value, vertical drag = parameter switch, large readout) — pointer-event state machine decoupled from the throttled GL recompute;
- bottom-sheet tool tray with drag handle and peek/half/full detents (spring physics, velocity-honoring, interruptible);
- press-and-hold "peek at the negative", draggable before/after divider, offset precision loupe (shared component for warp/retouch);
- two-tap filter intensity; "developing" export reveal (dim-safelight → full color);
- haptic reality per spec: one real tick via invisible native-switch overlay on discrete taps; simulated detents (motion + soft tick sound + label nudge) mid-drag; `prefers-reduced-motion` honored and a sound toggle in settings (FR-012).
Motion uses compositor-only properties (transform/opacity), springs derived from elapsed time (60/120 Hz identical), implemented with a tiny bespoke spring util or Motion One (MIT) — decided at implementation by bundle-size check. One-handed layout: all actionable controls in the bottom third, safe-area insets via `env()`, `100dvh` sizing, pull-to-refresh and text-selection suppressed.

**Rationale**: The user's "outstanding, not generic-AI-looking" demand is best met by owning the design language rather than restyling a kit; the spec already defines a coherent, unusual visual identity — the research decision is to treat it as spec, not inspiration.

**Alternatives considered**: Component library + heavy theming (faster but visibly generic in structure and interaction feel — exactly what was forbidden); fully custom CSS without Tailwind (slower iteration, no benefit since Tailwind emits only what's used).

## R16 — Segmentation quality/licensing tradeoff (spec's flagged decision)

**Decision**: Ship the **permissive baseline**: MediaPipe Image Segmenter with the selfie-segmentation/multiclass model (Apache-2.0) for both blur (FR-210) and removal/replacement (FR-211), with quality lifted by post-processing instead of a bigger model: confidence-mask feathering, guided-filter edge refinement against the source image (the FR-211 "edge refinement option"), and morphological cleanup. Copyleft high-quality matting (e.g., AGPL BiRefNet-class) is **deferred**: acceptable in principle for this non-commercial open project, but heavy (tens of MB, slow on-device) and not needed to meet the acceptance bar ("acceptably clean edge at moderate strengths"). Recorded as a possible post-Phase-4 enhancement behind the same `vision/segmenter` interface so it can slot in without rework.

**Rationale**: Meets every Phase 2 acceptance scenario at zero licensing risk and lowest memory pressure on the device whose memory ceiling is the project's scarcest resource; the interface seam preserves the upgrade path.

**Alternatives considered**: AGPL matting now (better hair edges; rejected for size/perf, not license); non-commercial-restricted weights (prohibited outright by spec).

## R17 — Testing approach

**Decision**: Vitest + React Testing Library for pure logic (edit-stack reducer/undo/redo, preset codec round-trip, warp displacement math, color conversions, i18n catalog key-parity); Playwright (desktop WebKit + mobile viewport emulation) for flows (import→edit→export, draft recovery via reload, locale switch mid-edit, offline via context route interception); a written **device test matrix** in `tests/device/` for what only the physical iPhone can prove (memory ceiling, real HEIC, share sheet, install, haptic tick, P3 screen) — executed as Phase 4's core work. GL shader correctness is spot-checked with small golden-image tile renders in Playwright-WebKit.

**Rationale**: The riskiest failures (memory, canvas limits, share quirks) are device-only, so the plan splits cheap continuous automation from an explicit manual matrix rather than pretending CI can certify iOS behavior.

**Alternatives considered**: Full E2E on a device farm (cost; violates zero-cost spirit for a single-device gift), unit tests only (misses the flow-level regressions Phase 1 stories define).

---

**All NEEDS CLARIFICATION: resolved.** No constitution conflicts surfaced by any decision (re-checked in plan.md gate table).
