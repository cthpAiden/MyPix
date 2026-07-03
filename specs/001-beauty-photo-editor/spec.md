# Feature Specification: MyPix — Beauty & Photo Editing PWA

**Feature Branch**: `001-beauty-photo-editor`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Build a Xingtu-style photo and beauty editing PWA. The user takes or uploads a photo and edits it using a full suite of tools, all running free and client-side, then exports a high-resolution result." (Full four-phase brief provided; see Assumptions for how ambiguous points were resolved.)

---

## Overview

MyPix is a beauty and photo-editing Progressive Web App delivered as a personal gift. A person opens the app on an installed iPhone home-screen icon, brings in a photo (from their library or by taking one), edits it with a deep suite of professional and beauty tools that run entirely on the device at zero ongoing cost, and exports or shares the result at the photo's full original resolution with no quality loss. The app is fully bilingual (English + Vietnamese) and works offline.

The work is delivered in **four sequential phases**. Each phase is a self-contained, shippable slice: Phase 1 alone is a complete, useful photo editor; each later phase layers additional capability on top without breaking earlier phases.

## Phased Delivery Model

This single specification is organized into four phases so that each can be planned, tasked, and implemented independently and in order:

- **Phase 1 — Foundation & Core Adjustments**: a complete standalone editor (import → adjust/filter/crop → full-resolution export/share), bilingual, installable, offline, with non-destructive editing and draft recovery.
- **Phase 2 — Face & Body Intelligence**: on-device face/body understanding for reshape, skin, targeted enhancements, auto-beautify, manual warp, and background blur/removal.
- **Phase 3 — Creative & Makeup Layer**: makeup overlays, stickers, Vietnamese-capable text, frames, blend/double-exposure, collage, doodle, and manual clone/heal retouch.
- **Phase 4 — Polish, Localization & Device Verification**: end-to-end bilingual audit, Vietnamese font verification, performance hardening on the target device, and PWA/offline verification.

**Priority convention**: Priorities (P1/P2/P3) are assigned **within each phase**. A phase's P1 stories are the must-haves that make that phase coherent; P2/P3 are valuable additions that can follow. Across phases, the phase order itself is the top-level sequence (all of Phase 1 precedes Phase 2, etc.). Each user story below is written to be independently testable and independently demonstrable.

---

## User Scenarios & Testing *(mandatory)*

### PHASE 1 — Foundation & Core Adjustments

#### User Story 1.1 - Bring in a photo and get a full-resolution result out (Priority: P1)

The user opens MyPix, adds a photo (choosing an existing image or taking a new one via the device camera), sees it on the editing canvas, and — even before any edits — can export or share it back out at its full original resolution in their chosen format. This is the end-to-end backbone every other tool plugs into.

**Why this priority**: Without a reliable import→view→export loop there is no product. This story alone delivers a working, if minimal, app and proves the hardest technical constraint (full-resolution export on the target device) early.

**Independent Test**: Add a large photo (including a HEIC photo and a 48-megapixel photo), confirm it displays correctly, export it as both PNG and JPEG, and verify the exported files match the original pixel dimensions with no downscaling.

**Acceptance Scenarios**:

1. **Given** the app is open with no photo loaded, **When** the user chooses "add photo" and picks an image from their library, **Then** the photo appears on the canvas at correct orientation and aspect ratio.
2. **Given** the app is open, **When** the user chooses "take photo", **Then** the device's native camera opens (via the system camera handoff, not an in-app live camera view) and the captured photo loads onto the canvas.
3. **Given** a HEIC photo is selected, **When** the device cannot display it directly, **Then** the app converts it on-device and displays it without error.
4. **Given** a photo is loaded, **When** the user exports it, **Then** they can choose PNG or JPEG, and the exported image has the same pixel dimensions as the original with no visible additional compression beyond the chosen setting.
5. **Given** a 48-megapixel photo is loaded, **When** the user exports at full resolution, **Then** the export succeeds on the target device without the app blanking, crashing, or reloading.
6. **Given** an exported result, **When** the user chooses "share", **Then** the system share sheet opens with the image ready to send to another app.

---

#### User Story 1.2 - Adjust light and color (Priority: P1)

The user refines a photo with the core global adjustments — brightness, contrast, exposure, highlights, shadows, whites, blacks, saturation, vibrance, warmth (temperature), tint, and sharpness — seeing each change live on the canvas as they scrub a control, non-destructively.

**Why this priority**: These are the everyday adjustments that make up the majority of real edits and define whether the editor feels responsive and premium.

**Independent Test**: Load a photo, move each adjustment control, confirm the preview updates in real time and that resetting a control returns the image exactly to its prior state (non-destructive).

**Acceptance Scenarios**:

1. **Given** a photo is loaded, **When** the user scrubs any adjustment control, **Then** the on-canvas preview updates smoothly in real time as the value changes.
2. **Given** an adjustment has been changed, **When** the user resets that control to its default, **Then** the image returns exactly to the pre-adjustment appearance.
3. **Given** several adjustments have been applied, **When** the user exports, **Then** the exported full-resolution image reflects all adjustments faithfully (the export matches the preview).

---

#### User Story 1.3 - Crop, rotate, straighten, and correct perspective (Priority: P1)

The user reframes a photo: free or preset-ratio crop, 90° rotation, fine straighten (horizon leveling), and perspective/keystone correction, with alignment guides (grid, rule-of-thirds).

**Why this priority**: Framing is a fundamental, frequently-first editing step and is required for the social aspect-ratio export presets to be meaningful.

**Independent Test**: Load a photo, crop to a preset ratio, rotate and straighten it, apply perspective correction, and confirm the composition updates and exports correctly.

**Acceptance Scenarios**:

1. **Given** a photo is loaded, **When** the user selects a crop ratio (e.g., 1:1, 4:5, 9:16, or freeform), **Then** the crop overlay constrains to that ratio and the result reflects the chosen frame.
2. **Given** a tilted horizon, **When** the user drags the straighten control, **Then** the image rotates by fine degrees with a guide grid visible, and the frame auto-fills without leaving empty corners.
3. **Given** converging vertical lines, **When** the user applies perspective correction, **Then** the lines straighten and the corrected image can be exported.

---

#### User Story 1.4 - Advanced color control (Priority: P2)

The user performs precise color work: per-channel and luminance tone curves; hue/saturation/luminance control of individual color bands (selective color / color mixer); shadow–midtone–highlight color grading; split toning; and white-balance setting including a neutral-picker (eyedropper).

**Why this priority**: These separate a casual editor from a serious one and directly support the "professional-quality look" goal, but they build on the core adjustment engine from 1.2.

**Independent Test**: Load a photo, bend a tone curve on a single channel, shift just the reds via the color mixer, apply a color grade, and confirm each is isolated, correct, and preserved through export.

**Acceptance Scenarios**:

1. **Given** the curves tool is open, **When** the user selects the red, green, blue, or luminance channel and drags a point, **Then** only that channel's response changes and the preview updates live.
2. **Given** the color mixer is open, **When** the user reduces the saturation of the red band only, **Then** red areas desaturate while other colors are unaffected.
3. **Given** the white-balance eyedropper, **When** the user taps a neutral gray area, **Then** the overall color cast is neutralized to that reference.

