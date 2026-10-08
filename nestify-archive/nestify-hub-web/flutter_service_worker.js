// Marketing preview: do not intercept. An empty file here registered as a
// service worker and blanked the Family Hub iframe.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
