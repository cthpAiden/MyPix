/**
 * Guard: the provision script's served asset paths must equal the paths the
 * runtime loader resolves (contracts/vision-assets.md). Filename/path drift
 * between `scripts/provision-vision-assets.mjs` and `src/vision/modelLoader.ts`
 * would silently reintroduce the 404 → "Couldn't analyze this photo" failure,
 * so this test fails CI if they diverge.
 *
 * The provision script runs copy/fetch at import time, so we read it as text
 * rather than importing it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODEL_URLS } from '@/vision/modelLoader';

const ROOT = join(__dirname, '..', '..');
const scriptSrc = readFileSync(join(ROOT, 'scripts', 'provision-vision-assets.mjs'), 'utf8');
const loaderSrc = readFileSync(join(ROOT, 'src', 'vision', 'modelLoader.ts'), 'utf8');

/** `/models/face_landmarker.task` → `face_landmarker.task` */
function basename(servedUrl: string): string {
  return servedUrl.slice(servedUrl.lastIndexOf('/') + 1);
}

describe('vision asset manifest parity', () => {
  it('provisions the WASM fileset into the loader-resolved base (/mediapipe/wasm)', () => {
    // Loader resolves the WASM base from this literal.
    expect(loaderSrc).toContain(`'/mediapipe/wasm'`);
    // Script copies into public/mediapipe/wasm, which is served at /mediapipe/wasm.
    expect(scriptSrc).toMatch(/'public',\s*'mediapipe',\s*'wasm'/);
  });

  it('provisions every model the loader loads, under /models/*.task', () => {
    // Script writes into public/models, served at /models.
    expect(scriptSrc).toMatch(/'public',\s*'models'/);

    for (const url of Object.values(MODEL_URLS)) {
      // Each loader model URL must be same-origin under /models/.
      expect(url.startsWith('/models/')).toBe(true);
      const file = basename(url);
      // The provision manifest must produce that exact served filename.
      expect(scriptSrc).toContain(`'${file}':`);
    }
  });

  it('provisions exactly the models the loader expects (no extras, no missing)', () => {
    const loaderFiles = Object.values(MODEL_URLS).map(basename).sort();
    const manifestFiles = [...scriptSrc.matchAll(/'([\w.]+\.task)':/g)]
      .map((m) => m[1])
      .sort();
    expect(manifestFiles).toEqual(loaderFiles);
  });
});
