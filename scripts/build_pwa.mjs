import fs from 'node:fs';

const worker = `/* Self-unregistering clean worker that keeps Edge/CDN API responses fresh */
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
  );
});
`;
if (fs.existsSync('dist')) fs.writeFileSync('dist/sw.js', worker);
if (fs.existsSync('public')) fs.writeFileSync('public/sw.js', worker);
console.log('PWA service worker built.');
