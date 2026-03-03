// WorkFlow Service Worker - handles named file downloads on iOS
const DOWNLOAD_CACHE = 'wf-downloads-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Store file data posted from the app
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'STORE_DOWNLOAD') {
    const { filename, data, mimeType } = event.data;
    const cache = await caches.open(DOWNLOAD_CACHE);
    const response = new Response(data, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': data.byteLength
      }
    });
    await cache.put('/Workflow/download/' + encodeURIComponent(filename), response);
    event.ports[0].postMessage({ type: 'DOWNLOAD_READY', filename });
  }
});

// Serve stored files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/Workflow/download/')) {
    event.respondWith(
      caches.open(DOWNLOAD_CACHE).then(cache => cache.match(event.request.url))
    );
  }
});