---

#### User Story 1.5 - Filters, film looks, and creative finishing (Priority: P2)

The user applies one-tap looks from an organized filter library — including film-stock-style emulations — each with an adjustable intensity, and adds creative finishing touches: vignette, film grain, clarity/texture/dehaze, fade/matte, and highlight bloom/glow.

**Why this priority**: Filters are the most-used feature in this app category and the fastest path to a satisfying result, but they layer on top of the adjustment foundation.

**Independent Test**: Apply several filters, adjust each one's intensity from 0–100%, stack a vignette and grain on top, and confirm looks are combinable, adjustable, and exported faithfully.

**Acceptance Scenarios**:

1. **Given** the filter library is open, **When** the user taps a filter, **Then** it applies to the preview, and tapping again (or a strength control) reveals an intensity slider from 0–100%.
2. **Given** a filter is applied at partial intensity, **When** the user changes the intensity, **Then** the look blends proportionally between the unfiltered and full-strength result.
3. **Given** a finished look, **When** the user adds a vignette and grain, **Then** both render over the current result and survive export at full resolution.

---

#### User Story 1.6 - Save and reuse custom presets/recipes (Priority: P2)

The user saves their current combination of filter + adjustments as a named preset ("recipe"), reuses it on other photos with one tap, manages (renames/reorders/deletes) their presets, and can export/import a preset as a shareable code.

**Why this priority**: Reusable looks are a signature power-user and consistency feature, but they depend on 1.2/1.5 existing first.

**Independent Test**: Build a look, save it as a preset, load a different photo, apply the preset, and confirm the identical look is reproduced; then export the preset as a code and re-import it.

**Acceptance Scenarios**:

1. **Given** a photo with adjustments and a filter applied, **When** the user saves it as a preset with a name, **Then** the preset appears in their preset list.
2. **Given** a saved preset and a new photo, **When** the user applies the preset, **Then** the same adjustment/filter combination is applied at the saved intensities.
3. **Given** a saved preset, **When** the user exports it as a code and later imports that code, **Then** an equivalent preset is recreated.

---

#### User Story 1.7 - Compare, undo/redo, and re-edit any step (Priority: P1)

The user compares the current edit against the original — both with a draggable before/after slider and by pressing and holding to momentarily reveal the original — and moves backward/forward through their edit history with undo/redo. Because editing is non-destructive, the user can reopen and change any earlier step's settings without losing later work where feasible.

**Why this priority**: Confidence to experiment (compare + safe undo) is essential to the editing experience and is a direct requirement of the project's non-destructive-editing principle.

**Independent Test**: Make several edits, use the before/after slider and press-and-hold reveal, undo and redo several steps, reopen an earlier adjustment and change it, and confirm the original is always recoverable.

**Acceptance Scenarios**:

1. **Given** an edited photo, **When** the user drags the before/after divider, **Then** the canvas shows the original on one side and the edited result on the other along the divider.
2. **Given** an edited photo, **When** the user presses and holds the canvas, **Then** the original is shown for as long as the press is held and the edit returns on release.
3. **Given** a sequence of edits, **When** the user taps undo then redo, **Then** the edit state steps backward and forward accordingly.
4. **Given** a prior adjustment step, **When** the user reopens it and changes its value, **Then** the change is reflected without discarding unrelated later edits (where the edits are independent).

---

#### User Story 1.8 - Never lose work: draft autosave and recovery (Priority: P1)

The user's edit state (the sequence of edits, not a copy of the image pixels) is automatically saved locally as they work, so that if the app is closed, backgrounded, or reloaded, they can resume the in-progress edit.

**Why this priority**: Mobile sessions are frequently interrupted, and the target platform can reclaim app memory/state at any time; losing an in-progress edit would be a serious experience failure.

**Independent Test**: Begin editing, close/reload the app, reopen it, and confirm the in-progress edit is restored to where it left off.

**Acceptance Scenarios**:

1. **Given** an in-progress edit, **When** the app is reloaded or reopened, **Then** the user is offered (or automatically returned to) their in-progress edit state.
2. **Given** a restored draft, **When** the user continues editing, **Then** undo/redo history and non-destructive re-editing behave as before (subject to reasonable limits).
3. **Given** the original image is still available on the device, **When** a draft is restored, **Then** it re-links to that image; **if** the original is unavailable, the app clearly communicates this rather than failing silently.

---

#### User Story 1.9 - Use the app fully in English or Vietnamese (Priority: P1)

The user finds a clearly visible language toggle in the main interface and switches the entire app between English and Vietnamese; all interface text updates, and Vietnamese text — including full diacritics and stacked tone marks — renders correctly everywhere.

**Why this priority**: Full bilingual support is a non-negotiable principle of this project and central to who the app is for.

**Independent Test**: Toggle between English and Vietnamese and confirm every visible string switches language, with Vietnamese tone marks (e.g., ế, ộ, ữ, ẫ, ợ) rendering correctly, and that the preference persists across restarts.

**Acceptance Scenarios**:

1. **Given** the app in English, **When** the user activates the visible language toggle, **Then** all interface text switches to Vietnamese without a full reload disrupting their work.
2. **Given** the app in Vietnamese, **When** any screen or tool is opened, **Then** its text displays with correct Vietnamese diacritics and tone marks, with no missing glyphs or clipped marks.
3. **Given** a chosen language, **When** the user restarts the app, **Then** the previously chosen language is remembered.

---

#### User Story 1.10 - Install to the home screen and use offline (Priority: P1)

The user installs MyPix to their iPhone home screen and launches it as a standalone app; the editing shell loads and functions with no network connection.

**Why this priority**: The app is intended to live as an installed PWA on a specific device, and offline reliability is part of the promised experience.

**Independent Test**: Install to the home screen, enable airplane mode, launch the app, and confirm the editing shell loads and a photo can be imported, edited, and exported entirely offline.

**Acceptance Scenarios**:

1. **Given** the app in the browser, **When** the user follows the in-app guidance to add it to the home screen, **Then** it installs with the correct name and icon and launches in standalone (full-screen) mode.
2. **Given** the installed app and no network connection, **When** the user launches it, **Then** the editing shell loads and core editing and export work offline.
3. **Given** an updated version is available, **When** the user next launches while online, **Then** the app updates without breaking an in-progress session.

---

### PHASE 2 — Face & Body Intelligence

#### User Story 2.1 - Detect the face and reshape features (Priority: P1)

On a portrait, the app detects the face on-device and offers fine reshape controls — jaw, chin, cheek width, forehead width, nose bridge and tip size, lip shape and fullness, eyebrow shape and position, eye size and spacing — each adjustable with natural-looking results.

**Why this priority**: Face reshape is the defining capability of this app category and the anchor for the rest of Phase 2.

**Independent Test**: Load a portrait, confirm the face is detected, adjust each reshape control, and verify changes are localized to the intended feature and look natural; confirm graceful handling when no face or multiple faces are present.

