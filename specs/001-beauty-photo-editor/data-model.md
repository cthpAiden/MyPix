# Data Model: MyPix — Beauty & Photo Editing PWA

**Branch**: `001-beauty-photo-editor` | **Date**: 2026-07-04 | **Plan**: [plan.md](./plan.md)

All entities are client-side TypeScript types. Nothing here is a database schema in the server sense; persisted entities (Draft, Preset, Settings) live in IndexedDB as JSON (see [contracts/persistence.md](./contracts/persistence.md)). The **EditState is the single source of truth for rendering**; every pixel the user sees is a pure function `render(originalImage, editState)`.

## Entity relationship overview

```text
Project 1──1 OriginalImage          (immutable; never persisted to IndexedDB)
Project 1──1 EditState
EditState 1──* Operation             (ordered stack; adjustments/reshape/retouch…)
EditState 1──* Layer                 (overlay content; z-ordered)
Project 0──1 DetectedLandmarkSet     (cache; recomputable, never persisted)
Draft   ▶ serializes EditState + OriginalImage fingerprint (not pixels)
Preset  ▶ serializes a reusable subset of Operations
ExportJob ▶ consumes (OriginalImage, EditState) → file
Settings ▶ Locale, sound, persisted preferences
AssetLibrary ▶ stickers/filters/frames indices referenced by Operations/Layers
```

## Project (Photo Project / Document)

The in-memory working unit for one photo editing session.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (uuid) | Session-unique |
| `original` | `OriginalImage` | Immutable source |
| `editState` | `EditState` | Current editable state |
| `landmarks` | `DetectedLandmarkSet \| null` | Lazy cache, per-photo |
| `createdAt` / `modifiedAt` | `number` (epoch ms) | For draft resume card |

**Invariants**: `original` is never mutated after import (Constitution VI). A Project exists only in memory; its durable form is a Draft.

## OriginalImage

| Field | Type | Notes |
|---|---|---|
| `bitmap` | `ImageBitmap` | Decoded, EXIF-orientation-applied, working color space (P3 or sRGB fallback) |
| `width` / `height` | `number` | Full original pixel dimensions (post-orientation) |
| `colorSpace` | `'display-p3' \| 'srgb'` | Declared working space (research R14) |
| `mimeType` | `string` | Source type (`image/heic`, `image/jpeg`, …) |
| `fileName` | `string` | For export naming & re-link UX |
| `fingerprint` | `ImageFingerprint` | `{ byteSize, width, height, sampleHash }` for draft re-linking |

**Validation**: import rejects zero-dimension/corrupt decodes with a bilingual error (edge case "unsupported imports"). Extreme aspect ratios and tiny images import but clamp preview zoom sensibly.

## EditState (Edit Stack)

The sole render input besides the original. Versioned for forward migration.

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `number` | Migrations on draft load |
| `operations` | `Operation[]` | Ordered, re-editable (FR-115, FR-003) |
| `layers` | `Layer[]` | Z-ordered overlay content |
| `history` | `HistoryEntry[]` + `historyIndex` | Undo/redo ring (bounded, e.g. 100 entries); entries are inverse-patches, not snapshots of pixels |

**State transitions**: every user action dispatches a typed action to the edit-state reducer → new immutable EditState → history entry appended → render invalidated → debounced autosave. Undo/redo move `historyIndex` only. Reopening a prior step edits that Operation's `params` in place in the stack (non-destructive re-edit, story 1.7).

## Operation

One non-destructive edit in the stack. Discriminated union on `type`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable identity for re-editing |
| `type` | `OperationType` | See registry below |
| `params` | type-specific object | All numeric params normalized to documented ranges |
| `enabled` | `boolean` | Toggle without deleting (compare/experiment) |
| `mask` | `RegionMask \| null` | Optional target region (e.g., landmark-derived skin mask reference, liquify displacement-field id) |

**OperationType registry** (grows by phase; full schema in [contracts/edit-state.md](./contracts/edit-state.md)):

- Phase 1: `adjust` (12 global params, each −100…100 or documented unit), `curves` (per-channel control points), `colorMixer` (8 bands × H/S/L), `colorGrade` (shadows/mids/highs + split-tone), `whiteBalance` (temp/tint or picked neutral ref), `crop` (rect + angle + perspective quad + ratio preset), `filter` (filterId + intensity 0–1), `finishing` (vignette, grain, clarity, dehaze, fade, bloom)
- Phase 2: `faceReshape` (faceIndex + per-feature params, each −1…1), `skinSmooth` (strength 0–1, tone shift), `targetedEnhance` (teeth/eyes/underEye strengths), `autoBeautify` (expands to the above with default params — stored as its components so each remains individually adjustable, FR-207), `bodyReshape`, `liquify` (stroke list → displacement field id), `backgroundEffect` (blur strength / replace color / grayscale / transparent + edge-refine level)
- Phase 3: `retouch` (clone/heal stroke list with source offsets)

