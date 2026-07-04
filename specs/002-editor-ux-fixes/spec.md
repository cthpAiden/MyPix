# Feature Specification: Editor UX Fixes — Viewport Zoom, Continue-Editing, Face Detection

**Feature Branch**: `002-editor-ux-fixes`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Target UI/UX. Three major problems: (1) On load the editor zooms the photo in to fill the screen; instead it should open slightly zoomed out and let the user zoom in for detail — don't max-zoom to fill by default. (2) 'Continue editing' doesn't work: clicking it opens a new file-upload window instead of continuing the previous file. (3) Face-detection tools all show 'Couldn't analyze this photo. Try again.' — check whether something broke (MediaPipe) and fix it."

## Clarifications

### Session 2026-07-04

- Q: Now that "Continue editing" stores the full original photo locally, how many resumable drafts should the app keep? → A: Only the most recent (one resumable draft; a new edited photo replaces the prior one)
- Q: How should users control zoom in the editor? → A: Touch gestures (pinch + double-tap) plus a visible reset-to-full-view control
- Q: How far should users be able to zoom in for detail work? → A: Beyond actual pixels, up to ~4× (1 image pixel = 4 screen pixels)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Face-aware tools work again (Priority: P1)

A person opens a photo and taps a tool that relies on face detection (Skin, Retouch, Makeup, Reshape, Body, Background). The app detects the subject and lets them use the tool. Today every such tool fails with "Couldn't analyze this photo. Please try again," making a whole class of the app's headline features unusable.

**Why this priority**: This is a total functional breakage affecting the largest surface of the product — all subject-aware editing. Nothing about detection can be demonstrated until it works, so it is the single most valuable fix.

**Independent Test**: Open any photo with a clear face, open the Retouch (or Skin/Makeup) tool, and confirm detection completes and the tool becomes usable — without touching zoom or resume behavior.

**Acceptance Scenarios**:

1. **Given** a photo containing a clearly visible face, **When** the user opens a face-detection tool for the first time in a session, **Then** the app shows the "Looking at your photo…" state and then transitions to the working tool (not the failure message).
2. **Given** detection has already run once for a photo, **When** the user reopens the same tool, **Then** the tool opens immediately using cached results.
3. **Given** a photo with no detectable subject, **When** the user opens a face-detection tool, **Then** the app shows a clear "no subject found" style message and offers the relevant manual fallback — it does NOT show the generic analyze-failure error.
4. **Given** the device is offline and the detection assets were never loaded before, **When** the user opens a face-detection tool, **Then** the app shows the "needs one online load first" message rather than a generic failure.
5. **Given** the detection assets have loaded once, **When** the user later goes offline and reopens a detection tool, **Then** detection still works from cache.

---

### User Story 2 - Continue editing resumes instantly (Priority: P2)

A person edits a photo, leaves the app, and returns later. On the home screen they see a "Continue editing" card and tap it. Their previous edit reopens exactly where they left off — the same photo, the same adjustments — with no file-picker and no re-selecting the original.

**Why this priority**: The app advertises resuming work, but the current flow forces the user to hunt for and re-pick the exact same file, which reads as broken. Restoring a true one-tap resume delivers a core promised capability. It is P2 because it affects returning users rather than blocking the primary edit session outright.

**Independent Test**: Edit a photo, make a visible change, navigate away/close, reopen the app, tap "Continue editing," and confirm the editor reopens with the same photo and edits — with no file-upload dialog.

**Acceptance Scenarios**:

1. **Given** a previously edited photo with a saved draft, **When** the user taps "Continue editing," **Then** the editor opens directly with that photo and all prior edits applied, and no file-picker appears.
2. **Given** a resumed session, **When** the user compares against the original or continues adjusting, **Then** the original photo and edit history behave exactly as in the original session (non-destructive editing preserved).
3. **Given** a saved draft, **When** the user instead taps "Start fresh," **Then** the draft is discarded and the user proceeds to a normal import.
4. **Given** the user resumes and finishes, **When** a new draft is saved, **Then** it replaces the prior draft for that photo (one active draft per photo).
5. **Given** the stored original for a draft is no longer available on the device (e.g., storage was evicted), **When** the user taps "Continue editing," **Then** the app explains it needs the photo again and offers to re-pick it, rather than failing silently or showing a blank editor.

---

### User Story 3 - Comfortable default view with zoom to inspect (Priority: P3)

