# Device Matrix — Install / Offline / Update (T095, US4.4)

**Target**: iPhone 17 Pro, Safari, **installed** PWA.
**Covers**: SC-013 (installed shell loads and a full import→edit→export completes with no network), SC-015 (nothing leaves the device — verifiable in airplane mode), FR-404 (clean update without disrupting an in-progress session / corrupting a draft).

**Requires a production build**, not `next dev` — the service worker and offline behaviour only exist in the static export served with COOP/COEP headers:

```bash
npm run build          # output: 'export'
npm run start:static   # mirrors vercel.json headers; or use the deployed Vercel URL
```

Relevant code: service worker [`src/app/sw.ts`](../../src/app/sw.ts) (precache app shell, `CacheFirst` for `/models` `/mediapipe` `/filters` `/stickers` `/frames`, `skipWaiting: false`, `SKIP_WAITING` message opt-in), model offline guard [`src/vision/modelLoader.ts`](../../src/vision/modelLoader.ts) (`assertModelAvailable` → `ModelUnavailableOfflineError`), install guidance [`src/ui/InstallGuide.tsx`](../../src/ui/InstallGuide.tsx), draft persistence [`src/persistence/drafts.ts`](../../src/persistence/drafts.ts), resume/relink [`src/ui/ResumeCard.tsx`](../../src/ui/ResumeCard.tsx).

## A. Install

| Step | Expectation | Result |
|------|-------------|--------|
| Open the deployed URL in Safari | In-app guidance shows Share → Add to Home Screen | ⬜ |
| Add to Home Screen | Correct icon + name ("MyPix"), no Safari chrome | ⬜ |
| Launch from home screen | Standalone, portrait, near-black theme, safe-area insets respected | ⬜ |
| First launch **online** once | Confirm the vision tools load their models at least once (warms the SW model cache for offline) | ⬜ |

## B. Full offline flow (airplane mode) — SC-013 / SC-015

Enable **Airplane mode** (and confirm Wi-Fi off). Then, from a cold launch:

| Step | Expectation | Result |
|------|-------------|--------|
| Launch installed app | Shell loads from cache, no network error | ⬜ |
| Import P48 from library | Decodes and displays (native/heic2any both offline-capable) | ⬜ |
| Apply ≥1 adjustment + a filter | Live preview updates | ⬜ |
| Face tool (model pre-cached in A) | Detection runs offline | ⬜ |
| Face tool if model was **never** cached | Bilingual "needs one online load" message (not a hang/crash) | ⬜ |
| Add a Vietnamese text overlay | Renders on canvas | ⬜ |
| Export JPEG **and** PNG | Files save at full resolution, no blank/crash | ⬜ |
| Share sheet | Opens with the file; cancel → save fallback | ⬜ |
| Network inspector / privacy check | **Zero** outbound image requests during the whole flow (SC-015) | ⬜ |

## C. Update without disrupting an in-progress edit — FR-404

`skipWaiting: false` means a newly-deployed worker waits and only activates on the next clean launch, so an update can never yank the rug mid-edit.

| Step | Expectation | Result |
|------|-------------|--------|
| Start editing (import + several edits), **do not** export | Draft autosaves (~1 s debounce; flush on background) | ⬜ |
| While the app is open, deploy a new version (bump a visible string) | Old worker keeps serving; the open session is untouched — no reload, no string flip mid-edit | ⬜ |
| Background the app, reopen | New worker may activate on this clean launch | ⬜ |
| Resume card appears | Re-pick the same photo → **in-progress edit fully restored** with working undo/redo | ⬜ |
| Draft integrity after update | Edit stack intact, no corruption, thumbnail matches | ⬜ |
| Optional: in-app "update ready" → consent | `SKIP_WAITING` message activates the new worker immediately, then reloads cleanly | ⬜ |

## D. Draft survival edge cases

| Step | Expectation | Result |
|------|-------------|--------|
| Mid-edit, force-quit the app (swipe up), relaunch | Resume card → same photo → edit restored (SC-017) | ⬜ |
| Resume, but re-pick a **different** photo | Explicit, non-silent mismatch message; no wrong-apply | ⬜ |
| Fill storage near quota, keep editing | `QuotaExceededError` handled gracefully → bilingual "export to keep this result" prompt, no silent data loss | ⬜ |
| Simulate 7-day eviction (clear site data), relaunch | App still installs/loads; export is framed as the durable save | ⬜ |

## Result

- [ ] A/B/C/D all pass on the target device → SC-013, SC-015, SC-017, FR-404 certified.

**Recorded result (fill on device):** _date / iOS version / build SHA / overall PASS·FAIL_
