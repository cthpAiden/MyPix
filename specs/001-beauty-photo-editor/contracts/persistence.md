# Contract: Persistence (Drafts, Presets, Settings) & Preset Share-Code

**Scope**: `src/persistence/` — the only code that touches IndexedDB (via `idb`) and localStorage. **Image pixels are never stored** (sole exception: the ≤ ~50 KB draft resume thumbnail).

## IndexedDB schema (`mypix`, version 1)

| Store | Key | Value | Indexes |
|---|---|---|---|
| `drafts` | `id` | `Draft` (see data-model.md) | `savedAt`, `fingerprint` |
| `presets` | `id` | `Preset` | `sortOrder` |
| `settings` | fixed key `'app'` | `Settings` | — |

Locale is additionally mirrored to `localStorage('mypix.locale')` and a cookie for pre-hydration/i18n-routing reads.

## API

```ts
interface DraftStore {
  saveDraft(d: Draft): Promise<void>;          // upsert by fingerprint; debounced by caller
  latestDraft(): Promise<Draft | null>;        // resume-card query
  matchDraft(fp: ImageFingerprint): Promise<Draft | null>;
  deleteDraft(id: string): Promise<void>;
}
interface PresetStore {
  list(): Promise<Preset[]>;                   // sortOrder ascending
  save/rename/reorder/delete(...): Promise<void>;
  exportCode(id: string): Promise<string>;     // share code (below)
  importCode(code: string): Promise<Preset>;   // throws TypedError('invalid-code' | 'unsupported-version')
}
interface SettingsStore { get(): Promise<Settings>; patch(p: Partial<Settings>): Promise<void>; }
```

**Failure contract**: every write catches `QuotaExceededError`/generic IDB failure and resolves to a typed result the UI turns into the bilingual "storage full — export to keep your work" guidance (spec edge case). Reads of corrupt/unmigratable records return `null` + telemetry-free console warning, never a crash. `navigator.storage.persist()` is requested once on first draft save.

## Preset share-code format (FR-112)

```text
MYPIX1.<base64url( deflate-raw( UTF-8 JSON payload ) )>

payload = {
  v: number,                    // preset schemaVersion
  name: string,
  ops: Operation[]              // portable operation types only
}
```

- `MYPIX1` = format version 1 of the envelope (distinct from the inner schema version; envelope changes only if encoding changes).
- Encode/decode via `CompressionStream('deflate-raw')` — native, zero-dependency.
- Import pipeline: prefix check → base64url decode → inflate → JSON parse → schema validate → migrate `v` → reject non-portable op types. Every failure maps to a specific bilingual message.
- Round-trip (`importCode(exportCode(p))` ≡ p) is unit-tested (story 1.6 acceptance 3).

## Autosave contract

- Trigger: any `dispatch` → debounce ~1 s; immediate flush on `visibilitychange → hidden` and `pagehide`.
- Payload: serialized EditState with history truncated to the most recent N (bounded size), + fingerprint, fileName, regenerated thumbnail.
- Restore flow: launch → `latestDraft()` → resume card (bilingual, shows thumb + fileName + savedAt) → user re-picks file → fingerprint match → `engine.restoreDraft`; mismatch → explicit "this isn't the same photo" choice (use anyway / cancel), never silent (story 1.8 acceptance 3).
