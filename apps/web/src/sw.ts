/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// autoUpdate with injectManifest: without this a new deploy waits until every open copy of the app is
// closed, so phones keep running the old app against the new API.
self.skipWaiting();

// App shell precache — injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Google Fonts runtime cache — your index.html preconnects to these.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({ cacheName: 'google-fonts-stylesheets' }),
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({ cacheName: 'google-fonts-webfonts' }),
);

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
