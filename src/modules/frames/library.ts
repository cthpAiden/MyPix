/**
 * Frame preset index (US3.4, FR-303). Frame styles are a content drop
 * (public/frames/index.json). Built-in presets are the offline fallback so the
 * tool always works; the service worker runtime-caches /frames/.
 */
import type { FrameStyle } from '@/engine/editState';

export interface FrameEntry {
  id: string;
  style: FrameStyle;
  width: number;
  color: string;
}

const BUILTIN: FrameEntry[] = [
  { id: 'border', style: 'border', width: 0.04, color: '#f4efe6' },
  { id: 'filmstrip', style: 'filmstrip', width: 0.06, color: '#111114' },
  { id: 'instant', style: 'instant', width: 0.05, color: '#f7f4ee' },
];

export async function loadFrames(): Promise<FrameEntry[]> {
  try {
    const res = await fetch('/frames/index.json', { cache: 'no-cache' });
    if (!res.ok) return BUILTIN;
    const data = (await res.json()) as { frames?: FrameEntry[] };
    return data.frames && data.frames.length ? data.frames : BUILTIN;
  } catch {
    return BUILTIN;
  }
}
