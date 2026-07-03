/**
 * Interface-feedback layer (T027, design §Motion & feedback, FR-012).
 *
 * - `haptic()` — one real tick on discrete taps. iOS Safari has no vibrate API,
 *   so we use the native-switch haptic trick (toggling a hidden `<input switch>`
 *   emits the system tick); we also try `navigator.vibrate` where supported.
 * - `detent()` — a short, low-volume simulated-detent click during scrubbing.
 *
 * Both are gated by the sound toggle AND prefers-reduced-motion.
 */

let soundEnabled = true;
let reducedMotion = false;
let hapticLabel: HTMLLabelElement | null = null;
let audio: AudioContext | null = null;
let lastDetent = 0;

export function configureFeedback(opts: { sound: boolean; reducedMotion: boolean }): void {
  soundEnabled = opts.sound;
  reducedMotion = opts.reducedMotion;
}

function enabled(): boolean {
  return soundEnabled && !reducedMotion;
}

function ensureHaptic(): void {
  if (hapticLabel || typeof document === 'undefined') return;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  Object.assign(label.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    pointerEvents: 'none',
  });
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', ''); // Safari native switch → haptic on toggle
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  hapticLabel = label;
}

/** Discrete-tap tick. */
export function haptic(): void {
  if (!enabled()) return;
  ensureHaptic();
  try {
    hapticLabel?.click();
  } catch {
    /* ignore */
  }
  try {
    navigator.vibrate?.(1);
  } catch {
    /* ignore */
  }
}

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audio) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audio = new Ctor();
  }
  return audio;
}

/** Scrubbing detent tick — throttled so it fires per notch, not per frame. */
export function detent(): void {
  if (!enabled()) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastDetent < 28) return;
  lastDetent = now;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 2200;
  gain.gain.value = 0.0;
  osc.connect(gain).connect(ctx.destination);
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0, t);
  gain.gain.linearRampToValueAtTime(0.04, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  osc.start(t);
  osc.stop(t + 0.035);
}
