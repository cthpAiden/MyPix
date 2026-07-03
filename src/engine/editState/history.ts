/**
 * Bounded undo/redo history ring (T012, data-model.md).
 *
 * Entries are lightweight snapshots of the edit stack (operations + layers) —
 * never pixels — so the ring stays tiny. Per-gesture coalescing keeps one
 * history step per user gesture (pointer-down → pointer-up) so undo matches
 * intent (contracts/edit-state.md).
 */
import type { EditState } from './types';

interface RingEntry {
  state: EditState;
  label: string;
}

function snapshot(state: EditState): EditState {
  return structuredClone(state);
}

export class HistoryRing {
  private entries: RingEntry[];
  private index: number;
  private lastCoalesceKey: string | null = null;

  constructor(initial: EditState, private readonly max = 100) {
    this.entries = [{ state: snapshot(initial), label: 'init' }];
    this.index = 0;
  }

  current(): EditState {
    return snapshot(this.entries[this.index].state);
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.entries.length - 1;
  }

  /**
   * Record a new current state. If `coalesceKey` matches the previous record's
   * key (same ongoing gesture), the current entry is replaced rather than a new
   * one appended, so the whole gesture collapses to one undo step.
   */
  record(next: EditState, label: string, coalesceKey?: string): void {
    const coalesce =
      coalesceKey != null &&
      coalesceKey === this.lastCoalesceKey &&
      this.index === this.entries.length - 1;

    if (coalesce) {
      this.entries[this.index] = { state: snapshot(next), label };
      return;
    }

    // Drop any redo tail, append, enforce bound.
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ state: snapshot(next), label });
    if (this.entries.length > this.max) {
      this.entries.shift();
    }
    this.index = this.entries.length - 1;
    this.lastCoalesceKey = coalesceKey ?? null;
  }

  /** End the current gesture so the next record starts a fresh step. */
  breakCoalesce(): void {
    this.lastCoalesceKey = null;
  }

  undo(): EditState | null {
    if (!this.canUndo()) return null;
    this.index -= 1;
    this.lastCoalesceKey = null;
    return this.current();
  }

  redo(): EditState | null {
    if (!this.canRedo()) return null;
    this.index += 1;
    this.lastCoalesceKey = null;
    return this.current();
  }

  /** Replace the whole ring (draft restore / new project). */
  reset(state: EditState): void {
    this.entries = [{ state: snapshot(state), label: 'reset' }];
    this.index = 0;
    this.lastCoalesceKey = null;
  }

  /** Serialize a bounded tail for draft persistence (history optional). */
  labels(): string[] {
    return this.entries.map((e) => e.label);
  }
}
