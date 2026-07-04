/**
 * The Engine surface (contracts/engine.md, T017).
 *
 * The only object tool modules and the UI depend on. Owns the edit-state store
 * (reducer + bounded history), the render orchestrator, project lifecycle,
 * compare mode, and export. Modules affect the image solely through
 * `engine.dispatch()`.
 */
import {
  HistoryRing,
  cropStateHash,
  emptyEditState,
  reduce,
  type BlendPayload,
  type EditAction,
  type EditState,
  type OperationType,
} from './editState';
import { RenderOrchestrator, type OverlayRenderer } from './render/orchestrator';
import { blendAssets } from './render/assetStore';
import { newId } from '@/shared/id';
import { LandmarkCache } from '@/vision/cache';
import {
  disposeFaceProvider,
  disposePoseProvider,
  disposeSegmentationProvider,
} from '@/vision';
import type { DetectedLandmarkSet, VisionKind } from '@/vision/types';
import type { CompareMode, ExportJob, ExportResult, OriginalImage, Project } from './types';

export type Unsubscribe = () => void;
type Listener = (state: EditState) => void;

function labelFor(action: EditAction): string {
  switch (action.kind) {
    case 'op/add':
      return `add ${action.op.type}`;
    case 'op/update':
      return 'adjust';
    case 'op/toggle':
      return 'toggle';
    case 'op/remove':
      return 'remove';
    case 'preset/apply':
      return 'apply preset';
    case 'state/replace':
      return action.label ?? 'restore';
    case 'layer/add':
      return `add ${action.layer.kind}`;
    case 'layer/update':
      return 'edit layer';
    case 'layer/remove':
      return 'remove layer';
    case 'layer/reorder':
      return 'reorder';
    default:
      return 'edit';
  }
}

/** Blend layers' picked-image asset ids referenced by a state. */
function blendAssetIds(state: EditState): string[] {
  return state.layers
    .filter((l) => l.kind === 'blendImage')
    .map((l) => (l.payload as unknown as BlendPayload).assetId)
    .filter(Boolean);
}

export class Engine {
  private project: Project | null = null;
  private state: EditState = emptyEditState();
  private history = new HistoryRing(this.state);
  private readonly orchestrator = new RenderOrchestrator();
  private readonly listeners = new Set<Listener>();
  private readonly landmarkCache = new LandmarkCache();
  private rafId: number | null = null;

  /* -------------------------------- state -------------------------------- */

  getState(): EditState {
    return this.state;
  }

  getProject(): Project | null {
    return this.project;
  }

  subscribe(fn: Listener): Unsubscribe {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }
  canRedo(): boolean {
    return this.history.canRedo();
  }

  dispatch(action: EditAction): void {
    if (action.kind === 'history/undo') {
      const s = this.history.undo();
      if (s) this.setStateInternal(s);
      return;
    }
    if (action.kind === 'history/redo') {
      const s = this.history.redo();
      if (s) this.setStateInternal(s);
      return;
    }

    const next = reduce(this.state, action);
    if (next === this.state) return; // no-op

    const coalesceKey =
      'coalesceKey' in action ? (action.coalesceKey as string | undefined) : undefined;
    this.state = next;
    this.history.record(next, labelFor(action), coalesceKey);
    this.invalidate();
    this.emit();
  }

  /** End the current scrub gesture so the next edit starts a fresh undo step. */
  endGesture(): void {
    this.history.breakCoalesce();
  }

  private setStateInternal(state: EditState): void {
    this.state = state;
    this.invalidate();
    this.emit();
  }

  /** Convenience: does an enabled op of this type exist? (modules use this) */
  hasOp(type: OperationType): boolean {
    return this.state.operations.some((o) => o.type === type);
  }
  findOp(type: OperationType): EditState['operations'][number] | undefined {
    return this.state.operations.find((o) => o.type === type);
  }

  /* ------------------------------ rendering ------------------------------ */

