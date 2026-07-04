# Device Matrix — Performance (T093, US4.3)

**Target**: iPhone 17 Pro, Safari, **installed** PWA. Run in a fresh launch (no other heavy tabs).
**Covers**: SC-009 (interactive scrub preview), SC-010 (auto-beautify ≤ ~3 s), SC-011 (full-res export completes, no blank/crash/reload), SC-012 (no memory-driven crash across a session).

This matrix defines **concrete, independently-measurable pass thresholds** so SC-009 and SC-011 are objective, and records the numbers observed on device. Hardening levers already in place (verify each is honoured): working-resolution preview cap `DEFAULT_MAX_EDGE = 2048` ([orchestrator](../../src/engine/render/orchestrator.ts)), export read-back band `READ_BAND = 256` ([tiler](../../src/engine/export/tiler.ts)), vision-provider disposal on project close ([engine.closeProject](../../src/engine/index.ts)), and throwaway export-context disposal ([GLContext.dispose](../../src/engine/gl/context.ts), T094).

## Test assets

- **P48**: ~48 MP JPEG (e.g. 8064×6048), wide-gamut where possible.
- **P12**: ~12 MP portrait (typical selfie) with one clear face.
- **PBODY**: full-body shot for pose.
- **PGROUP**: multi-face group shot.

## How to measure

- **Scrub fps (SC-009)**: wrap the preview render loop with a `requestAnimationFrame` delta logger (temporary dev instrumentation), scrub one adjustment continuously for ~5 s, and read the frame-interval distribution. Alternatively use Safari Web Inspector → Timelines → Rendering frames while dragging.
- **Export time (SC-011)**: `const t0 = performance.now()` immediately before `engine.export(job)`, log `performance.now() - t0` on resolve. The [`ExportJob.onProgress`](../../src/engine/types.ts) callback also fires per read band — confirm it advances monotonically to 100% with no stall.
- **Auto-beautify (SC-010)**: time from tapping Auto-beautify (cold — model not yet loaded) to the balanced result being visible.
- **Memory (SC-012)**: watch for a Safari tab reload / white flash. Optionally sample `performance.memory` (if exposed) or use Web Inspector → Timelines → JS Allocations across the cycle.

## SC-009 — Interactive scrub preview

Scrub each control on **P48** (worst case — largest working preview) at the 2048px working resolution.

**Pass thresholds** (per control, sustained over a 5 s drag):

| Metric | Target (ProMotion) | Minimum pass |
|--------|--------------------|--------------|
| Median frame interval | ≤ 16.7 ms (60 fps) | ≤ 33 ms (30 fps) |
| p95 frame interval | ≤ 33 ms | ≤ 50 ms (no visible stutter) |
| Dropped frames over 5 s | 0 | ≤ occasional, never a freeze |

| Control group | Median ms | p95 ms | ≥30 fps? | Notes |
|---------------|-----------|--------|----------|-------|
| Light/color (12 params) | | | ⬜ | |
| Curves | | | ⬜ | |
| Color mixer / grade | | | ⬜ | |
| Filter intensity | | | ⬜ | |
| Finishing (grain/vignette/clarity) | | | ⬜ | |
| Face reshape (mesh warp) | | | ⬜ | detection warm |
| Skin smooth strength | | | ⬜ | |
| Liquify stroke | | | ⬜ | |
| Background blur strength | | | ⬜ | |

## SC-011 — Full-resolution export

Export **P48** at full resolution. No canvas blank, no app reload, output dimensions **exactly** equal the source.

**Pass thresholds:**

| Format | Target | Hard pass |
|--------|--------|-----------|
| JPEG (q≈0.92) | ≤ 8 s | ≤ 15 s, completes |
| PNG (lossless) | ≤ 15 s | ≤ 30 s, completes |
| Transparent PNG (cutout) | ≤ 18 s | ≤ 35 s, completes |

| Scenario | Time (s) | Dims match? | Blank/crash? | Result |
|----------|----------|-------------|--------------|--------|
| P48 → JPEG, no edits | | ⬜ | ⬜ none | ⬜ |
| P48 → PNG, no edits | | ⬜ | ⬜ none | ⬜ |
| P48 → JPEG, full stack (adjust+face+makeup+text) | | ⬜ | ⬜ none | ⬜ |
| P48 → transparent PNG (bg removed) | | ⬜ | ⬜ none | ⬜ |
| P48 → JPEG with an aspect preset (4:5) | | ⬜ | ⬜ none | ⬜ |

## SC-010 — Auto-beautify latency

| Scenario | Time (s) | ≤ ~3 s? |
|----------|----------|---------|
| P12, cold (face model loads) | | ⬜ |
| P12, warm (model cached) | | ⬜ |

## SC-012 — Memory ceiling across a session

Run the loop below **10×** in one session without relaunching. A single Safari reload / white flash = **FAIL**.

1. Import P48 → apply an adjustment → export JPEG.
2. Import P12 → auto-beautify → makeup → text overlay → export PNG.
3. Import PBODY → body reshape → export JPEG.
4. Import PGROUP → face pick → skin smooth → segmentation background blur → export JPEG.
5. Close project (returns home).

| Cycle | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-------|---|---|---|---|---|---|---|---|---|----|
| Completed w/o reload | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

Confirm each `closeProject()` frees the face/pose/segmentation providers (memory should not grow monotonically across cycles) and that repeated exports do not accumulate live WebGL contexts (T094). Also swap the blend (double-exposure) image ~20× and confirm live `blob:` URLs do not accumulate (the `AssetStore` retains them for undo, then revokes on project open/close); undo/redo across the swaps must still show the correct image.

## Findings → hardening (T094)

Record any threshold miss and the applied fix. Levers, in order of preference:

1. Lower the working-resolution cap (`DEFAULT_MAX_EDGE`) below 2048 if scrub fps misses SC-009 on P48.
2. Reduce `READ_BAND` (smaller peak read-back buffer) if export causes a memory spike; raise it if export is I/O-bound and under the ceiling.
3. Ensure provider disposal + GL-context disposal actually run on close/export (T094 — verified in code; confirm no growth here).
4. Reuse GL programs/targets across passes (already cached) — confirm no per-frame allocation in the scrub path.

**Recorded result (fill on device):** _date / iOS version / device thermal state / overall PASS·FAIL_
