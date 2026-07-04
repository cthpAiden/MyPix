/**
 * Export delivery (US1.1, T036): Web Share files-only payload (iOS drops files
 * when mixed with text/URL) with an anchor-download fallback (FR-118).
 */
export async function deliver(
  blob: Blob,
  fileName: string,
  mode: 'share' | 'download',
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (mode === 'share' && typeof navigator !== 'undefined' && 'share' in navigator) {
    const file = new File([blob], fileName, { type: blob.type });
    const canShare = navigator.canShare?.({ files: [file] }) ?? true;
    if (canShare) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (err) {
        // A user who dismisses the share sheet rejects with AbortError — that is
        // an explicit "no", so do NOT silently download the file behind their
        // back. Only a genuine failure falls through to the download fallback.
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      }
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
