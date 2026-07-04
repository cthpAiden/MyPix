# Device Matrix — Vietnamese Font Rendering (T092, US4.2)

**Target**: iPhone 17 Pro, Safari, **installed** PWA (Add to Home Screen).
**Covers**: FR-302, FR-402, SC-007 (stacked tone marks render, no missing/clipped glyphs — on screen **and** in exported images), SC-008 (no clipped labels).

The goal is to confirm that tone-mark-heavy Vietnamese renders correctly everywhere text appears, and to **screen out** any overlay font that clips or drops marks. Both offered overlay families live in [`src/shared/fonts.ts`](../../src/shared/fonts.ts) (`VIET_FONTS`), re-exported by [`src/modules/text/fonts.ts`](../../src/modules/text/fonts.ts). A family that fails any row below must be removed from `VIET_FONTS`.

## Test strings

Each string stacks a base vowel + circumflex/breve/horn **and** a tone mark — the case most likely to clip vertically or drop a glyph.

| ID | String | Stresses |
|----|--------|----------|
| S1 | `Chào bạn! Điện Biên Phủ` | à, ạ, Đ, ệ, ủ |
| S2 | `Nghệ thuật nhiếp ảnh` | ệ, ế, ả |
| S3 | `Tự động làm đẹp khuôn mặt` | ự, ộ, à, đ, ẹ, ặ |
| S4 | `Ừ, giữ nút chia sẻ` | Ừ, ữ, ẻ |
| S5 | `Rực rỡ · Mềm mại · Ngọt ngào` | ự, ỡ, ề, ạ, ọ, à |
| S6 | `Ế Ộ Ữ Ẫ Ợ Ỳ Ặ Ậ` (caps — tightest ascenders) | every stacked-mark uppercase |
| S7 | `Đảo ngược · Xoá phông · Độ nét` | ả, ượ, á, ộ, é |

## Font families under test

| Font id | Family | Weight |
|---------|--------|--------|
| `beVietnamBold` | Be Vietnam Pro | 700 |
| `beVietnam` | Be Vietnam Pro | 500 |
| `noto` | Noto Sans | 500 |

## Procedure & pass criteria

For each surface, set the app language to **VI** and inspect at 100% (and pinch-zoom the export). **PASS** = every tone mark is present, correctly positioned above/below its base, and not clipped by the line box, a container edge, or `overflow: hidden`.

### A. UI chrome (single system font — Be Vietnam Pro via `next/font`)

| Surface | Strings | Result | Notes |
|---------|---------|--------|-------|
| Home screen (title, CTAs, hint) | native VI copy | ⬜ | |
| Toolbar labels (scroll strip) | S7-like tool names | ⬜ | longest: "Cân bằng trắng" |
| Tool panels (sliders, segmented controls) | native VI copy | ⬜ | segmented labels **wrap**, must not clip |
| Export sheet (format, quality, status) | native VI copy | ⬜ | |
| Resume card, install guide, errors | native VI copy | ⬜ | |

### B. Text-overlay tool — **on screen** (each font id × each string)

| Font id | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|---------|----|----|----|----|----|----|----|
| `beVietnamBold` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| `beVietnam` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| `noto` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

Also verify: outline and shadow styling do not swallow the marks; NFC normalization keeps precomposed and decomposed input identical.

### C. Text-overlay tool — **in the full-resolution export** (the SC-007 crux)

Add each string as an overlay, export **PNG** and **JPEG** at 48 MP, open the file, zoom to 100%+.

| Font id | S1 | S3 | S4 | S6 | S7 | PNG | JPEG |
|---------|----|----|----|----|----|-----|------|
| `beVietnamBold` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| `beVietnam` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| `noto` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

Export rasterization must await `ensureFontsLoaded()` ([`src/shared/fonts.ts`](../../src/shared/fonts.ts)) so the family is present before the synchronous canvas draw — otherwise the export silently falls back to a system font. Confirm the exported glyphs match the on-screen family.

## Screening outcome

- [ ] All families pass A/B/C → keep `VIET_FONTS` unchanged.
- [ ] A family drops/clips a mark on screen or in export → **remove it from `VIET_FONTS`** and re-run; record which string(s) failed below.

**Recorded result (fill on device):** _date / iOS version / outcome_

> Expected outcome: both Be Vietnam Pro and Noto Sans are purpose-built for full Vietnamese coverage and are expected to pass; no removal anticipated. This matrix exists to prove it on the target device and to gate any future font addition.
