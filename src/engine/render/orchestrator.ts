/**
 * Render orchestrator (T018): runs the working-resolution GL preview pipeline
 * and composites onto the single on-screen canvas, honoring compare mode. The
 * same pass list + geometry drives the tiled full-res export (SC-003), so what
 * you see is what you get.
 *
 * The visible surface is a 2D canvas; the GL pipeline renders into a detached
 * backing canvas which is drawn (whole, or split for compare) onto it. Phase 3
 * layers composite via the overlay renderer hook.
 */
import { GLContext, PingPong } from '@/engine/gl/context';
import { PASSTHROUGH } from '@/engine/gl/pass';
import { buildPipeline, runPixelPasses } from './pipeline';
import { buildGeometryPass, croppedOutputSize, mapSourceToOutput } from './geometry';
import { drawLayers } from './layers';
import { onAssetLoad } from './layerAssets';
import { defaultCrop } from '@/engine/editState';
import type { CropParams, EditState } from '@/engine/editState';
import type { CompareMode, OriginalImage } from '@/engine/types';
import type { RenderContext } from './renderContext';
import type { DetectedLandmarkSet } from '@/vision/types';

const DEFAULT_MAX_EDGE = 2048;

export type OverlayRenderer = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

export class RenderOrchestrator {
  private readonly gl: GLContext;
  private readonly backing: HTMLCanvasElement;
  private readonly view: HTMLCanvasElement;
  private readonly view2d: CanvasRenderingContext2D;
  private readonly edited: HTMLCanvasElement;
  private readonly edited2d: CanvasRenderingContext2D;
  private readonly baseline: HTMLCanvasElement;
  private readonly baseline2d: CanvasRenderingContext2D;

  private ping: PingPong | null = null;
  private srcTex: WebGLTexture | null = null;
  private original: OriginalImage | null = null;
  private workW = 1;
  private workH = 1;
  private workScale = 1;

  private compare: CompareMode = 'off';
  private overlay: OverlayRenderer | null = null;
  private lastState: EditState | null = null;
  private landmarks: DetectedLandmarkSet | null = null;
  private readonly unsubAssets: () => void;

  constructor(private readonly maxEdge = DEFAULT_MAX_EDGE) {
    this.backing = document.createElement('canvas');
    this.gl = new GLContext(this.backing);
    this.view = document.createElement('canvas');
    this.view2d = this.view.getContext('2d')!;
    this.edited = document.createElement('canvas');
    this.edited2d = this.edited.getContext('2d')!;
    this.baseline = document.createElement('canvas');
    this.baseline2d = this.baseline.getContext('2d')!;

    // On context loss, re-render from EditState once restored (R4).
    this.gl.onRestored(() => {
      if (this.original) {
        this.srcTex = this.gl.uploadImage(this.original.bitmap);
        if (this.lastState) this.render(this.lastState);
      }
    });

    // Re-composite once a deferred overlay asset (sticker/blend image) decodes.
    this.unsubAssets = onAssetLoad(() => {
      if (this.lastState) this.render(this.lastState);
    });
  }

  getViewCanvas(): HTMLCanvasElement {
    return this.view;
  }

  setOverlayRenderer(fn: OverlayRenderer | null): void {
    this.overlay = fn;
  }

  setCompareMode(mode: CompareMode): void {
    this.compare = mode;
    if (this.lastState) this.render(this.lastState);
  }

  /** Supply the current detection set for Phase 2 passes; re-renders. */
  setLandmarks(landmarks: DetectedLandmarkSet | null): void {
    this.landmarks = landmarks;
    if (this.lastState) this.render(this.lastState);
  }

  setProject(original: OriginalImage): void {
    this.original = original;
    this.workScale = Math.min(1, this.maxEdge / Math.max(original.width, original.height));
    this.workW = Math.max(1, Math.round(original.width * this.workScale));
    this.workH = Math.max(1, Math.round(original.height * this.workScale));
    if (this.srcTex) this.gl.deleteTexture(this.srcTex);
    this.srcTex = this.gl.uploadImage(original.bitmap);
    if (this.ping) this.ping.resize(this.workW, this.workH);
    else this.ping = new PingPong(this.gl, this.workW, this.workH);
  }

  clearProject(): void {
    this.original = null;
    this.lastState = null;
    this.landmarks = null;
    if (this.srcTex) {
      this.gl.deleteTexture(this.srcTex);
      this.srcTex = null;
    }
    this.view2d.clearRect(0, 0, this.view.width, this.view.height);
  }

  private cropOf(state: EditState): CropParams {
    const op = state.operations.find((o) => o.type === 'crop' && o.enabled);
    return (op?.params as CropParams) ?? defaultCrop();
  }

  /** Run the pixel passes over srcTex, returning the texture holding the result. */
  private runPixelPasses(state: EditState): WebGLTexture {
    if (!this.srcTex || !this.ping || !this.original) throw new Error('no project');
    const ctx: RenderContext = {
      landmarks: this.landmarks,
      imageWidth: this.original.width,
      imageHeight: this.original.height,
    };
    const passes = buildPipeline(state, ctx);
    const texel: [number, number] = [1 / this.workW, 1 / this.workH];
    return runPixelPasses(this.gl, this.srcTex, passes, this.ping, texel);
  }