A person opens a photo in the editor. Instead of the image being blown up edge-to-edge, it appears fully visible with a comfortable margin around it. When they want to inspect or edit fine detail, they can zoom in (and pan around), then zoom back out or reset to the full view.

**Why this priority**: This is a UX-quality and capability improvement rather than a hard breakage — the editor is still usable today — so it ranks below the two functional fixes. It also introduces a genuinely new capability (zoom/pan) beyond just changing a default.

**Independent Test**: Open any photo and confirm it appears fully framed with margin (not filling the viewport edge-to-edge), then zoom in to see detail, pan, and reset to the full view — independent of detection or resume.

**Acceptance Scenarios**:

1. **Given** a freshly opened photo of any aspect ratio, **When** the editor first renders, **Then** the entire photo is visible with a comfortable margin around it and it is NOT scaled to fill the viewport edge-to-edge.
2. **Given** the default view, **When** the user pinches out or double-taps, **Then** the photo magnifies smoothly toward the focal point and finer detail becomes visible, up to approximately 4× the photo's actual pixels.
3. **Given** a zoomed-in view, **When** the user drags, **Then** the visible region pans and cannot be dragged so far that the photo leaves the viewport entirely.
4. **Given** any zoom/pan state, **When** the user taps the visible reset control, **Then** the view returns to the default comfortably-framed whole-photo view.
5. **Given** the user is zoomed in, **When** they use editing gestures that act on image position (pick, brush), **Then** those gestures map to the correct point on the photo at the current zoom/pan.
6. **Given** any zoom level, **When** the user exports, **Then** the exported image is the full edited photo at full resolution and is unaffected by the current on-screen zoom.

---

### Edge Cases

- **Very large or very small photos**: default framing keeps the whole image visible with margin regardless of source resolution or aspect ratio (portrait, landscape, square, panorama).
- **Multiple faces**: detection tools behave consistently when more than one face is present (per existing multi-face support).
- **No subject**: subject-aware tools show a purposeful "no subject" fallback, distinct from the load-failure error.
- **Offline first use vs. offline after cache**: first-ever detection while offline is explained; detection after a prior successful load works offline.
- **Storage pressure / eviction**: if a stored original can't be kept or is later evicted, resume degrades to an explained re-pick rather than a broken state; drafts still respect storage-quota handling.
- **Zoom + parameter scrub coexistence**: the interaction model must keep image zoom/pan distinct from parameter-scrub gestures so one does not accidentally trigger the other.
- **Reduced motion**: zoom and reset animations respect the reduced-motion preference.

## Requirements *(mandatory)*

### Functional Requirements

**Face detection (US1)**

- **FR-001**: All subject-aware tools (face, skin, retouch, makeup, reshape, body, background) MUST successfully run on-device detection for a photo containing a detectable subject, in both the installed PWA and browser contexts.
- **FR-002**: The on-device detection runtime and its models MUST be available same-origin so they can be cached for offline use, and MUST be present in any shipped/previewable build (their absence is the current root cause and MUST NOT recur).
- **FR-003**: Detection results MUST be cached per photo so reopening a tool does not re-run detection.
- **FR-004**: When no subject is found, tools MUST present a purposeful "no subject" fallback distinct from the generic analyze-failure message.
- **FR-005**: When detection genuinely cannot run (e.g., first use while offline with nothing cached), the app MUST show the specific, actionable bilingual message for that condition rather than the generic failure.
- **FR-006**: A build/verification check MUST fail or clearly warn if the detection assets required for these tools are missing, so this breakage is caught before it reaches the user.

**Continue editing (US2)**

- **FR-007**: Tapping "Continue editing" MUST reopen the previous session's photo and edits directly, without presenting a file-picker.
- **FR-008**: The app MUST persist enough of the original photo locally to reconstruct the previous edit session without user re-selection.
- **FR-009**: Resumed sessions MUST preserve non-destructive editing — the original image and editable state remain separate, and compare/undo behave as before.
- **FR-010**: The app MUST keep only one resumable draft overall — the most recently edited photo. Editing a different photo replaces the prior draft (and releases its stored original), keeping local storage bounded.
- **FR-011**: If the stored original for a draft is unavailable when resuming, the app MUST explain this and offer to re-pick the photo rather than failing silently.
- **FR-012**: Draft persistence MUST continue to handle device storage limits gracefully, surfacing the existing "export to keep this result" guidance when storage is constrained.
- **FR-013**: "Start fresh" MUST discard the current draft and proceed to normal import.

