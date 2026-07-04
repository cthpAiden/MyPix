# Contract: Editor Viewport (Default Framing, Zoom, Pan, Reset)

Delivers the comfortable default view and zoom/pan/reset (US3 / FR-014…FR-020) as a view-only layer over the existing preview canvas.

## New hook: `src/ui/useViewport.ts`

```ts
interface Viewport {
  scale: number;              // [1, sMax], relative to default fit
  tx: number; ty: number;     // clamped pan translate (CSS px)
  style: React.CSSProperties; // { transform: `translate(${tx}px,${ty}px) scale(${scale})`, transformOrigin: 'center' }
  handlers: {                 // multi-pointer layer; delegates single-pointer to `fallback`
    onPointerDown, onPointerMove, onPointerUp, onPointerCancel
  };
  reset(): void;              // animate to default view (respect reduced-motion)
  isZoomed: boolean;          // scale > 1 (for showing the reset control)
}

function useViewport(opts: {
  container: RefObject<HTMLElement>;   // the canvas host (measures fit)
  canvas: HTMLCanvasElement;           // preview canvas (outW×outH)
  fallback: PointerHandlers;           // existing scrub/pick/brush handlers
  reducedMotion: boolean;
}): Viewport
```

## Gesture routing (FR-020, coexistence)

- **2 active pointers** → viewport consumes: pinch (distance ratio) sets `scale`; midpoint delta sets `tx,ty`. Not forwarded to `fallback`.
- **1 active pointer** → forwarded to `fallback` unchanged (parameter scrub, or pick/brush when active). No scrub regression.
- **Double-tap** (single pointer) → toggle default ⇄ zoomed-in, centered on the tap point.
- **Reset control** → `reset()`.

Container keeps `touch-action: none` (Pointer Events deliver multi-touch as distinct `pointerId`s; native pinch suppressed so the app controls zoom).

## Clamping

- `fit` = CSS-px-per-canvas-px at default framing = `min(containerW/outW, containerH/outH) * MARGIN` (`MARGIN ≈ 0.9`).
- `scale ∈ [1, sMax]`, `sMax = 4 / fit` (≈ 4× actual pixels; final constant in-hook).
- `tx,ty` clamped so the scaled image always overlaps the viewport (cannot be dragged fully out).

## Editor screen wiring (`src/app/[locale]/edit/page.tsx`)

- Replace the canvas fit styling (`maxWidth/maxHeight:100%; objectFit:contain`) with: size to `fit` and apply `viewport.style`. Keep container `overflow-hidden`.
- Compose handlers: canvas host uses `viewport.handlers`; `viewport` internally calls the existing `photoHandlers` for single-pointer events. Order: viewport first, delegate single-pointer through.
- Render a visible reset control (reuse `IconButton`/primitives + an icon) as a canvas overlay, shown when `viewport.isZoomed`.
- New i18n key for the reset label in `en.json` + `vi.json`.

## Invariants

| Requirement | Guarantee |
|-------------|-----------|
| FR-014 | Default view frames the whole photo with ~0.9 margin, never edge-to-edge. |
| FR-015 / 015a | Pinch + double-tap zoom in/out, up to ~4× actual pixels. |
| FR-016 | Two-finger pan, clamped in view. |
| FR-017 | Visible reset control returns to default. |
| FR-018 / SC-005 | Transform is CSS-only; engine render + export output unaffected by zoom/pan. |
| FR-019 | Pick/brush mapping stays correct — `toNorm` reads `getBoundingClientRect`, which reflects the transform (no code change to mapping). |
| FR-020 | Single-finger scrub preserved; only multi-touch/double-tap drive the viewport. |

## Verification

- **Unit (vitest)**: clamp math — `scale` bounds, `tx/ty` bounds for representative container/photo sizes; `fit` recompute on resize.
- **Manual (quickstart)**: default framing across aspect ratios; pinch to ~4× and pan; reset; pick a color while zoomed and confirm it samples the correct point; export while zoomed and confirm output is full-frame and unaffected.
