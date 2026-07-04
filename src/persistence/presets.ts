/**
 * PresetStore (US1.6, T049). Save/apply/rename/reorder/delete over portable op
 * types only, plus share-code export/import (presetCode.ts).
 */
import { getDB, guardedWrite } from './db';
import { encodePreset, decodePreset } from './presetCode';
import { CURRENT_SCHEMA_VERSION, isPortableOp } from '@/engine/editState';
import { newId } from '@/shared/id';
import type { AnyOperation } from '@/engine/editState';
import type { Preset } from './types';

/**
 * Next free sort order. Deriving from the max (not `existing.length`) keeps it
 * collision-free after a non-last preset is deleted — deletePreset does not
 * renumber survivors, so length can be < maxSortOrder+1.
 */
function nextSortOrder(existing: Preset[]): number {
  return existing.reduce((m, p) => Math.max(m, p.sortOrder + 1), 0);
}

export async function listPresets(): Promise<Preset[]> {
  try {
    const db = await getDB();
    const all = await db.getAll('presets');
    return all.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [];
  }
}

/** Save the current portable ops as a named recipe. */
export async function savePreset(name: string, ops: AnyOperation[]): Promise<Preset | null> {
  const portable = ops.filter((o) => isPortableOp(o.type));
  const existing = await listPresets();
  const preset: Preset = {
    id: newId('preset'),
    name: name.trim() || 'Recipe',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    operations: structuredClone(portable),
    sortOrder: nextSortOrder(existing),
    createdAt: Date.now(),
  };
  const outcome = await guardedWrite(async () => {
    const db = await getDB();
    await db.put('presets', preset);
  });
  return outcome.ok ? preset : null;
}

export async function renamePreset(id: string, name: string): Promise<void> {
  await guardedWrite(async () => {
    const db = await getDB();
    const p = await db.get('presets', id);
    if (p) await db.put('presets', { ...p, name: name.trim() || p.name });
  });
}

export async function deletePreset(id: string): Promise<void> {
  await guardedWrite(async () => {
    const db = await getDB();
    await db.delete('presets', id);
  });
}

export async function reorderPresets(orderedIds: string[]): Promise<void> {
  await guardedWrite(async () => {
    const db = await getDB();
    const tx = db.transaction('presets', 'readwrite');
    await Promise.all(
      orderedIds.map(async (id, i) => {
        const p = await tx.store.get(id);
        if (p) await tx.store.put({ ...p, sortOrder: i });
      }),
    );
    await tx.done;
  });
}

export async function exportPresetCode(preset: Preset): Promise<string> {
  return encodePreset(preset.name, preset.operations);
}

/** Import a share code → a persisted Preset (throws PresetCodeError on failure). */
export async function importPresetCode(code: string): Promise<Preset> {
  const payload = await decodePreset(code);
  const existing = await listPresets();
  const preset: Preset = {
    id: newId('preset'),
    name: payload.name,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    operations: payload.ops,
    sortOrder: nextSortOrder(existing),
    createdAt: Date.now(),
  };
  await guardedWrite(async () => {
    const db = await getDB();
    await db.put('presets', preset);
  });
  return preset;
}
