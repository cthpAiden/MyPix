/**
 * Self-hosted fonts via next/font (T009, research R8). Be Vietnam Pro (built
 * for Vietnamese diacritics) primary + Noto Sans fallback. next/font fetches
 * and self-hosts at build time — no runtime Google requests, so fonts work
 * offline and nothing leaves the device.
 */
import { Be_Vietnam_Pro, Noto_Sans } from 'next/font/google';

export const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

export const noto = Noto_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-noto',
  display: 'swap',
});
