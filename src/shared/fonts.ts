/**
 * Verified-Vietnamese font registry (FR-302, T092). The app self-hosts exactly
 * two families via next/font — Be Vietnam Pro (purpose-built for Vietnamese
 * diacritics) and Noto Sans (full Vietnamese coverage) — both offline-safe.
 * Text overlays may only use fonts from this list, guaranteeing tone-mark-heavy
 * strings (ế ộ ữ ẫ ợ) render with correct, unclipped glyphs on screen and in
 * the full-resolution export.
 */
export interface VietFont {
  id: string;
  /** Display label (not localized — proper nouns). */
  label: string;
  family: string;
  weight: number;
}

export const VIET_FONTS: VietFont[] = [
  { id: 'beVietnamBold', label: 'Be Vietnam · Bold', family: 'Be Vietnam Pro', weight: 700 },
  { id: 'beVietnam', label: 'Be Vietnam', family: 'Be Vietnam Pro', weight: 500 },
  { id: 'noto', label: 'Noto Sans', family: 'Noto Sans', weight: 500 },
];

export function fontById(id: string): VietFont {
  return VIET_FONTS.find((f) => f.id === id) ?? VIET_FONTS[0];
}

/** A CSS `font` shorthand for canvas/DOM at a given pixel size. */
export function fontCss(id: string, px: number): string {
  const f = fontById(id);
  return `${f.weight} ${px}px '${f.family}', 'Noto Sans', system-ui, sans-serif`;
}

/**
 * Ensure the registered families are loaded before a synchronous canvas
 * rasterization (export). Resolves even if the Font Loading API is unavailable.
 */
export async function ensureFontsLoaded(): Promise<void> {
  const fonts = (globalThis as { document?: { fonts?: FontFaceSet } }).document?.fonts;
  if (!fonts) return;
  try {
    await Promise.all(
      VIET_FONTS.map((f) => fonts.load(`${f.weight} 64px '${f.family}'`).catch(() => undefined)),
    );
    await fonts.ready;
  } catch {
    /* best-effort — a missing family falls back to Noto Sans / system UI. */
  }
}
