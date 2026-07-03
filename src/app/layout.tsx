import type { Metadata, Viewport } from 'next';
import { beVietnam, noto } from './fonts';
import '@/ui/theme/tokens.css';

export const metadata: Metadata = {
  title: 'MyPix',
  description: 'A private, fully on-device beauty and photo editor. English & Tiếng Việt.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MyPix' },
  formatDetection: { telephone: false },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#0a0908',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${beVietnam.variable} ${noto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
