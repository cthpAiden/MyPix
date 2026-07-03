# Contract: Render Engine & Tool-Module Interface

**Scope**: What `src/engine/` exposes to tool modules and the UI, and what a tool module must look like. Modules depend on this contract only — never on each other.

## Engine surface

```ts
interface Engine {
  // Project lifecycle
  importPhoto(source: File | Blob): Promise<Project>;      // decode, EXIF, HEIC fallback, color-space normalize
  restoreDraft(draft: Draft, refile: File): Promise<Project>; // fingerprint-checked re-link

  // Edit state (see edit-state.md)
  dispatch(action: EditAction): void;
  getState(): EditState;
  subscribe(listener: (s: EditState) => void): Unsubscribe;

  // Rendering
  invalidate(): void;                       // schedule a preview re-render (rAF-coalesced)
  renderPreview(): void;                    // working-resolution GL pipeline + Fabric overlay composite
  getPreviewCanvas(): HTMLCanvasElement;    // the single on-screen surface
  setCompareMode(mode: 'off' | 'hold-original' | { divider: number }): void;

  // Export (see ExportJob in data-model.md)
  export(job: ExportJob): Promise<ExportResult>;  // tiled full-res render + encode + share/save
}
```

**Rendering guarantees**
- Preview renders at working resolution (longest edge ≤ device-safe cap, e.g. 2048 px × DPR-aware); export renders the identical pipeline at full resolution in tiles — *same shaders, same math*, so preview ≡ export (SC-003).
- One shared WebGL2 context; on `webglcontextlost` the engine rebuilds all GL resources from `EditState` and re-renders — callers never handle context loss.
- `dispatch` during a scrub is cheap: state update is synchronous, re-render is rAF-coalesced and may drop to a lower working resolution mid-gesture, restoring full working resolution on gesture end (SC-009, 120 Hz-safe rule).

## Tool-module contract

Each `src/modules/<domain>/` exports a `ToolModule` the editor shell registers:

```ts
interface ToolModule {
  id: string;                       // 'adjust' | 'face' | 'makeup' | ...
  icon: Component; titleKey: I18nKey;         // all text via i18n keys (Constitution IV)
  phase: 1 | 2 | 3;
  isAvailable(ctx: ToolContext): Availability; // e.g. face tools need landmarks.faces.length > 0
  Panel: Component<{ ctx: ToolContext }>;      // bottom-sheet UI; emits engine.dispatch(...) only
  requiredVision?: ('face' | 'pose' | 'segmentation')[];  // engine lazy-loads these before opening
}

interface ToolContext {
  engine: Engine;
  landmarks: DetectedLandmarkSet | null;  // read-only
  locale: Locale;
}
```

**Boundary rules (enforced in review + lint)**
- A module imports only from `engine/`, `vision/` types, `shared/`, `ui/`, and `i18n/`. Importing from a sibling `modules/*` is a violation.
- A module's only side-effect channel is `engine.dispatch()`. No module touches the GL context, Fabric canvas, or persistence directly.
- `Availability` = `available | { unavailable: reasonKey }` — the shell renders the bilingual reason and the manual-tool fallback suggestion (spec edge cases).

## UI-shell contracts (src/ui/)

- **Gesture editing**: `useParamScrub(params: ScrubParam[])` — horizontal drag = value, vertical drag = switch param, exposes `{ activeParam, value, readout }`; the hook throttles engine dispatch, never the visual readout.
- **Sheet tray**: `<ToolSheet detents={['peek','half','full']}>` — spring-physics, velocity-honoring, interruptible; hosts every module Panel so all tools share one interaction grammar.
- **Loupe**: `<PrecisionLoupe />` shared by warp/retouch/eyedropper.
- **Compare**: before/after divider + press-and-hold hook mapped to `engine.setCompareMode`.
- All motion honors `prefers-reduced-motion`; all sounds gate on `settings.soundEnabled`.
