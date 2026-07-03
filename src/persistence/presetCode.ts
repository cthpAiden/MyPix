/**
 * Preset share-code codec (US1.6, T050, contracts/persistence.md).
 *
 *   MYPIX1.<base64url( deflate-raw( UTF-8 JSON payload ) )>
 *   payload = { v: schemaVersion, name, ops: portable Operation[] }
 *
 * Native CompressionStream — zero dependency. Round-trip is unit-tested (T051).
 */
import { CURRENT_SCHEMA_VERSION, isPortableOp } from '@/engine/editState';
import type { AnyOperation } from '@/engine/editState';

const PREFIX = 'MYPIX1.';

export type PresetCodeErrorCode = 'invalid-code' | 'unsupported-version';
export class PresetCodeError extends Error {
  constructor(readonly code: PresetCodeErrorCode) {
    super(code);
    this.name = 'PresetCodeError';
  }
}

export interface PresetPayload {
  v: number;
  name: string;
  ops: AnyOperation[];
}

async function streamThrough(
  bytes: Uint8Array,
  Ctor: typeof CompressionStream | typeof DecompressionStream,
  format: 'deflate-raw',
): Promise<Uint8Array> {
  const stream = new Ctor(format);
  const writer = stream.writable.getWriter();
  void writer.write(bytes as BufferSource);
  void writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const pad = '==='.slice((str.length + 3) % 4);
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encodePreset(name: string, ops: AnyOperation[]): Promise<string> {
  const portable = ops.filter((o) => isPortableOp(o.type));
  const payload: PresetPayload = { v: CURRENT_SCHEMA_VERSION, name, ops: portable };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressed = await streamThrough(bytes, CompressionStream, 'deflate-raw');
  return PREFIX + toBase64Url(compressed);
}

export async function decodePreset(code: string): Promise<PresetPayload> {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) throw new PresetCodeError('invalid-code');
  let payload: PresetPayload;
  try {
    const compressed = fromBase64Url(trimmed.slice(PREFIX.length));
    const bytes = await streamThrough(compressed, DecompressionStream, 'deflate-raw');
    payload = JSON.parse(new TextDecoder().decode(bytes)) as PresetPayload;
  } catch {
    throw new PresetCodeError('invalid-code');
  }
  if (
    typeof payload?.v !== 'number' ||
    typeof payload.name !== 'string' ||
    !Array.isArray(payload.ops)
  ) {
    throw new PresetCodeError('invalid-code');
  }
  if (payload.v > CURRENT_SCHEMA_VERSION) throw new PresetCodeError('unsupported-version');
  if (payload.ops.some((o) => !isPortableOp(o.type))) throw new PresetCodeError('invalid-code');
  return payload;
}
