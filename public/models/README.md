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