  invalidate(): void {
    if (this.rafId != null) return;
    const raf =
      typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16) as unknown as number;
    this.rafId = raf(() => {
      this.rafId = null;
      this.renderPreview();
    });
  }

  renderPreview(): void {
    if (this.project) this.orchestrator.render(this.state);
  }

  getPreviewCanvas(): HTMLCanvasElement {
    return this.orchestrator.getViewCanvas();
  }

  setCompareMode(mode: CompareMode): void {
    this.orchestrator.setCompareMode(mode);
  }

  setOverlayRenderer(fn: OverlayRenderer | null): void {
    this.orchestrator.setOverlayRenderer(fn);
  }

  sampleDisplayPixel(nx: number, ny: number): [number, number, number] | null {
    return this.orchestrator.sampleDisplayPixel(nx, ny);
  }

  /* ------------------------------ detection ------------------------------ */

  /** Current detection set if it matches the current photo/geometry, else null. */
  getLandmarks(): DetectedLandmarkSet | null {
    if (!this.project) return null;
    return this.landmarkCache.get(this.project.original.fingerprint, cropStateHash(this.state));
  }

  /**
   * Lazily run the requested detectors for the open project (contracts/vision.md).
   * Feeds the result to the render pipeline and notifies subscribers. Errors
   * (e.g. offline with an uncached model) propagate to the caller for a
   * bilingual message.
   */
  async ensureDetection(kinds: VisionKind[]): Promise<DetectedLandmarkSet | null> {
    if (!this.project) return null;
    const { bitmap, fingerprint } = this.project.original;
    const set = await this.landmarkCache.ensure(
      bitmap,
      fingerprint,
      cropStateHash(this.state),
      kinds,
    );
    this.orchestrator.setLandmarks(set);
    this.emit();
    return set;
  }

  /** Pick which detected face the landmark tools target (multi-face, FR-203). */
  selectFace(index: number): void {
    this.landmarkCache.selectFace(index);
    this.orchestrator.setLandmarks(this.getLandmarks());
    this.invalidate();
    this.emit();
  }

  /* --------------------------- project lifecycle ------------------------- */

  private openProject(original: OriginalImage, state: EditState): Project {
    // History is about to reset, so every blend picked-image asset the incoming
    // state does not reference becomes unreachable — free those, keep the rest
    // (a same-session draft resume re-adopts a state still referencing its own).
    blendAssets.retain(blendAssetIds(state));
    const now = Date.now();
    const project: Project = { id: newId('proj'), original, createdAt: now, modifiedAt: now };
    this.project = project;
    this.state = state;
    this.history.reset(state);
    this.landmarkCache.clear();
    this.orchestrator.setLandmarks(null);
    this.orchestrator.setProject(original);
    this.renderPreview();
    this.emit();
    return project;
  }

  async importPhoto(source: File | Blob): Promise<Project> {
    const { decodePhoto } = await import('./import/decode');
    const original = await decodePhoto(source);
    return this.openProject(original, emptyEditState());
  }

  /** Re-link a draft to a re-picked file (fingerprint checked by the caller). */
  async restoreDraft(state: EditState, refile: File | Blob): Promise<Project> {
    const { decodePhoto } = await import('./import/decode');
    const original = await decodePhoto(refile);
    return this.openProject(original, state);
  }

  /** Open a project from an already-decoded image + edit state (resume flow). */
  adoptPhoto(original: OriginalImage, state: EditState): Project {
    return this.openProject(original, state);
  }

  closeProject(): void {
    this.project = null;
    this.state = emptyEditState();
    this.history.reset(this.state);
    this.orchestrator.clearProject();
    // Free detection models and the picked blend images — the memory ceiling is
    // the scarcest resource, and history (the only remaining referrer) is gone.
    blendAssets.clear();
    this.landmarkCache.clear();
    disposeFaceProvider();
    disposePoseProvider();
    disposeSegmentationProvider();
    this.emit();
  }

  async export(job: ExportJob): Promise<ExportResult> {
    if (!this.project) throw new Error('export: no open project');
    const { runExport } = await import('./export');
    return runExport(this.project.original, this.state, job, this.getLandmarks());
  }
}

/* ----------------------------- singleton ------------------------------- */

let engineSingleton: Engine | null = null;

/** Lazily construct the single Engine (client-only — needs the DOM). */
export function getEngine(): Engine {
  if (typeof window === 'undefined') {
    throw new Error('getEngine() must be called on the client');
  }
  if (!engineSingleton) engineSingleton = new Engine();
  return engineSingleton;
}

export type { EditState, EditAction } from './editState';
export type { Project, OriginalImage, ExportJob, ExportResult, CompareMode } from './types';