**Acceptance Scenarios**:

1. **Given** a portrait photo, **When** the face-tools are opened, **Then** the face is detected on-device and the reshape controls become available.
2. **Given** a detected face, **When** the user adjusts a feature control (e.g., jaw width), **Then** only that feature reshapes, with surrounding areas warping smoothly and no obvious distortion at typical strengths.
3. **Given** a photo with no detectable face, **When** the user opens face tools, **Then** the app clearly indicates no face was found and offers the manual warp tool instead.
4. **Given** a photo with multiple faces, **When** face tools are opened, **Then** the user can select which face to edit.

---

#### User Story 2.2 - Retouch skin naturally (Priority: P1)

The user smooths skin in a way that preserves natural texture (pores/fine detail) rather than flattening it to plastic, and adjusts skin tone/brightness ("whitening") to taste.

**Why this priority**: Natural, texture-preserving skin work is the most praised and most scrutinized beauty feature; getting it right defines the app's quality reputation.

**Independent Test**: Load a portrait, apply skin smoothing and confirm that pores/texture remain visible at full resolution while blemished/uneven areas even out; adjust skin tone and confirm it looks natural.

**Acceptance Scenarios**:

1. **Given** a portrait, **When** the user applies skin smoothing, **Then** uneven areas even out while fine skin texture remains visible when the exported result is viewed at full resolution.
2. **Given** skin smoothing is applied, **When** the user increases its strength, **Then** smoothing increases progressively without an abrupt jump to a flat, artificial look.
3. **Given** a skin-tone adjustment, **When** applied, **Then** it affects skin regions naturally without unnaturally shifting the whole image.

---

#### User Story 2.3 - Targeted eye, teeth, and under-eye enhancements (Priority: P2)

The user brightens eyes (limited to the eye region), whitens teeth (limited to the mouth region), and reduces dark circles/under-eye shadows (limited to the under-eye region), each confined to its target area.

**Why this priority**: These high-impact, small-area enhancements complete a portrait retouch, but depend on the face detection from 2.1.

**Independent Test**: On a portrait, apply each enhancement and confirm the effect is confined to the correct facial region and looks natural.

**Acceptance Scenarios**:

1. **Given** a detected face, **When** the user applies teeth whitening, **Then** only the teeth within the mouth region brighten/whiten, with lips and skin unaffected.
2. **Given** a detected face, **When** the user applies eye brightening, **Then** only the eye region brightens.
3. **Given** a detected face, **When** the user applies under-eye reduction, **Then** shadows beneath the eyes lighten without altering the rest of the face.

---

#### User Story 2.4 - One-tap auto-beautify (Priority: P1)

The user applies a single "auto-beautify" that combines a sensible default set of the Phase 2 face enhancements at fixed, tasteful intensities, producing a good result instantly with the option to fine-tune afterward.

**Why this priority**: A great one-tap result is the fastest delight and the on-ramp for users who don't want to touch individual sliders; it showcases Phase 2 as a whole.

**Independent Test**: On a portrait, tap auto-beautify and confirm a balanced combination of smoothing, brightening, and subtle enhancement is applied at once, and that individual results can still be adjusted or undone.

**Acceptance Scenarios**:

1. **Given** a portrait, **When** the user taps auto-beautify, **Then** a predefined combination of enhancements applies in one action at fixed default strengths.
2. **Given** auto-beautify has been applied, **When** the user opens individual tools, **Then** they can further adjust or undo any part of the result.
3. **Given** a photo with no detectable face, **When** auto-beautify is tapped, **Then** the app indicates it needs a face and does not apply face-specific changes blindly.

---

#### User Story 2.5 - Detect the body and reshape it (Priority: P2)

On a full/partial-body photo, the app detects body pose on-device and offers reshape tools — waist slim, leg lengthen, arm slim/tone, and a posture/height illusion — that adjust proportions while protecting the background from obvious distortion.

**Why this priority**: Body reshape rounds out the "beauty" promise, but is used less universally than face tools and is more technically involved.

**Independent Test**: Load a full-body photo, confirm the body is detected, apply each reshape, and verify the subject reshapes naturally while straight background lines (e.g., horizon, walls) stay acceptably intact.

**Acceptance Scenarios**:

1. **Given** a body photo, **When** body tools are opened, **Then** the body/pose is detected on-device and reshape controls become available.
2. **Given** a detected body, **When** the user slims the waist or lengthens legs, **Then** the subject reshapes smoothly and background distortion is minimized.
3. **Given** a photo without a clearly detectable body, **When** body tools are opened, **Then** the app indicates this and offers the manual warp tool instead.

---

#### User Story 2.6 - Manual push/pull warp with precision (Priority: P2)

The user manually reshapes anything the automatic tools miss — on face or body — with a push/pull (liquify) brush, with adjustable brush size/strength, a freeze/protect brush to lock areas that must not move, a reconstruct/restore option, and an automatic magnifier loupe for precise work.

**Why this priority**: Manual warp is the universal fallback and precision tool that makes every reshape achievable, but it complements rather than replaces the automatic tools.

**Independent Test**: On any photo, push/pull-warp a region, protect an adjacent area and confirm it stays fixed, use the loupe for precision, and reconstruct part of the warp back toward the original.

**Acceptance Scenarios**:

1. **Given** any photo, **When** the user drags with the warp brush, **Then** pixels push/pull along the drag with a smooth falloff.
2. **Given** an area marked with the freeze/protect brush, **When** the user warps nearby, **Then** the protected area stays fixed.
3. **Given** a fingertip on the canvas during warp, **When** the user is working near an edge/detail, **Then** a magnified loupe appears offset from the finger so the worked area is not hidden.
4. **Given** an over-warped area, **When** the user uses reconstruct, **Then** that area eases back toward its original shape.

---

#### User Story 2.7 - Portrait-style background blur (Priority: P2)

The user separates subject from background on-device and applies an adjustable background blur (portrait/depth-of-field look), with control over blur strength and, where offered, the focal subject and bokeh shape.

**Why this priority**: Background blur is a high-impact, widely-loved effect, but it depends on segmentation infrastructure also used by 2.8.

**Independent Test**: On a portrait, apply background blur, adjust strength, and confirm the subject stays sharp with a clean, natural edge while the background blurs.

**Acceptance Scenarios**:

1. **Given** a portrait, **When** the user enables background blur, **Then** the subject is detected on-device and the background blurs while the subject remains sharp.
2. **Given** background blur is on, **When** the user increases strength, **Then** the blur deepens smoothly.
3. **Given** the subject edge (e.g., hair), **When** blur is applied, **Then** the boundary looks acceptably clean without a heavy halo at moderate strengths.

---

#### User Story 2.8 - Remove and replace the background (Priority: P3)

The user cuts out the subject on-device and replaces the background with a solid color or grayscale, with an edge-refinement option for hair-level detail, and can export the cutout with a transparent background.

**Why this priority**: Cutout/replace is powerful and popular but is the most technically demanding segmentation feature and less essential than blur, so it is the last Phase 2 story.

