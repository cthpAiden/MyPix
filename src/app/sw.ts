/**
 * Serwist service worker (US1.10, T029/T059, research R12).
 *
 * Precaches the exported app shell for offline launch, runtime cache-first for
 * self-hosted models / filter+sticker assets, and a navigation fallback. Does
 * NOT skipWaiting by default, so an update never yanks the rug mid-edit — the
 * new worker activates on the next clean launch (acceptance 1.10-3).
 */
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const assetCache = new CacheFirst({
  cacheName: 'mypix-assets',
  plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 })],
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) =>
        url.pathname.startsWith('/models/') ||
        url.pathname.startsWith('/mediapipe/') ||
        url.pathname.startsWith('/filters/') ||
        url.pathname.startsWith('/stickers/') ||
        url.pathname.startsWith('/frames/'),
      handler: assetCache,
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        // Locale-agnostic root: the '/' page (RootRedirect) client-redirects to
        // the persisted locale, so an offline navigation to an uncached /vi/…
        // route falls back to the user's chosen language, not a hardcoded /en.
        url: '/',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

// Allow the app to opt into an immediate update (user consent) via postMessage.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string })?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

serwist.addEventListeners();
