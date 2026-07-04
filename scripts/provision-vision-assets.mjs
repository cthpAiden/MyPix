/**
 * Provision on-device MediaPipe vision assets (US1 / FR-001…FR-006).
 *
 * Guarantees the assets `src/vision/modelLoader.ts` resolves at runtime exist in
 * every dev run and build:
 *   - the MediaPipe WASM fileset (copied from the installed package)
 *   - the three `.task` models (fetched once, then cached on disk)
 *
 * Run automatically via the `predev` / `prebuild` npm lifecycle scripts. On any
 * missing/empty asset it prints the offending path(s) and exits non-zero so the
 * failure is loud at build time instead of a silent runtime 404 (FR-006).
 *
 * Node ESM, no new dependencies (node:fs/promises, node:path, global fetch).
 */
import { readdir, mkdir, copyFile, writeFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- Manifest: single source of truth, MUST match src/vision/modelLoader.ts ---
const WASM_SRC_DIR = join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const WASM_DEST_DIR = join(ROOT, 'public', 'mediapipe', 'wasm');

const MODELS_DEST_DIR = join(ROOT, 'public', 'models');
const MODELS = {
  'face_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  'pose_landmarker_full.task':
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  // Served as .tflite; MediaPipe reads the model bytes regardless of extension,
  // so we store them under the .task filename the loader resolves.
  'selfie_segmenter.task':
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
};

async function fileSize(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return -1; // missing
  }
}

async function copyWasmFileset() {
  let entries;
  try {
    entries = await readdir(WASM_SRC_DIR);
  } catch {
    console.error(
      `[provision-vision-assets] WASM source dir missing: ${WASM_SRC_DIR}\n` +
        `  Install dependencies first (npm install @mediapipe/tasks-vision).`,
    );
    process.exit(1);
  }
  await mkdir(WASM_DEST_DIR, { recursive: true });
  for (const name of entries) {
    // Overwrite every run to stay in sync with the installed package version.
    await copyFile(join(WASM_SRC_DIR, name), join(WASM_DEST_DIR, name));
  }
  return entries;
}

async function fetchModels() {
  await mkdir(MODELS_DEST_DIR, { recursive: true });
  let fetched = 0;
  let cached = 0;
  for (const [name, url] of Object.entries(MODELS)) {
    const dest = join(MODELS_DEST_DIR, name);
    if ((await fileSize(dest)) > 0) {
      cached++;
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) {
      console.error(
        `[provision-vision-assets] Failed to fetch ${name}: HTTP ${res.status} ${res.statusText}\n  ${url}`,
      );
      process.exit(1);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, bytes);
    fetched++;
  }
  return { fetched, cached };
}

async function verify(wasmFiles) {
  const missing = [];
  for (const name of wasmFiles) {
    if ((await fileSize(join(WASM_DEST_DIR, name))) <= 0) {
      missing.push(join(WASM_DEST_DIR, name));
    }
  }
  for (const name of Object.keys(MODELS)) {
    if ((await fileSize(join(MODELS_DEST_DIR, name))) <= 0) {
      missing.push(join(MODELS_DEST_DIR, name));
    }
  }
  if (missing.length) {
    console.error(
      `[provision-vision-assets] Verification failed — missing or empty assets:\n` +
        missing.map((p) => `  - ${p}`).join('\n'),
    );
    process.exit(1);
  }
}

const wasmFiles = await copyWasmFileset();
const { fetched, cached } = await fetchModels();
await verify(wasmFiles);
console.log(
  `[provision-vision-assets] OK — ${wasmFiles.length} WASM files, ${fetched} model(s) fetched, ${cached} cached.`,
);