**Independent Test**: On a portrait, remove the background, replace it with a solid color and with grayscale, refine the edge, and export a transparent-background PNG.

**Acceptance Scenarios**:

1. **Given** a portrait, **When** the user removes the background, **Then** the subject is isolated on-device and the background becomes transparent/solid as chosen.
2. **Given** a cutout, **When** the user selects a solid color or grayscale background, **Then** it composites behind the subject.
3. **Given** a rough edge, **When** the user applies edge refinement, **Then** the subject boundary improves, and the result can be exported with transparency preserved (PNG).

---

### PHASE 3 — Creative & Makeup Layer

#### User Story 3.1 - Apply makeup anchored to the face (Priority: P1)

The user applies virtual makeup that follows facial landmarks: lipstick (color, opacity, finish), blush (placement, color, intensity), eyeshadow, eyeliner, and eyebrow tint, each adjustable and removable, staying aligned to the face.

**Why this priority**: Makeup is the headline creative feature of Phase 3 and the primary reason to add a creative layer on top of the beauty tools.

**Independent Test**: On a portrait, apply each makeup type, adjust color/opacity/finish, and confirm the makeup tracks facial features and can be individually removed.

**Acceptance Scenarios**:

1. **Given** a detected face, **When** the user applies lipstick, **Then** color fills the lips accurately following their shape, with adjustable opacity and finish (e.g., matte/gloss).
2. **Given** applied makeup, **When** the user changes a color or intensity, **Then** the change previews live and stays aligned to the corresponding feature.
3. **Given** multiple makeup items, **When** the user removes one, **Then** only that item is removed and the others remain.

---

#### User Story 3.2 - Add text with full Vietnamese support (Priority: P2)

The user adds text overlays that fully support Vietnamese diacritics and tone marks using fonts designed for Vietnamese, with styling (size, color, alignment, outline/shadow, and basic effects) and correct rendering in the exported image.

**Why this priority**: Text is a core creative tool and a place where Vietnamese correctness is highly visible, but it builds on the creative-layer/overlay system.

**Independent Test**: Add Vietnamese text with heavy tone marks, style it, move/resize it, and confirm it renders correctly on screen and in the full-resolution export.

**Acceptance Scenarios**:

1. **Given** the text tool, **When** the user types Vietnamese text with stacked tone marks, **Then** all diacritics render correctly on the canvas using a Vietnamese-capable font.
2. **Given** a text overlay, **When** the user restyles, moves, resizes, or rotates it, **Then** the changes preview live and remain editable.
3. **Given** styled Vietnamese text, **When** the user exports, **Then** the text renders identically and crisply in the full-resolution output.

---

#### User Story 3.3 - Stickers from a growing library (Priority: P2)

The user browses and places stickers from a library, transforms them (move/scale/rotate/opacity), and the library is structured to grow over time with new additions.

**Why this priority**: Stickers are a fun, expressive creative feature; valuable but not as foundational as makeup/text.

**Independent Test**: Place several stickers, transform them, layer them with other content, and confirm they export correctly; confirm the library can be extended with new stickers.

**Acceptance Scenarios**:

1. **Given** the sticker library, **When** the user taps a sticker, **Then** it is placed on the canvas and can be moved, scaled, rotated, and made more/less opaque.
2. **Given** placed stickers, **When** the user exports, **Then** stickers render at full quality in the output.
3. **Given** the library, **When** new stickers are added to it, **Then** they appear for selection without requiring an app rewrite.

---

#### User Story 3.4 - Frames and borders (Priority: P2)

The user adds frames/borders (e.g., colored borders with adjustable width, film-strip, instant-photo styles) around the image.

**Why this priority**: Frames are a quick finishing flourish that complements the aesthetic, layered on the overlay system.

**Independent Test**: Apply different frames/borders, adjust width/color where applicable, and confirm they compose correctly and export at full resolution.

**Acceptance Scenarios**:

1. **Given** a photo, **When** the user selects a border/frame, **Then** it renders around the image and adjusts to the current aspect ratio.
2. **Given** an adjustable border, **When** the user changes its width or color, **Then** the preview updates live.

---

#### User Story 3.5 - Manual clone stamp and heal (Priority: P2)

The user removes objects, blemishes, and repairs texture manually by sampling a source area and painting it onto a target area (clone stamp), and a heal variant that blends the sampled texture into the surrounding tone — with no AI generation involved.

**Why this priority**: Manual retouch is a genuinely useful, fully-offline, zero-cost object/blemish removal tool that respects the project's no-AI-generation constraint.

**Independent Test**: Sample a clean area and paint over an unwanted object/blemish with both clone and heal, and confirm the repair blends acceptably and exports at full resolution.

**Acceptance Scenarios**:

1. **Given** the clone tool, **When** the user sets a source point and paints elsewhere, **Then** the source area's pixels are copied to the painted target following the brush.
2. **Given** the heal tool, **When** the user paints over a blemish after sampling nearby skin, **Then** the sampled texture blends into the surrounding tone for a seamless repair.
3. **Given** a repair, **When** the user exports, **Then** the retouch is present at full resolution.

---

#### User Story 3.6 - Double exposure and blend modes (Priority: P3)

The user combines the photo with another image or overlay using blend modes (e.g., screen, multiply, overlay) and adjustable opacity for double-exposure and creative-blend effects.

**Why this priority**: A distinctive creative effect, but more niche than makeup/text/stickers.

**Independent Test**: Blend a second image over the photo, cycle blend modes and opacity, and confirm the composite previews and exports correctly.

**Acceptance Scenarios**:

1. **Given** a photo, **When** the user adds a second image and selects a blend mode, **Then** the two combine according to that mode with adjustable opacity.
2. **Given** a blended composite, **When** the user exports, **Then** the composite renders at full resolution.

---

#### User Story 3.7 - Collage maker (Priority: P3)

The user combines multiple photos into a layout (grid/collage) with adjustable cells, spacing, and background.

**Why this priority**: A self-contained multi-photo creative mode; valuable but separable from single-photo editing.

**Independent Test**: Create a collage from multiple photos, adjust the layout and spacing, and export the combined result at high resolution.

**Acceptance Scenarios**:

1. **Given** multiple selected photos, **When** the user chooses a layout, **Then** the photos arrange into that layout with adjustable spacing/borders.
2. **Given** a collage, **When** the user repositions or swaps a photo within a cell, **Then** the layout updates, and the final collage exports at high resolution.

---

#### User Story 3.8 - Freehand draw/doodle (Priority: P3)

The user draws freehand on the photo with an adjustable brush (size, color, opacity).

**Why this priority**: A playful, expressive extra; least critical of the creative tools.

**Independent Test**: Draw with different brush sizes/colors/opacities and confirm strokes render smoothly and export at full resolution.

**Acceptance Scenarios**:

1. **Given** the draw tool, **When** the user drags on the canvas, **Then** a smooth stroke follows the finger with the chosen size/color/opacity.
2. **Given** doodles, **When** the user exports, **Then** the strokes render at full resolution.

