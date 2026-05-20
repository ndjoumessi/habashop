const CACHE_NAME = 'habashop-v2'

self.addEventListener('install', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim())
})

// Network First pour tout (pas de cache agressif)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  // Skip API calls
  if (e.request.url.includes('/api/')) return

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache uniquement les assets statiques
        if (response.ok && (
          e.request.url.includes('/assets/') ||
          e.request.url.endsWith('.js') ||
          e.request.url.endsWith('.css') ||
          e.request.url.endsWith('.png')
        )) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
        }
        return response
      })
      .catch(() => caches.match(e.request))
  )
})
