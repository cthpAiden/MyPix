/**
 * The text tool's font policy (US3.2, FR-302): only verified-Vietnamese fonts
 * are offered, so tone-mark-heavy strings always render with correct, unclipped
 * glyphs on screen and in the full-resolution export. The registry itself lives
 * in shared/ (the engine compositor needs it too); this re-export is the text
 * module's single source for which fonts it may use.
 *
 * Screening (T092, SC-007): every family in `VIET_FONTS` is verified against the
 * tone-mark matrix in `tests/device/vietnamese-fonts.md`. Both offered families
 * (Be Vietnam Pro, Noto Sans) passed on screen and in export — none required
 * removal. Any family that fails that matrix must be dropped from the registry
 * so an offending overlay font can never be selected.
 */
export { VIET_FONTS, fontById, fontCss, type VietFont } from '@/shared/fonts';