---

### PHASE 4 — Polish, Localization & Device Verification

#### User Story 4.1 - Verified complete bilingual experience (Priority: P1)

Every user-facing string across the entire app is audited and confirmed present and correct in both English and Vietnamese, with natural (not machine-literal) Vietnamese phrasing.

**Why this priority**: Complete, correct bilingual coverage is a core promise and must be verified across all features once they exist.

**Independent Test**: Walk the entire app in each language and confirm no missing, truncated, or untranslated strings, and that Vietnamese reads naturally.

**Acceptance Scenarios**:

1. **Given** the finished feature set, **When** the app is reviewed in Vietnamese, **Then** there are no untranslated (fallback-English) or placeholder strings anywhere.
2. **Given** the app in either language, **When** any control is viewed, **Then** its label fits its container without clipping in both languages.

---

#### User Story 4.2 - Verified Vietnamese font rendering (Priority: P1)

Vietnamese rendering is specifically verified on tone-mark-heavy characters, both on screen and in exported images, across the app's text surfaces (UI and text-overlay tool).

**Why this priority**: Vietnamese diacritic rendering is a known failure point that must be explicitly proven, especially in exported output.

**Independent Test**: Render a set of tone-mark-heavy Vietnamese strings across UI and exported text overlays and confirm correct, unclipped glyphs everywhere.

**Acceptance Scenarios**:

1. **Given** tone-mark-heavy Vietnamese strings, **When** shown in the UI, **Then** all marks render correctly with adequate vertical spacing and no clipping.
2. **Given** Vietnamese text overlays, **When** exported at full resolution, **Then** the marks render correctly in the output file.

---

#### User Story 4.3 - Verified performance on the target device (Priority: P1)

The app is performance-tested on iPhone 17 Pro Safari (installed PWA), with particular attention to full-resolution export and face/body landmark processing, and stays within the device's memory limits without crashing/reloading.

**Why this priority**: The app targets one specific device/context; performance and stability there are the acceptance bar.

**Independent Test**: On the target device, run full-resolution export of large photos and face/body processing repeatedly and confirm acceptable speed with no memory-driven crashes.

**Acceptance Scenarios**:

1. **Given** a high-resolution photo on the target device, **When** the user exports at full resolution, **Then** it completes in a reasonable time without the app blanking or reloading.
2. **Given** repeated face/body processing on the target device, **When** used across a session, **Then** the app remains responsive and does not crash from memory pressure.

---

#### User Story 4.4 - Verified installability and offline behavior (Priority: P1)

PWA installability and offline behavior are verified end to end on the target device: install, launch offline, edit, export, and update.

**Why this priority**: The promised "installed, offline gift app" experience must be proven end to end as the final gate.

**Independent Test**: Install, go offline, complete a full edit-and-export, then reconnect and confirm updates apply cleanly.

**Acceptance Scenarios**:

1. **Given** the installed app offline, **When** the user completes an import→edit→export flow, **Then** it works fully without network.
2. **Given** a new version, **When** the user relaunches online, **Then** it updates without corrupting an in-progress draft.

---

### Edge Cases

- **Very large photos**: A photo whose dimensions exceed the platform's single-canvas limit must still import, edit (via a downscaled working preview), and export at full original resolution (via tiled processing) without the canvas silently blanking.
- **Memory pressure**: Editing a 48-megapixel photo while loading on-device models must not exceed the device memory budget; the app must degrade gracefully (e.g., preview at working resolution, process full resolution only at export) rather than crash/reload.
- **Interrupted/backgrounded session**: If the app is backgrounded, its rendering context is lost, or storage is reclaimed, the app must recover the edit state (or clearly explain what could not be recovered) on next launch.
- **No face / multiple faces / no body**: Face and body tools must clearly handle the absence of a subject and the presence of multiple subjects, and offer the manual tools as a fallback.
- **Non-portrait photos in beauty tools**: Applying face/body tools to a photo without a suitable subject must fail gracefully, not distort arbitrarily.
- **Unsupported/edge-case imports**: HEIC that cannot be decoded, corrupt images, extremely small images, and extreme aspect ratios must produce a clear message rather than a broken state.
- **Original no longer available for a draft**: When a saved draft references an image that is no longer accessible, the app must communicate this clearly.
- **Share cancelled / share unsupported**: If the user cancels the share sheet, or file sharing is unavailable, the app must fall back to a plain save/download.
- **Vietnamese text overflow**: Longer Vietnamese strings must not clip, overlap, or truncate controls in any screen.
- **Storage full / eviction**: When local storage is full or has been evicted by the platform, the app must handle save failures gracefully and encourage exporting important results.
- **Color fidelity**: Wide-gamut (e.g., Display-P3) source photos must not shift color unexpectedly between the on-screen preview and the exported file.
- **Offline first run**: Behavior when the app has never been online (nothing cached yet) must be clearly communicated.

---

## User Experience & Design Direction *(intent — guides planning; not a rigid implementation spec)*

The client explicitly requested a UI/UX that is outstanding, distinctive, and does **not** read as generic/templated. This section captures the intended design language and signature interactions so the look-and-feel is treated as a first-class requirement.

### Design language — "Darkroom"

- **Mood**: a private, night-time analog darkroom — intimate, hand-made, quietly premium. The photo is the only thing that emits light; all controls recede into shadow. This makes any photo of the recipient look gallery-lit and signals a lovingly, deliberately crafted app rather than a commercial template.
- **Surfaces (layered near-blacks, not flat black)**: a true/near-black *stage* for the photo, with slightly-elevated warm near-black panels/sheets that lift toward light, so UI feels like physical planes over the canvas rather than holes cut into it. Avoid flat pure-black-everywhere (it kills depth).
- **Accent discipline**: a **single** warm "safelight" accent (amber/dim-red family) for active state; everything else monochrome. One accent is the difference between premium and templated.
- **Type**: soft off-white text (never pure white on black); a warm high-contrast display face for "moments"/headers and a clean, highly legible face for controls; ledger-style numerals for value read-outs. All typefaces MUST have verified full Vietnamese diacritic coverage.
- **Chrome**: dimmed, blurred, translucent tool surfaces over the image; no heavy borders/dividers/gradients on chrome. (Note: true iOS-26 "liquid glass" refraction is not available in Safari; approximate with blur + hand-painted specular edges, and keep blur inexpensive.)

### Signature interactions

- **Whole-photo gesture editing (Snapseed-style)**: once a tool is selected, horizontal drag on the image changes the value and vertical drag switches which parameter is being adjusted, with a large value read-out — so a slider never covers the subject's face and editing is one-handed.
- **Press-and-hold to reveal the original** ("peek at the negative"), in addition to the draggable before/after slider.
- **Precision loupe**: during retouch/reshape, a magnified bubble appears offset from the fingertip so the worked pixels are never hidden.
- **Two-tap intensity**: tap a filter/look to apply, tap again to reveal its strength control; pairs with the saved-recipe system.
- **Bottom-sheet tool tray** with a drag handle and peek/half/full detents; the primary action sits centered at the bottom edge.
- **"Developing" export reveal**: on export/save, the result resolves from dim safelight into full color like a print developing — one restrained, satisfying flourish (not confetti spray).