**Validation rules**: params clamp to range on dispatch; operations referencing landmarks are invalid (and UI-blocked) when `DetectedLandmarkSet` has no matching subject — never applied blindly (FR-203, edge cases).

## Layer

Overlay content composited above the pixel pipeline (Phase 3, plus Phase 3 makeup).

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `kind` | `'makeup' \| 'text' \| 'sticker' \| 'frame' \| 'blendImage' \| 'doodle'` | |
| `transform` | `{ x, y, scaleX, scaleY, rotation }` | In image-space coordinates (resolution-independent → crisp full-res export) |
| `opacity` | `number 0–1` | |
| `blendMode` | `BlendMode` | `normal`, `multiply`, `screen`, `overlay`, … (FR-306) |
| `anchor` | `LandmarkAnchor \| null` | For makeup: feature id + landmark indices so it tracks the face (FR-301) |
| `payload` | kind-specific | e.g. text: `{ content (NFC-normalized), fontId, size, color, align, outline, shadow }`; sticker: `{ assetId }`; doodle: `{ strokes }`; makeup: `{ makeupType, color, intensity, finish }` |

**Validation**: text content is NFC-normalized on input; fonts restricted to the verified-Vietnamese font list (FR-302). Collage is a distinct document mode (a `CollageProject` with cells referencing multiple source images) rather than a Layer — it composes Projects, not the reverse.

## Preset (Recipe)

| Field | Type | Notes |
|---|---|---|
| `id` / `name` | `string` | User-named (FR-111) |
| `schemaVersion` | `number` | Shared with EditState versioning |
| `operations` | `Operation[]` | Only portable types (adjust/curves/mixer/grade/filter/finishing) — no photo-specific ops (crop, reshape, retouch) |
| `sortOrder` | `number` | User reorder |
| `createdAt` | `number` | |

**Share code**: `MYPIX1.` + base64url(deflate(JSON)) — round-trip validated on import with schema check + version migration; invalid codes produce a clear bilingual error (FR-112).

## Draft

Persisted session recovery record (IndexedDB `drafts` store). **Never contains pixels.**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | One active draft per fingerprint |
| `editState` | serialized `EditState` | History optionally truncated to bound size |
| `fingerprint` | `ImageFingerprint` | Re-link key (story 1.8) |
| `fileName` / `thumbDataUrl` | `string` | Resume card display; thumb ≤ ~50 KB is the one tiny allowed raster |
| `savedAt` | `number` | |

**Transitions**: autosave (debounced ~1 s, flush on `visibilitychange`) → on next launch, resume card offers the draft → user re-picks the photo → fingerprint match re-links; mismatch or missing → clear bilingual explanation, draft kept until dismissed (edge case "original no longer available").

## DetectedLandmarkSet

Ephemeral per-photo detection cache (recomputable — never persisted).

| Field | Type | Notes |
|---|---|---|
| `faces` | `FaceLandmarks[]` | 478 points each, image-space; `selectedFaceIndex` for multi-face (FR-203) |
| `pose` | `PoseLandmarks \| null` | 33 points + confidence |
| `segmentationMask` | `MaskRef \| null` | Confidence mask texture handle |
| `computedFor` | `{ fingerprint, cropStateHash }` | Invalidated when geometry-changing ops (crop/rotate/perspective) change |

## Settings & Locale

IndexedDB `settings` store (locale mirrored to localStorage/cookie for pre-hydration reads).

| Field | Type | Notes |
|---|---|---|
| `locale` | `'en' \| 'vi'` | Persisted (FR-004) |
| `soundEnabled` | `boolean` | FR-012 |
| `exportDefaults` | `{ format, jpegQuality }` | Remembered convenience |
| `unlocks` | `string[]` | Gift easter-egg flags (hidden note seen, secret filter) |

## ExportJob

Transient description of one export run (engine/export input).

| Field | Type | Notes |
|---|---|---|
| `format` | `'png' \| 'jpeg'` | FR-117 |
| `jpegQuality` | `number` (default ~0.92) | Ignored for PNG |
| `region` | full image or aspect-preset crop | FR-113 social presets |
| `transparentBackground` | `boolean` | PNG-only, requires background-removal op (FR-211) |
| `delivery` | `'share' \| 'download'` | Share-sheet with download fallback (FR-118) |
| Progress | `onProgress(tilesDone/tilesTotal)` | Drives the "developing" reveal UI |

**Invariant**: output pixel dimensions === original dimensions (or exact preset crop thereof); no downscaling ever (FR-116, SC-001).

## AssetLibrary

Static, growable content shipped in `public/` and indexed by JSON — adding assets is a content drop, not a code change (FR-303).

- `stickers/index.json`: `{ id, category, file, addedAt }[]`
- `filters/index.json`: `{ id, category, nameKey (i18n key), lutFile or params }[]`
- `frames/index.json`: `{ id, style, params }[]`

Service worker runtime-caches assets on first use for offline availability.
