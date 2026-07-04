# Contract: Vision Asset Provisioning & Verification

Restores all subject-aware tools (US1 / FR-001…FR-006) by guaranteeing the on-device MediaPipe assets exist in every build and dev run.

## Provision script

`scripts/provision-vision-assets.mjs` — Node ESM, no new dependencies (uses `node:fs/promises`, global `fetch`).

**Manifest (single source of truth, must match `src/vision/modelLoader.ts`):**

```
WASM_SRC_DIR = node_modules/@mediapipe/tasks-vision/wasm
WASM_DEST_DIR = public/mediapipe/wasm
MODELS = {
  "face_landmarker.task":       "<face model URL, R2>",
  "pose_landmarker_full.task":  "<pose model URL, R2>",
  "selfie_segmenter.task":      "<segmenter model URL, R2>",
}
MODELS_DEST_DIR = public/models
```

**Behavior:**
1. Copy every file in `WASM_SRC_DIR` → `WASM_DEST_DIR` (create dir; overwrite to stay in sync with the installed package). Error if `WASM_SRC_DIR` is missing (package not installed).
2. For each model: if `MODELS_DEST_DIR/<name>` is missing or zero-length, `fetch` the URL and write it; else skip.
3. **Verify**: assert each `WASM_DEST_DIR` key file and each `MODELS_DEST_DIR/<name>` exists and is non-empty. On any failure: print the offending path(s) and `process.exit(1)`.
4. On success: print a one-line summary (files present, models fetched vs. cached).

## npm wiring

```jsonc
"scripts": {
  "predev":   "node scripts/provision-vision-assets.mjs",
  "prebuild": "node scripts/provision-vision-assets.mjs",
  "dev":      "next dev",
  "build":    "next build"
}
```

- `npm run dev` (localhost:3000) and `npm run build` both provision + verify first.
- `output: 'export'` copies `public/` into `out/`, so verified assets ship.

## Loader contract (unchanged, must stay consistent)

- `src/vision/modelLoader.ts` resolves the WASM fileset from `/mediapipe/wasm` and loads models from `MODEL_URLS` (`/models/*.task`). The provision manifest MUST cover exactly these paths.
- Offline behavior unchanged: `assertModelAvailable` + SW runtime cache (`/models/`, `/mediapipe/`) → first load online, offline thereafter.

## Verification / acceptance

- **Guard test** (`vitest`): asserts the provision manifest's served paths equal the loader's expected paths (WASM base + the three model URLs), so path/filename drift fails CI.
- **Build gate**: deleting a model or the WASM dir causes `prebuild` to exit 1 with a clear message (manual/scripted check).
- **Functional**: with assets present, opening a face tool on a photo with a face reaches `ready` (not `vision.failed`) — see quickstart.
- **No-subject** still yields the module's "no subject" fallback, not `vision.failed` (unchanged behavior, re-verified).
