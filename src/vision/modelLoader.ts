/**
 * MediaPipe model + WASM loading with offline handling (T066, research R3/R13).
 *
 * Models (`.task`) and the MediaPipe WASM fileset are self-hosted same-origin so
 * the service worker can runtime-cache them for offline use. On the first use of
 * a vision tool the provider loads its model here; if the device is offline and
 * the model was never cached, we raise ModelUnavailableOfflineError so the UI can
 * show the bilingual "needs one online load" message rather than hanging.
 *
 * Delegate: CPU/WASM by default on iOS Safari (the GPU delegate is unstable in
 * iOS Safari WebGL-backed inference). Multithreaded WASM is selected by the
 * fileset resolver when `crossOriginIsolated` (SharedArrayBuffer) is available.
 */
import type { FilesetResolver } from '@mediapipe/tasks-vision';
import { ModelUnavailableOfflineError } from './types';

/** The WASM fileset object `FilesetResolver.forVisionTasks` resolves to. */
type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

/** Same-origin base for the MediaPipe WASM fileset (self-hosted for offline). */
const WASM_BASE = '/mediapipe/wasm';

export const MODEL_URLS = {
  face: '/models/face_landmarker.task',
  pose: '/models/pose_landmarker_full.task',
  segmentation: '/models/selfie_segmenter.task',
} as const;

/** CPU delegate by default (research R3); GPU only behind a future allowlist. */
export const VISION_DELEGATE: 'CPU' | 'GPU' = 'CPU';

let filesetPromise: Promise<WasmFileset> | null = null;

/**
 * MediaPipe's TFLite WASM runtime prints benign init lines (e.g. "INFO: Created
 * TensorFlow Lite XNNPACK delegate for CPU.") through Emscripten's `printErr`,
 * which lands on `console.error` — so Next.js's dev overlay surfaces them as
 * error cards even though nothing failed. Drop only those exact TFLite init
 * lines; every other console.error passes through untouched. Idempotent.
 */
let logFilterInstalled = false;
function installVisionLogFilter(): void {
  if (logFilterInstalled || typeof console === 'undefined') return;
  logFilterInstalled = true;
  const benign = (args: unknown[]) =>
    typeof args[0] === 'string' &&
    (args[0].startsWith('INFO: Created TensorFlow Lite') || args[0].includes('XNNPACK delegate'));
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (benign(args)) return;
    original(...args);
  };
}

/** The shared MediaPipe vision fileset (WASM), loaded once. */
export async function getVisionFileset(): Promise<WasmFileset> {
  if (!filesetPromise) {
    filesetPromise = (async () => {
      installVisionLogFilter();
      const { FilesetResolver } = await import('@mediapipe/tasks-vision');
      return FilesetResolver.forVisionTasks(WASM_BASE);
    })();
  }
  return filesetPromise;
}

/**
 * Guard model loading when offline: if the network is down and the model isn't
 * already in the SW cache, fail fast with a typed, user-explainable error.
 */
export async function assertModelAvailable(url: string): Promise<void> {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (online) return;
  if (typeof caches === 'undefined') throw new ModelUnavailableOfflineError(url);
  const hit = await caches.match(url);
  if (!hit) throw new ModelUnavailableOfflineError(url);
}
