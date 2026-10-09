const CACHE = 'protocolum-shell-v43';
const CORE = ['./','./index.html','./app-shell.css','./mobile-layout.css','./mobile-layout.js','./liquid-glass.css','./auth-google.js','./cloud-sync.js','./profile-ui.js','./profile-data.js','./profile-store.js','./profile-sharing.js','./study-sync.js','./profile-ui.css','./profile-academic.js','./friends-network.js','./firebase-config.js','./community-case-forum.js','./community-cloud.js','./community-general.js','./community-view.js','./hf-decision-flow.js','./pubmed-lab.js','./library-auto-update.js','./reader-architecture.js','./guideline-comparison.js','./guideline-comparison-data.js','./guideline-comparison.css','./privacidade.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Firebase OAuth helpers must stay online and cannot use the app-shell fallback.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/__/auth/') || url.pathname.startsWith('/__/firebase/')) return;
  event.respondWith(caches.match(request, {ignoreSearch:true}).then(cached => cached || fetch(request).then(response => {
    if (response.ok && new URL(request.url).pathname.startsWith(new URL('./', self.location).pathname)) {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
