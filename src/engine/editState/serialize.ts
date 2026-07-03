/**
 * Lossless serialize/deserialize + the schemaVersion migration chain (T013).
 *
 * `deserialize(serialize(s))` must deep-equal `s` for a valid current-version
 * state (unit-tested, T014) — this is what Draft and Preset persistence rely on.
 */
import { CURRENT_SCHEMA_VERSION, emptyEditState } from './types';
import type { EditState } from './types';

export function serialize(state: EditState): string {
  return JSON.stringify(state);
}

/** Migration step vN → vN+1. Register additive migrations here as schema grows. */
type Migration = (state: EditState) => EditState;

const MIGRATIONS: Record<number, Migration> = {
  // Example for the future:
  // 1: (s) => ({ ...s, schemaVersion: 2, /* additive change */ }),
};

/** Run the migration chain from a state's version up to CURRENT_SCHEMA_VERSION. */
export function migrate(state: EditState): EditState {
  let current = state;
  while (current.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion];
    if (!step) {
      // No path forward — treat as unmigratable; caller should fall back.
      throw new Error(
        `No migration from schemaVersion ${current.schemaVersion} to ${CURRENT_SCHEMA_VERSION}`,
      );
    }
    current = step(current);
  }
  return current;
}

/**
 * Parse + migrate a serialized edit state. Returns a normalized EditState.
 * Throws on malformed JSON or an unmigratable version — callers (draft/preset
 * load) catch and fall back to a bilingual message rather than crashing.
 */
export function deserialize(json: string): EditState {
  const parsed = JSON.parse(json) as Partial<EditState>;
  if (
    parsed == null ||
    typeof parsed.schemaVersion !== 'number' ||
    !Array.isArray(parsed.operations) ||
    !Array.isArray(parsed.layers)
  ) {
    throw new Error('deserialize: not a valid EditState payload');
  }
  const base: EditState = {
    schemaVersion: parsed.schemaVersion,
    operations: parsed.operations,
    layers: parsed.layers,
  };
  return base.schemaVersion === CURRENT_SCHEMA_VERSION ? base : migrate(base);
}

/** Best-effort deserialize that never throws — for resilient draft reads. */
export function tryDeserialize(json: string): EditState | null {
  try {
    return deserialize(json);
  } catch {
    return null;
  }
}

export { emptyEditState };
