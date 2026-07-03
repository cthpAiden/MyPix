# Contract: Edit-State Schema (the central contract)

**Scope**: The versioned, serializable edit-stack schema that every tool module writes and the engine renders. This is the *only* channel through which editing domains affect the image — modules never call each other (Constitution V).

## Core types

```ts
interface EditState {
  schemaVersion: number;            // current: 1; migrations must be additive
  operations: Operation[];          // ordered pixel-pipeline steps
  layers: Layer[];                  // z-ordered overlay content
}

interface Operation<T extends OperationType = OperationType> {
  id: string;                       // stable — re-editing targets this id
  type: T;
  params: OperationParams[T];       // typed per operation (see registry)
  enabled: boolean;
  mask?: RegionMaskRef;             // landmark-region or displacement-field reference
}
```

## Reducer actions (the module → engine API)

```ts
type EditAction =
  | { kind: 'op/add';    op: Operation }
  | { kind: 'op/update'; id: string; params: Partial<OperationParams[T]> }  // re-edit prior step
  | { kind: 'op/toggle'; id: string; enabled: boolean }
  | { kind: 'op/remove'; id: string }
  | { kind: 'layer/add' | 'layer/update' | 'layer/remove' | 'layer/reorder'; ... }
  | { kind: 'history/undo' } | { kind: 'history/redo' }
  | { kind: 'state/replace'; state: EditState };   // draft restore, preset apply (merge semantics below)

dispatch(action: EditAction): void   // pure reducer; every dispatch is undoable
```

**Rules**
- The reducer is pure and synchronous; all params clamp to their documented ranges inside the reducer (invalid input can never enter the stack).
- `op/update` on a scrubbing gesture coalesces into one history entry per gesture (pointer-down → pointer-up), so undo steps match user intent.
- Preset apply = replace/insert the preset's portable operations, leaving photo-specific ops (crop, reshape, retouch, layers) untouched.
- Serialization: `JSON.stringify(editState)` must round-trip losslessly (`deserialize(serialize(s)) deep-equals s`) — this is unit-tested and is what Draft and Preset persistence rely on.

## Operation registry (params ranges)

| type | phase | params (all numbers clamp to range) |
|---|---|---|
| `adjust` | 1 | brightness, contrast, exposure, highlights, shadows, whites, blacks, saturation, vibrance, temperature, tint, sharpness — each −100…100 |
| `curves` | 1 | per channel (`rgb`,`r`,`g`,`b`): control points `{x,y}[]` in 0…1, 2–16 points, x strictly increasing |
| `colorMixer` | 1 | 8 bands (red…magenta) × { hue −100…100, sat −100…100, lum −100…100 } |
| `colorGrade` | 1 | shadows/midtones/highlights × { hue 0…360, sat 0…100 }, blending, balance |
| `whiteBalance` | 1 | temp −100…100, tint −100…100, or `neutralRef {x,y}` (image-space) |
| `crop` | 1 | rect (image-space), angle −45…45°, rotate90 0–3, perspective quad, ratioPreset |
| `filter` | 1 | filterId (must exist in filter index), intensity 0…1 |
| `finishing` | 1 | vignette −100…100, grain 0…100, clarity/texture −100…100, dehaze −100…100, fade 0…100, bloom 0…100 |
| `faceReshape` | 2 | faceIndex ≥ 0; per-feature −1…1: jaw, chin, cheekWidth, foreheadWidth, noseBridge, noseTip, lipShape, lipFullness, browShape, browPosition, eyeSize, eyeSpacing |
| `skinSmooth` | 2 | faceIndex; strength 0…1; toneLightness −1…1; toneTint −1…1 |
| `targetedEnhance` | 2 | faceIndex; teethWhiten 0…1; eyeBrighten 0…1; underEyeReduce 0…1 |
| `bodyReshape` | 2 | waistSlim, legLengthen, armSlim, heightIllusion — each −1…1 |
| `liquify` | 2 | strokes: { path, radius, strength, mode: push/freeze/reconstruct }[] → compiled displacement field |
| `backgroundEffect` | 2 | mode: blur/replace/grayscale/transparent; blurStrength 0…1; color; edgeRefine 0…1 |
| `retouch` | 3 | strokes: { mode: clone/heal, sourceOffset, path, radius, hardness }[] |

**Landmark-dependent types** (`faceReshape`, `skinSmooth`, `targetedEnhance`, `bodyReshape`, makeup layers): the engine refuses to render them (op renders as no-op + UI states why) when the referenced subject is absent from `DetectedLandmarkSet` — spec edge cases "no face / no body".

## Layer schema

See [data-model.md](../data-model.md#layer). Contract points: transforms are **image-space** (export-resolution independent); text `content` is NFC-normalized before entering the state; `fontId` must be in the verified-Vietnamese registry; makeup layers carry a `LandmarkAnchor` and re-derive geometry from landmarks at render time (they store *intent*, not baked pixels).

## Versioning & migration

- `schemaVersion` bumps only when a change is not backward-readable; each bump ships a pure `migrate(vN) → vN+1` function; drafts and preset codes run the migration chain on load.
- Unknown operation types on load (older app reading newer draft — shouldn't happen, but) fail soft: op preserved but disabled, user informed.
