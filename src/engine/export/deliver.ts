/**
 * Export delivery (US1.1, T036): Web Share files-only payload (iOS drops files
 * when mixed with text/URL) with an anchor-download fallback (FR-118).
 */
export async function deliver(
  blob: Blob,
  fileName: string,
  mode: 'share' | 'download',
): Promise<'shared' | 'downloaded'> {
  if (mode === 'share' && typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const file = new File([blob], fileName, { type: blob.type });
      const canShare = navigator.canShare?.({ files: [file] }) ?? true;
      if (canShare) {
        await navigator.share({ files: [file] });
        return 'shared';
      }
    } catch {
      // User cancelled or share unavailable → fall through to download.
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