### Motion & feedback

- **Spring physics, restrained**: default to smooth/critically-damped motion (no bounce); use a subtle "snappy" spring (small overshoot) as the workhorse for tool/sheet transitions; reserve visible bounce for rare celebratory moments. Motion must honor gesture velocity (a fling continues at its release speed) and remain interruptible/redirectable.
- **120Hz-safe**: animate only compositor-friendly properties; keep value-scrubbing at full frame rate by decoupling the control's motion from the (throttled/downscaled) image recompute; derive motion from elapsed time, not per-frame steps, so it behaves identically at 60Hz and 120Hz.
- **Haptics (platform reality)**: on the target iOS version, a PWA can produce a single system "tick" only from a genuine finger tap on an (invisibly overlaid) native switch; script-driven and mid-drag detent haptics are not available. Therefore: put the one real haptic on discrete taps (apply, reset, tool-select, export press) and **simulate** slider detents/snaps with motion + a short, low-volume tick sound + a small value-label nudge. (On non-iOS platforms, use the vibration capability where present.)
- **Respect reduced-motion and provide a sound on/off control.**

### One-handed ergonomics & safe areas

- All actionable controls live in the thumb-reachable bottom third; the top is display-only. Touch targets are comfortably large with adequate spacing.
- Respect device safe areas (Dynamic Island at top, home indicator at bottom); size the canvas with dynamic viewport units; avoid the system's bottom/top edge-gesture zones; suppress pull-to-refresh and text-selection for an app-like feel.

### Gift-personal delight (tasteful, not cheesy)

- **Bilingual voice with personality**: warm, second-person, affectionate register in both languages (natural Vietnamese endearment register, not machine-literal). Copy reads as written for one specific person.
- **Cinematic first-open** personalized to the recipient (a brief, warm moment leading straight into her first photo) rather than a feature-tour carousel.
- **Hidden love-letter details**: e.g., a long-press on the logo reveals a private note; a date-triggered (anniversary/birthday) accent shift and dedication; a secret filter/inside-joke unlock. These are optional, tasteful, and clearly separable from core functionality.
- **Delightful empty and loading states**: a warm invitation in his voice (bilingual) instead of a blank "no photos yet"; content-shaped skeletons instead of spinners.

### Bilingual layout rules

- Vietnamese text runs roughly 20–30% longer than English — size containers to the longer language, allow wrapping, and never use fixed-width labels.
- Give text generous line-height so stacked tone marks are never clipped; avoid clipping ascenders/marks with tight overflow rules.
- Normalize text to a consistent composed form before rendering to canvas so precomposed Vietnamese glyphs are used; tag each string with its language for correct assistive-technology pronunciation.

---

## Requirements *(mandatory)*

### Functional Requirements — Global / Cross-cutting

- **FR-001**: All image processing (import/decode, adjustments, filters, detection, segmentation, reshape, retouch, compositing, and export) MUST run entirely on the user's device with no server-side processing and no paid or external image/AI services (zero ongoing cost).
- **FR-002**: The app MUST keep editing non-destructive: the original imported image is preserved unmodified, and edits are represented as an editable state applied on top, until the user explicitly exports.
- **FR-003**: Users MUST be able to recover the original image and re-open/modify prior edit steps before export.
- **FR-004**: The app MUST provide a visible, easily-found language toggle in the main interface that switches the entire UI between English and Vietnamese, and MUST persist the chosen language.
- **FR-005**: All user-facing text MUST be available in both English and Vietnamese; no hard-coded single-language strings in the interface.
- **FR-006**: Vietnamese text MUST render with correct, complete diacritics and stacked tone marks everywhere it appears, including exported images.
- **FR-007**: The app MUST be installable to the iOS home screen and launch as a standalone app, including in-app guidance for the manual iOS install step.
- **FR-008**: The app's editing shell and core editing/export MUST function with no network connection after installation.
- **FR-009**: The app MUST operate within the target device's memory constraints while handling large photos and on-device models, degrading gracefully (e.g., working-resolution preview) rather than crashing or reloading.
- **FR-010**: No image data or edit content may leave the device; the app MUST be fully usable offline (verifiable in airplane mode).
- **FR-011**: The interface MUST be designed for one-handed touch use, respecting device safe areas, with primary controls in the thumb-reachable zone and adequately-sized touch targets.
- **FR-012**: The app MUST honor reduced-motion preferences and MUST provide a control to disable interface sounds.

### Functional Requirements — Phase 1

- **FR-101**: Users MUST be able to import a photo from their device library and by taking a new photo, where capture uses the device's native camera handoff (system file/camera input), not an in-app live camera view.
- **FR-102**: The app MUST handle HEIC/HEIF photos, converting them on-device for display and editing when the platform cannot use them directly.
- **FR-103**: Users MUST be able to crop (freeform and preset ratios), rotate in 90° steps, finely straighten, and apply perspective correction, with alignment guides available.
- **FR-104**: The app MUST provide global light/color adjustments including at least: brightness, contrast, exposure, highlights, shadows, whites, blacks, saturation, vibrance, temperature (warmth), tint, and sharpness, each previewing in real time.
- **FR-105**: The app MUST provide a per-channel and luminance tone-curves tool.
- **FR-106**: The app MUST provide selective color / color-mixer control of individual color bands (hue/saturation/luminance), shadow–midtone–highlight color grading, and split toning.
- **FR-107**: The app MUST provide a white-balance control including a neutral-picker (eyedropper).
- **FR-108**: The app MUST provide a vignette control.
- **FR-109**: The app MUST provide a filter/look library, organized into categories, including film-stock-style presets, each with an adjustable intensity from none to full.
- **FR-110**: The app MUST provide creative finishing effects including at least film grain, clarity/texture, dehaze, fade/matte, and highlight bloom/glow.
- **FR-111**: Users MUST be able to save the current combination of adjustments and filter as a named, reusable preset ("recipe"), and manage (rename, reorder, delete) presets.
- **FR-112**: Users MUST be able to export a preset as a shareable code and import a preset from such a code.
- **FR-113**: The app MUST provide export aspect-ratio presets for common social formats — at least Instagram 1:1 and 4:5, vertical 9:16 (Stories/Reels/TikTok), a Facebook-appropriate ratio, and freeform.
- **FR-114**: Users MUST be able to compare the edited image against the original via both a draggable before/after divider and a press-and-hold reveal.
- **FR-115**: The app MUST provide undo/redo across the editing session and allow re-opening/adjusting prior edit steps.
- **FR-116**: The app MUST export the result at the full original pixel resolution of the source photo, with no downscaling, including for photos that exceed the platform's single-canvas size limit (via tiled processing).
- **FR-117**: Users MUST be able to choose the export format between PNG (lossless) and JPEG (with a high-quality default), and the export MUST avoid unnecessary additional compression beyond the chosen setting.
- **FR-118**: Users MUST be able to share the exported image via the device's native share sheet, with a plain save/download fallback when sharing is unavailable or cancelled.
- **FR-119**: The app MUST automatically save the in-progress edit state (not a copy of the image pixels) to local device storage and restore it after the app is closed, reloaded, or reclaimed.
- **FR-120**: On-screen preview and the exported file MUST be color-consistent (no unexpected color shift), including for wide-gamut source photos.