  /** Apply geometry to `tex` and copy the result into `dest2d`. */
  private renderGeometry(
    tex: WebGLTexture,
    crop: CropParams,
    outW: number,
    outH: number,
    dest: HTMLCanvasElement,
    dest2d: CanvasRenderingContext2D,
  ): void {
    if (!this.original) return;
    this.gl.resizeCanvas(outW, outH);
    const geom = buildGeometryPass(crop, this.original.width / this.original.height);
    this.gl.draw(
      geom.fragment,
      {
        u_src: { t: 'tex', v: tex, unit: 0 },
        u_texel: { t: '2f', v: [1 / this.workW, 1 / this.workH] },
        ...geom.uniforms({ fbo: null as never, tex, width: outW, height: outH }),
      },
      null,
      { width: outW, height: outH },
    );
    if (dest.width !== outW) dest.width = outW;
    if (dest.height !== outH) dest.height = outH;
    dest2d.clearRect(0, 0, outW, outH);
    // The GL framebuffer holds the edit with image-top at v_uv.y=0, which a WebGL
    // canvas presents at its visual bottom; flip vertically on blit so the photo
    // reads upright. Overlay layers and the eyedropper read this upright buffer,
    // so they stay aligned to the image without any coordinate flip of their own.
    dest2d.save();
    dest2d.setTransform(1, 0, 0, -1, 0, outH);
    dest2d.drawImage(this.backing, 0, 0);
    dest2d.restore();
  }

  render(state: EditState): void {
    this.lastState = state;
    if (!this.original || !this.srcTex || this.gl.isLost) return;

    const crop = this.cropOf(state);
    const full = croppedOutputSize(this.original.width, this.original.height, crop);
    const outW = Math.max(1, Math.round(full.width * this.workScale));
    const outH = Math.max(1, Math.round(full.height * this.workScale));

    const editedTex = this.runPixelPasses(state);
    this.renderGeometry(editedTex, crop, outW, outH, this.edited, this.edited2d);

    // Size the visible surface and compose.
    if (this.view.width !== outW) this.view.width = outW;
    if (this.view.height !== outH) this.view.height = outH;
    this.view2d.clearRect(0, 0, outW, outH);

    if (this.compare === 'off') {
      this.view2d.drawImage(this.edited, 0, 0);
    } else {
      // Baseline = geometry over the untouched source.
      this.renderGeometry(this.srcTex, crop, outW, outH, this.baseline, this.baseline2d);
      if (this.compare === 'hold-original') {
        this.view2d.drawImage(this.baseline, 0, 0);
      } else {
        const x = Math.round(outW * this.compare.divider);
        this.view2d.drawImage(this.baseline, 0, 0);
        this.view2d.drawImage(this.edited, x, 0, outW - x, outH, x, 0, outW - x, outH);
        // Divider line.
        this.view2d.save();
        this.view2d.strokeStyle = 'rgba(242,163,94,0.9)';
        this.view2d.lineWidth = 2;
        this.view2d.beginPath();
        this.view2d.moveTo(x, 0);
        this.view2d.lineTo(x, outH);
        this.view2d.stroke();
        this.view2d.restore();
      }
    }

    // Phase 3 overlay layers, composited in output space. Skipped while holding
    // the pure original (compare) since that view is pre-edit by definition.
    if (this.compare !== 'hold-original' && state.layers.length > 0) {
      drawLayers(this.view2d, state.layers, {
        outW,
        outH,
        landmarks: this.landmarks,
        imageWidth: this.original.width,
        imageHeight: this.original.height,
        mapSrc: (pt) => mapSourceToOutput(pt, crop),
      });
    }

    if (this.overlay) this.overlay(this.view2d, outW, outH);
  }

  /** Read the displayed (edited) pixel at normalized coords — for the eyedropper. */
  sampleDisplayPixel(nx: number, ny: number): [number, number, number] | null {
    if (this.edited.width === 0) return null;
    const x = Math.round(nx * (this.edited.width - 1));
    const y = Math.round(ny * (this.edited.height - 1));
    const d = this.edited2d.getImageData(x, y, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  }

  /** Blit a passthrough of the current source — used as a cheap first paint. */
  paintSource(): void {
    if (!this.srcTex || !this.original) return;
    this.gl.resizeCanvas(this.workW, this.workH);
    this.gl.draw(
      PASSTHROUGH,
      { u_src: { t: 'tex', v: this.srcTex, unit: 0 }, u_texel: { t: '2f', v: [1, 1] } },
      null,
      { width: this.workW, height: this.workH },
    );
  }

  dispose(): void {
    this.unsubAssets();
    this.ping?.dispose();
    if (this.srcTex) this.gl.deleteTexture(this.srcTex);
    this.srcTex = null;
    this.original = null;
  }
}
