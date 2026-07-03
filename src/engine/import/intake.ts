/**
 * Photo intake (US1.1, T031): library pick and native camera handoff via a
 * hidden `<input type="file">` (no live camera — Constitution III). Returns the
 * chosen File, or null if the user cancels.
 */

function pick(options: { capture?: boolean }): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.heic,.heif';
    if (options.capture) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-9999px';

    let settled = false;
    const done = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };

    input.addEventListener('change', () => done(input.files?.[0] ?? null));
    // If the sheet is dismissed without a pick, focus returns without change.
    window.addEventListener(
      'focus',
      () => setTimeout(() => done(input.files?.[0] ?? null), 400),
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}

/** Open the library picker. */
export function pickFromLibrary(): Promise<File | null> {
  return pick({ capture: false });
}

/** Hand off to the native camera. */
export function captureFromCamera(): Promise<File | null> {
  return pick({ capture: true });
}
