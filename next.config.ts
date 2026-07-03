import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // The app must run offline once installed; disable only for local dev noise.
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  // Fully static export — zero server compute (research R1, Constitution I/II).
  output: 'export',
  reactStrictMode: true,
  images: {
    // Static export cannot use the Next image optimizer.
    unoptimized: true,
  },
  // COOP/COEP are also declared in vercel.json for the deployed host (R13);
  // headers() is inert under `output: 'export'` but kept for `next dev`.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
