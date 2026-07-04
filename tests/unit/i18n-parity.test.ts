import { describe, expect, it } from 'vitest';
import en from '@/i18n/messages/en.json';
import vi from '@/i18n/messages/vi.json';

type Json = { [k: string]: string | Json };

function flatten(obj: Json, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const flatEn = flatten(en as Json);
const flatVi = flatten(vi as Json);

describe('i18n catalog parity (contracts/i18n.md rule 2)', () => {
  it('en and vi have identical key sets', () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatVi).sort());
  });

  it('no value is empty', () => {
    for (const [k, v] of Object.entries(flatEn)) expect(v.trim(), `en ${k}`).not.toBe('');
    for (const [k, v] of Object.entries(flatVi)) expect(v.trim(), `vi ${k}`).not.toBe('');
  });

  it('no value equals its own key path', () => {
    for (const [k, v] of Object.entries(flatEn)) expect(v, `en ${k}`).not.toBe(k);
    for (const [k, v] of Object.entries(flatVi)) expect(v, `vi ${k}`).not.toBe(k);
  });

  it('ICU placeholders match across locales', () => {
    const placeholders = (s: string) => (s.match(/\{[^}]+\}/g) ?? []).sort();
    for (const k of Object.keys(flatEn)) {
      expect(placeholders(flatVi[k]), `placeholders for ${k}`).toEqual(placeholders(flatEn[k]));
    }
  });
});

/**
 * T091 (US4.1, FR-401): full bilingual coverage across every tool namespace, and
 * no English string silently leaking into the Vietnamese catalog.
 */

// Mirrors the registered `toolModules` in src/ui/moduleRegistry.ts. Kept explicit
// (rather than importing the registry, which would pull the engine/React into the
// unit env) so adding a module without its EN+VI strings fails this test.
const TOOL_MODULE_IDS = [
  // Phase 1 — core adjustments
  'adjust',
  'crop',
  'curves',
  'color',
  'whiteBalance',
  'filters',
  'finishing',
  'presets',
  // Phase 2 — face & body intelligence
  'face',
  'skin',
  'targeted',
  'body',
  'warp',
  'background',
  // Phase 3 — creative & makeup layer
  'makeup',
  'text',
  'stickers',
  'frames',
  'retouch',
  'blend',
  'draw',
];

describe('i18n full coverage across all tool namespaces (T091)', () => {
  it('every tool module has a toolbar label in both locales', () => {
    for (const id of TOOL_MODULE_IDS) {
      expect(flatEn[`toolbar.${id}`], `en toolbar.${id}`).toBeTruthy();
      expect(flatVi[`toolbar.${id}`], `vi toolbar.${id}`).toBeTruthy();
    }
  });

  it('every tool module owns a non-empty tools.<id>.* namespace present in both locales', () => {
    for (const id of TOOL_MODULE_IDS) {
      const enKeys = Object.keys(flatEn).filter((k) => k.startsWith(`tools.${id}.`));
      expect(enKeys.length, `tools.${id}.* (en) has entries`).toBeGreaterThan(0);
      for (const k of enKeys) expect(flatVi[k], `vi ${k}`).toBeTruthy();
    }
  });
});

/**
 * Proper nouns, file-format tokens, and universal symbols that are intentionally
 * identical in both locales. Any *other* key whose vi value equals its en value
 * is treated as an accidental English fallback and fails the test.
 */
const IDENTICAL_ALLOWED = new Set<string>([
  'common.appName', // brand
  'home.title', // brand
  'common.ok', // universal
  'export.jpeg', // file-format token
  'export.png', // file-format token
  'tools.curves.rgb', // technical channel token
  'aspect.9:16', // "Story" is used untranslated in Vietnamese social usage
  'tools.filters.items.kodachrome', // film-stock proper noun
  'tools.filters.items.portra', // film-stock proper noun
  'tools.filters.items.noir', // film-look proper noun
]);

describe('Vietnamese has no accidental English fallback (T091)', () => {
  it('no vi value equals its en value except allowed proper nouns / tokens', () => {
    const leaks: string[] = [];
    for (const k of Object.keys(flatEn)) {
      if (flatVi[k] === undefined) continue;
      if (flatEn[k] === flatVi[k] && !IDENTICAL_ALLOWED.has(k)) {
        leaks.push(`${k} = ${JSON.stringify(flatEn[k])}`);
      }
    }
    expect(leaks, `untranslated English in vi:\n${leaks.join('\n')}`).toEqual([]);
  });
});
