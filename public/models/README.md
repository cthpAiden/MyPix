# On-device vision models (Phase 2)

MediaPipe Tasks Vision `.task` model files are self-hosted here so they can be
service-worker cached for offline use (contracts/vision.md). They are **not**
needed for Phase 1 (the standalone editor) and are intentionally not committed
(see `.gitignore`).

Place before shipping Phase 2:

- `face_landmarker.task` — Face Landmarker (478 pts)
- `pose_landmarker_full.task` — Pose Landmarker (33 pts)
- `selfie_segmenter.task` — Image Segmenter (selfie)

Source: https://developers.google.com/mediapipe/solutions (Apache-2.0).

## MediaPipe WASM fileset

The vision runtime also needs the MediaPipe WASM fileset self-hosted (so it is
same-origin for COEP + service-worker offline caching). Copy the contents of
`node_modules/@mediapipe/tasks-vision/wasm/` into `public/mediapipe/wasm/` — the
loader (`src/vision/modelLoader.ts`) resolves the fileset from `/mediapipe/wasm`.
Like the models, these are runtime-cached by the service worker on first use and
are intentionally not committed.