**Viewport zoom (US3)**

- **FR-014**: On first render of a photo, the editor MUST display the entire photo with a comfortable margin and MUST NOT scale it to fill the viewport edge-to-edge.
- **FR-015**: Users MUST be able to zoom in to inspect finer detail and zoom back out via touch gestures — pinch-to-zoom and double-tap.
- **FR-015a**: Zoom-in MUST allow magnification beyond the photo's actual pixels, up to approximately 4× (1 image pixel ≈ 4 screen pixels), to support fine retouch/brush work on small features.
- **FR-016**: Users MUST be able to pan while zoomed in, constrained so the photo cannot be moved entirely out of view.
- **FR-017**: A visible on-screen control MUST let users reset to the default comfortably-framed whole-photo view from any zoom/pan state.
- **FR-018**: Zoom/pan MUST be view-only: it MUST NOT alter the edited image or the exported result, which remains the full edited photo at full resolution.
- **FR-019**: Position-based editing gestures (color pick, brush/mask, targeted edits) MUST map correctly to image coordinates at any zoom/pan state.
- **FR-020**: Zoom, pan, and reset interactions MUST NOT conflict with the existing parameter-scrub and other editing gestures.

**Cross-cutting**

- **FR-021**: Every new or changed user-facing string MUST be provided in both English and Vietnamese, with Vietnamese diacritics rendered correctly.
- **FR-022**: All three fixes MUST be validated against the iOS Safari installed-PWA target, not only desktop.

### Key Entities *(include if feature involves data)*

- **Draft**: A saved, resumable edit session. Represents a photo the user was editing plus its editable edit-state, a small thumbnail, a timestamp, and (new) the original photo stored locally to resume without re-selection. Only one draft is retained overall — the most recently edited photo; editing another photo replaces it and releases the prior stored original.
- **Detection result (landmarks/segmentation)**: On-device analysis of a photo's subject (face landmarks, pose, or segmentation), cached per photo+geometry and consumed by subject-aware tools without exposing detector internals.
- **Viewport state**: The current on-screen zoom level and pan offset for the editor preview. View-only; never part of the exported image.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of subject-aware tools successfully complete detection on a photo with a clear face (0% show the generic analyze-failure message when a subject is present).
- **SC-002**: A returning user can resume a prior edit in a single tap, with zero file-picker interactions, in at least 95% of resumes where the original is still stored.
- **SC-003**: On first open, the whole photo is visible with margin for 100% of tested aspect ratios (portrait, landscape, square, panorama), with none rendered edge-to-edge.
- **SC-004**: Users can zoom from the default view to a detail view (up to ~4× actual pixels) and back within 2 gestures, and reset to the full view via a single tap on the visible reset control.
- **SC-005**: Exported images are identical regardless of on-screen zoom/pan state (view state has no effect on output).
- **SC-006**: All newly surfaced messages appear correctly in both English and Vietnamese.
- **SC-007**: Support/complaint recurrence for "continue editing opens upload" and "can't analyze photo" drops to zero after the fix.

## Assumptions

- **Detection root cause**: The failure is caused by the required on-device detection assets (models and runtime fileset) being absent from the running build, not by a logic regression in the detection code paths. The fix centers on reliably provisioning and verifying those assets; existing loading, caching, offline-guard, and no-subject handling are retained.
- **Resume approach (confirmed with user)**: "Continue editing" will store the original photo locally so resume is one-tap with no re-pick, retaining only the single most-recent draft (see Clarifications). When local storage cannot retain or later evicts the original, the flow degrades to an explained re-pick. This intentionally revises the prior "never store pixels beyond a thumbnail" implementation choice while keeping all processing on-device and at zero ongoing cost.
- **Default zoom level**: "Slightly zoomed out" is interpreted as fitting the entire photo within the viewport with a comfortable margin (whole image visible, not filling edge-to-edge). Exact margin is a design/tuning detail.
- **Zoom interaction (confirmed with user)**: Pinch-to-zoom and double-tap gestures plus pan, with a visible reset-to-full-view control, and a maximum zoom of ~4× actual pixels (see Clarifications). Chosen to suit the iOS Safari PWA target and to coexist with existing scrub/brush/pick gestures.
- **Scope boundary**: This feature is limited to the three reported problems and their direct supporting changes. It does not add new editing tools or redesign unrelated screens.
- **Privacy/cost**: All changes remain fully client-side, on-device, and zero ongoing cost, consistent with the project constitution.
