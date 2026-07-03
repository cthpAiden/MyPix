# Contract: Vision Providers (Landmarks & Segmentation)

**Scope**: `src/vision/` — the only code allowed to import `@mediapipe/tasks-vision`. Face, body, makeup, and background modules consume these interfaces; swapping models later (e.g., higher-quality matting, research R16) must not touch consumers.

## Provider interfaces

```ts
interface FaceLandmarkProvider {
  detect(image: ImageBitmap): Promise<FaceLandmarks[]>;  // [] when no face — never throws for "not found"
  dispose(): void;
}
interface FaceLandmarks {
  points: Point2D[];                 // 478, image-space pixels (not normalized)
  regions: {                         // derived polygon index sets, precomputed once
    faceOval: number[]; lips: number[]; leftEye: number[]; rightEye: number[];
    leftBrow: number[]; rightBrow: number[]; teethInner: number[];
    underEyeLeft: number[]; underEyeRight: number[]; nose: number[];
  };
  meshTriangles: Uint16Array;        // canonical tessellation topology (for warp mesh, R5)
}

interface PoseLandmarkProvider {
  detect(image: ImageBitmap): Promise<PoseLandmarks | null>;  // null when confidence below threshold
}
interface PoseLandmarks { points: (Point2D & { visibility: number })[]; }  // 33

interface SegmentationProvider {
  segment(image: ImageBitmap): Promise<SegmentationResult>;
}
interface SegmentationResult {
  confidenceMask: Float32Array | WebGLTexture;   // person-vs-background, working resolution
  width: number; height: number;
  refineEdges(strength: number): Promise<SegmentationResult>;  // guided-filter post-process (FR-211)
}
```

## Lifecycle & performance rules

- **Lazy**: providers and their `.task` model files load on first use of a tool that declares them in `requiredVision` (engine contract) — never at app start. Loading state is surfaced bilingual.
- **Singleton per task**: one live instance each; consumers get it via `getFaceProvider()` etc. Providers are disposed when the project closes (memory ceiling).
- **Delegate selection**: CPU/WASM delegate by default on iOS Safari; GPU delegate only behind an allowlist check (research R3). Multithreaded WASM when `crossOriginIsolated === true`, single-thread fallback otherwise (R13).
- **Coordinate space**: everything returned in *image-space pixels of the original* (providers internally detect on a downscaled copy and rescale) so consumers never care about detection resolution.
- **Caching/invalidation**: results cache on the Project keyed by `{fingerprint, cropStateHash}`; geometry-changing operations (crop/rotate/perspective) invalidate; adjustments/filters do not.
- **Offline**: model files are same-origin (`public/models/`) and runtime-cached by the service worker on first use; a never-fetched model in offline state produces a clear bilingual "needs one online load" message.
- **Privacy**: providers never transmit anything; inputs and outputs stay in-process (Constitution II, FR-010).