### Functional Requirements — Phase 2

- **FR-201**: The app MUST detect a face on-device and provide reshape controls for at least: jaw, chin, cheek width, forehead width, nose bridge and tip size, lip shape and fullness, eyebrow shape and position, eye size, and eye spacing.
- **FR-202**: Reshape MUST produce smooth, natural results at typical strengths and confine each control's effect to its intended feature.
- **FR-203**: The app MUST support selecting among multiple detected faces and MUST clearly handle the case of no detected face (offering manual tools).
- **FR-204**: The app MUST provide skin smoothing that preserves natural skin texture (does not flatten to a plastic look) with adjustable strength.
- **FR-205**: The app MUST provide skin tone/brightness ("whitening") adjustment confined to skin regions.
- **FR-206**: The app MUST provide teeth whitening confined to the mouth region, eye brightening confined to the eye region, and dark-circle/under-eye reduction confined to the under-eye region.
- **FR-207**: The app MUST provide a one-tap auto-beautify that applies a sensible default combination of face enhancements at fixed intensities, remaining individually adjustable/undoable afterward.
- **FR-208**: The app MUST detect body pose on-device and provide reshape tools for at least: waist slim, leg lengthen, arm slim/tone, and a posture/height illusion, while minimizing background distortion.
- **FR-209**: The app MUST provide a manual push/pull (liquify) warp brush usable on both face and body, with adjustable size/strength, a freeze/protect brush, a reconstruct option, and an automatic precision magnifier loupe.
- **FR-210**: The app MUST provide adjustable-strength background blur using on-device subject segmentation, keeping the subject sharp with an acceptably clean edge.
- **FR-211**: The app MUST provide background removal and replacement with a solid color or grayscale, with an edge-refinement option, and MUST support exporting a transparent-background result.

### Functional Requirements — Phase 3

- **FR-301**: The app MUST provide makeup overlays anchored to facial landmarks for at least: lipstick (color, opacity, finish), blush (placement, color, intensity), eyeshadow, eyeliner, and eyebrow tint, each independently adjustable and removable.
- **FR-302**: The app MUST provide a text-overlay tool that fully supports Vietnamese diacritics/tone marks using Vietnamese-capable fonts, with styling (size, color, alignment, outline/shadow at minimum) and correct full-resolution export.
- **FR-303**: The app MUST provide a sticker system with a library that can grow over time, where placed stickers can be moved, scaled, rotated, and set to partial opacity.
- **FR-304**: The app MUST provide frames/borders, including at least adjustable-width color borders and a film-strip/instant-photo style.
- **FR-305**: The app MUST provide manual clone-stamp and heal tools (user samples a source area and paints onto a target) for object/blemish removal and texture repair, with no AI generation.
- **FR-306**: The app MUST provide double-exposure/blend effects with selectable blend modes and adjustable opacity.
- **FR-307**: The app MUST provide a collage maker to combine multiple photos into an adjustable layout, exportable at high resolution.
- **FR-308**: The app MUST provide a freehand draw/doodle brush with adjustable size, color, and opacity.
- **FR-309**: All Phase 3 creative content (makeup, text, stickers, frames, blends, collage, doodles, retouch) MUST render into the final export at full resolution.

### Functional Requirements — Phase 4

- **FR-401**: Every user-facing string across all delivered features MUST be verified present and correct in both English and Vietnamese, with natural Vietnamese phrasing and no clipped/overflowing labels in either language.
- **FR-402**: Vietnamese rendering MUST be verified specifically on tone-mark-heavy characters, on screen and in exported images, across UI and the text-overlay tool.
- **FR-403**: The app MUST be verified on iPhone 17 Pro Safari (installed PWA) for acceptable performance of full-resolution export and face/body processing, with no memory-driven crashes/reloads across a normal session.
- **FR-404**: PWA installability and offline behavior MUST be verified end to end on the target device (install, offline edit/export, and clean update without corrupting a draft).

### Key Entities

- **Photo Project (Document)**: the working unit for one photo; references the immutable original image and holds the current editable edit state plus metadata (dimensions, orientation, color space).
- **Original Image**: the immutable source pixels and metadata; never mutated by editing.
- **Edit State (Edit Stack)**: the ordered, re-editable set of non-destructive operations (adjustments, filters, reshape, retouch, overlays) with their parameters; the sole source of truth for rendering.
- **Operation / Adjustment**: a single non-destructive edit with a type, parameters, and optional target region/mask.
- **Layer**: overlay content placed on the photo (makeup, text, sticker, frame, second image, doodle) with transform, opacity, blend mode, and optional facial-landmark anchor.
- **Preset (Recipe)**: a saved, named bundle of operations reusable across photos and expressible as a shareable code.
- **Draft**: a persisted serialization of a Project's edit state (not the image pixels) in local device storage, used for session recovery.
- **Asset Library**: the growable local collections of reusable assets (stickers, filters/looks, frames).
- **Detected Landmark Set**: on-device-detected face or body points for a photo, used to anchor reshape, targeted enhancements, and makeup.
- **Locale**: the active language (English or Vietnamese) driving all interface text.
- **Export Job**: a request to render the current Project to a file at full original resolution with a chosen format, quality, and aspect/size.

---

## Success Criteria *(mandatory)*

### Quality & fidelity

- **SC-001**: Photos up to 48 megapixels can be imported, edited, and exported at their full original pixel dimensions with zero downscaling.
- **SC-002**: Exported images show no visible additional compression beyond the user's chosen setting; a truly lossless option (PNG) is available and JPEG defaults to high quality.
- **SC-003**: On-screen preview and exported file match in color and content (the export reflects exactly what the user sees), including for wide-gamut source photos.
- **SC-004**: Skin smoothing at moderate strength preserves visible skin texture (pores/fine detail) in the full-resolution export rather than producing a flat, plastic result.
- **SC-005**: Face and body reshape at typical strengths produce results with no obvious warping artifacts on the subject or the background.

### Localization

- **SC-006**: 100% of user-facing text is available in both English and Vietnamese, and switching languages updates all visible text without disrupting an in-progress edit.
- **SC-007**: All Vietnamese text, including stacked tone marks (e.g., ế, ộ, ữ, ẫ, ợ, ỳ), renders correctly with no missing glyphs or clipped marks — on screen and in exported images.
- **SC-008**: No interface label is clipped, truncated, or overlapping in either language on the target device.

### Performance & reliability (on the target device)

