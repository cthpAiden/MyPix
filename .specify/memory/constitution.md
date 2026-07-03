<!--
SYNC IMPACT REPORT
==================
Version change: (template, unversioned) → 1.0.0
Bump rationale: Initial ratification of a concrete constitution from the
  unfilled template. MAJOR baseline (1.0.0) per semantic-versioning for a
  first adopted governance document.

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Zero Ongoing Cost
  - [PRINCIPLE_2_NAME] → II. Client-Side Processing with Free/Open-Source Tools
  - [PRINCIPLE_3_NAME] → III. Safari PWA Target Fidelity
  - [PRINCIPLE_4_NAME] → IV. Full Bilingual Support (English + Vietnamese)
  - [PRINCIPLE_5_NAME] → V. Modular Separation of Concerns
  - (new)             → VI. Non-Destructive Editing
  - (new)             → VII. TypeScript Throughout

Added sections:
  - Additional Constraints & Technology Standards (was [SECTION_2_NAME])
  - Development Workflow & Quality Gates (was [SECTION_3_NAME])

Removed sections: none

Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check gate is generic;
     no edit required (references "constitution file" abstractly).
  ✅ .specify/templates/spec-template.md — reviewed; no principle-driven
     mandatory sections to add.
  ✅ .specify/templates/tasks-template.md — reviewed; task categories already
     accommodate the principle-driven task types (i18n, performance, modules).
  ✅ .specify/templates/checklist-template.md — reviewed; no changes required.

Follow-up TODOs: none. RATIFICATION_DATE set to today (project founding).
-->

# MyPix Constitution

MyPix is a beauty and photo-editing Progressive Web App (PWA), built as a
personal gift rather than a commercial product. These principles are
non-negotiable and govern every feature, plan, and task.

## Core Principles

### I. Zero Ongoing Cost

The project MUST incur no recurring operational cost. The following are
prohibited: paid APIs of any kind, AI image-generation APIs, and any
server-side image processing that bills per request, per compute, or per
storage. Any dependency, service, or hosting choice that introduces a
metered or subscription cost MUST be rejected in favor of a free
alternative. Rationale: this is a gift with no revenue and no budget; a
feature that cannot be delivered at zero ongoing cost is out of scope.

### II. Client-Side Processing with Free/Open-Source Tools

All image processing — face detection, body detection, background
segmentation, filters, retouching, makeup, and creative effects — MUST run
client-side in the browser. Only free, open-source libraries are permitted
(e.g., MediaPipe, Fabric.js, and native canvas/WebGL). No image pixels may
be sent to a server for processing. Rationale: keeping computation on-device
preserves the zero-cost guarantee (Principle I), protects the privacy of
personal photos, and keeps the app functional without a backend.

### III. Safari PWA Target Fidelity

The primary target is an iPhone 17 Pro running Safari, installed as a
home-screen PWA. Features MUST be validated against Safari's PWA constraints
specifically — not just desktop Chrome. Camera capture MUST use a file input
with the `capture` attribute; reliance on `getUserMedia` for capture is
prohibited because it is unreliable inside an installed iOS PWA. Performance
and memory behavior MUST be evaluated on this target. Rationale: an editor
that works elsewhere but degrades or breaks on the one device it is made for
has failed its purpose.

### IV. Full Bilingual Support (English + Vietnamese)

The app MUST fully support English and Vietnamese with a visible language
toggle. Every user-facing string MUST be available in both languages; no
hardcoded single-language text in components. All Vietnamese text MUST render
correctly with complete diacritics and tone marks. Rationale: both languages
are first-class for the intended recipient; partial or broken Vietnamese
rendering makes the app unusable for half its audience.

### V. Modular Separation of Concerns

The codebase MUST be organized into clear, well-separated modules. Face
editing, body editing, background tools, makeup, filters, creative tools, and
export are each their own concern and MUST NOT be entangled. A module MUST NOT
reach into another module's internals; shared logic belongs in a clearly named
shared/common layer. Rationale: the project is large in scope, and strong
module boundaries keep each editing domain independently understandable,
testable, and changeable.

### VI. Non-Destructive Editing

Editing MUST be non-destructive wherever feasible. The original image and a
separate editable state MUST be preserved; pixels MUST NOT be mutated
permanently until the user explicitly exports. Rationale: users expect to undo,
compare against the original, and adjust earlier steps; destroying source data
mid-edit forfeits that and risks unrecoverable loss of the original photo.

### VII. TypeScript Throughout

All application code MUST be written in TypeScript. Plain untyped JavaScript
files and `any`-as-escape-hatch usage that defeats type safety MUST be avoided.
Rationale: given the project's size and many interacting modules (Principle V),
static types catch integration errors early and keep the code navigable.

## Additional Constraints & Technology Standards

- **No backend for processing.** Static hosting is acceptable; a server that
  performs paid or image-processing work is not (Principles I, II).
- **Approved processing stack:** MediaPipe (detection/segmentation), Fabric.js
  (canvas object model), and native Canvas 2D / WebGL. New libraries MUST be
  free, open-source, and browser-runnable before adoption.
- **PWA requirements:** a valid web app manifest and service worker enabling
  home-screen installation and offline shell loading, verified on iOS Safari.
- **Internationalization:** a single source of truth for translation strings
  keyed by locale, covering `en` and `vi`, wired to the visible language
  toggle.
- **State model:** original image data and editable edit-state are stored
  separately; export is the only step permitted to flatten to final pixels.

## Development Workflow & Quality Gates

- **Constitution Check first.** Every plan MUST pass a Constitution Check gate
  before design and re-check after design. Violations MUST be recorded with
  justification in the plan's Complexity Tracking table, or the approach
  revised.
- **Cost gate:** any new dependency or service MUST be confirmed zero-ongoing-
  cost and free/open-source before it is added.
- **Target-device verification:** features touching capture, performance, or
  layout MUST be checked against iOS Safari PWA behavior, not only desktop.
- **Bilingual gate:** no feature that adds user-facing text ships without both
  English and Vietnamese strings, with Vietnamese diacritics verified.
- **Module boundary review:** changes MUST respect module separation; cross-
  module coupling MUST be called out and justified in review.

## Governance

This constitution supersedes other conventions where they conflict. Amendments
MUST be proposed with a clear rationale, applied to this document, and
version-bumped per the policy below; dependent templates MUST be checked for
consistency in the same change.

Versioning policy (semantic):
- **MAJOR** — backward-incompatible governance changes or removal/redefinition
  of a principle.
- **MINOR** — a new principle or section, or materially expanded guidance.
- **PATCH** — clarifications, wording, and non-semantic refinements.

Compliance expectations: all plans, specs, and tasks MUST be reviewable against
these principles, and any complexity that departs from them MUST be justified
rather than assumed. Use `CLAUDE.md` for day-to-day runtime development
guidance that complements — but does not override — this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-04
