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