- **SC-009**: Core adjustment and filter controls update the preview at an interactive frame rate (perceived real-time) while scrubbing.
- **SC-010**: One-tap auto-beautify (including face detection) produces its result within about 3 seconds for a typical portrait.
- **SC-011**: Full-resolution export of a large (e.g., ~48-megapixel) photo completes without the canvas blanking, and without the app crashing or reloading.
- **SC-012**: The app does not crash or reload due to memory pressure across a normal editing session, including editing large photos and running face/body/segmentation processing.
- **SC-013**: The installed app's editing shell loads and a full import→edit→export flow completes with no network connection.

### Cost, privacy & non-destructiveness

- **SC-014**: 100% of processing runs on-device with zero calls to paid or external services (zero ongoing operational cost).
- **SC-015**: No image or edit data leaves the device — verifiable by performing a complete edit-and-export in airplane mode.
- **SC-016**: The original image is always recoverable, and any prior edit step can be reopened and changed before export.
- **SC-017**: An interrupted edit (app closed/reloaded/reclaimed) is restorable from a locally-saved draft on next launch.

### Experience

- **SC-018**: A first-time user can import a photo, apply at least one adjustment, and export or share a result in under 2 minutes.
- **SC-019**: The interface is fully operable one-handed within the thumb-reachable zone, respecting device safe areas.
- **SC-020**: All core editing actions are reachable and the app remains usable without any onboarding for someone familiar with mobile photo editors.

---

## Assumptions

- **Recipient & scale**: The app is a personal, non-commercial gift for a single primary user, with a single primary target device (iPhone 17 Pro, iOS Safari, installed PWA). It is not a multi-user or commercial product; there are no accounts, cloud sync, or backends.
- **Ambiguity resolution**: Where the brief left details open, reasonable modern photo-editor defaults were chosen and documented here rather than blocking on questions.
- **Full-resolution export strategy**: Because a 48-megapixel photo exceeds the platform's single-canvas pixel limit, full-resolution export is assumed to be implemented by processing in tiles and encoding the stitched result, rather than allocating one canvas at full size. Interactive editing operates on a downscaled working preview; the full-resolution render is produced at export time.
- **On-device models**: Face landmarks, body/pose landmarks, and subject segmentation are assumed to use free, on-device models. Background-removal/matting quality is assumed to use the best free option compatible with the project's open-source, non-commercial nature; the highest-quality free matting models carry copyleft (e.g., AGPL/GPL) or non-commercial terms — copyleft is treated as acceptable for this open, non-commercial gift, and non-commercial-only model weights that forbid this use are avoided (see Dependencies).
- **Threading/hosting**: Achieving good on-device performance for models may require serving the app with cross-origin isolation enabled; the deployment target is assumed to permit the necessary response headers (or an equivalent service-worker approach), not a host that forbids them.
- **Color management**: To guarantee preview/export consistency, the editing pipeline is assumed to operate in a single, consistently-declared color space end to end, converting source photos into it on import.
- **Camera capture**: Photo capture uses the native system camera handoff (file input with capture) because live in-browser camera capture is unreliable in an installed iOS PWA; this matches the project's stated constraint.
- **Draft persistence**: Drafts store edit state only (not image pixels) and re-link to the original image on the device; platform storage may be evicted after prolonged non-use, so exporting is presented as the durable way to keep a result.
- **"No compacting" interpretation**: "Highest export quality, no compacting" is interpreted as: never downscale, offer a lossless format, default lossy export to high quality, and preserve color — not as a guarantee of literally zero bytes of compression when the user selects JPEG.
- **AI features**: Features that would require paid or generative AI services are treated as out of scope (see Out of Scope), and equivalent value is delivered through free, on-device, manual, or landmark/segmentation-based approaches instead.

## Dependencies, Constraints & Feasibility Notes

*(Researched candidate approaches to inform planning. These are defaults/constraints, not prescribed implementations; the planning phase selects specifics.)*

- **Face landmarks**: A free, permissively-licensed on-device dense face-mesh model is available and suitable; on the target platform its CPU/compatibility path should be preferred over the platform-buggy GPU path.
- **Body/pose landmarks**: A free, permissively-licensed on-device pose model is available and suitable for body reshape.
- **Subject segmentation / matting**: Free options exist across a quality spectrum; the highest-quality free matting carries copyleft/non-commercial licensing. A permissive baseline (lower edge quality) and a copyleft higher-quality option are both viable; truly-restricted (non-commercial-forbidden-for-this-use) weights must be avoided. This licensing/quality tradeoff is the single most consequential planning decision in Phase 2.
- **HEIC**: The target platform can often decode HEIC natively; a free fallback decoder covers other cases.
- **GPU image processing / warp / skin**: Real-time adjustments, filters, liquify, and texture-preserving skin work are achievable with free GPU (shader-based) techniques; a broad-compatibility GPU path plus a newer-API path is assumed.
- **Full-resolution encoding**: A free on-device encoder (rather than the platform's lossy canvas export) is assumed for best-quality, size-unbounded export.
- **Fonts**: Interface and text-overlay fonts must have verified full Vietnamese diacritic coverage and be bundled for offline use; several otherwise-attractive display fonts drop or mangle stacked marks and must be screened out.
- **Platform hazards to design around** (target = iOS Safari installed PWA): silent canvas blanking above the single-canvas pixel limit (×device pixel ratio); an app-terminating memory ceiling far below total device RAM; loss of the GPU rendering context on backgrounding/lock (state must be rebuildable); a low limit on concurrent GPU contexts (share one); local-storage eviction after ~7 days of non-use; native share dropping the file if combined with text/URL in one call; untagged canvas export causing wide-gamut color shift; and the current-iOS haptics reality (a single tap-tick only; no script-driven or mid-drag detent haptics).
- **Constitution alignment**: All of the above must satisfy the project constitution — zero ongoing cost, free/open-source, fully client-side, non-destructive, TypeScript, modular, and bilingual.

## Out of Scope

The following were considered (several are signature features of comparable apps) but are **excluded**, primarily because they require paid or generative-AI services and would violate the project's zero-cost / no-AI-generation and client-side principles, or because they are outside the intended single-user gift scope. They are recorded so their exclusion is a deliberate, documented decision:

- **Generative AI editing**: generative object removal/"magic eraser" that reconstructs background by generation, generative expand/outpainting/uncrop, prompt-based background or scene generation, AI headshot/portrait generation, and natural-language "describe the edit" agents. (Manual clone/heal and segmentation-based cutout are provided instead.)
- **AI sky replacement via generation** and other generated-content overlays. (Segmentation-plus-supplied-image compositing could be revisited later as a free alternative, but is out of scope for now.)
- **Photo animation / motion / "bring photo to life"** and any video generation or video export.
- **Cloud accounts, cross-device sync, cloud backup, and any community/publishing feed** (all imply servers/cost).
- **Live in-browser camera with real-time preview filters** (unreliable in an installed iOS PWA; native capture handoff is used instead).
- **RAW capture/decode and batch/multi-photo pipeline editing** (beyond the collage maker) are out of scope for this version.
- **On-device AI upscaling, colorization, and old-photo restoration** are out of scope for this version (heavy models; can be revisited if a suitably light, free, on-device option is confirmed).
