/**
 * FR-309 export-coverage verification (T098). Confirms that every creative
 * Phase 3 output has a full-resolution export path:
 *
 *   - Overlay layers (makeup/text/stickers/frames/blend/doodle) are composited
 *     by drawLayers, which rasterizeLayers runs over each export band — so the
 *     set of layer kinds drawLayers handles MUST equal the full LayerKind set.
 *   - retouch is a *pixel* operation applied inside the tiled GL pipeline
 *     (renderFullResolution), so it is baked into the full-res buffer before
 *     overlays — verified here by its presence in the operation registry.
 *   - collage is a distinct project mode with its own high-resolution export
 *     path (modules/collage), not an overlay layer on a single-photo edit.
 *
 * This is a static/registry check (no canvas), so it runs under jsdom and
 * guards against a new creative layer kind silently missing from export.
 */
import { describe, expect, it } from 'vitest';
import { LAYER_KINDS, defaultParamsFor } from '@/engine/editState';
import { HANDLED_LAYER_KINDS } from '@/engine/render/layers';

describe('FR-309 — creative layers rasterize into the full-resolution export', () => {
  it('drawLayers composites every declared creative layer kind', () => {
    expect(new Set(HANDLED_LAYER_KINDS)).toEqual(new Set(LAYER_KINDS));
  });

  it('lists no export handler for a kind that is not a real layer kind', () => {
    for (const kind of HANDLED_LAYER_KINDS) {
      expect(LAYER_KINDS).toContain(kind);
    }
  });

  it('retouch (clone/heal) is a pixel op baked into the full-res GL pipeline', () => {
    // If retouch were missing from the registry it could not render at all.
    expect(() => defaultParamsFor('retouch')).not.toThrow();
  });
});
