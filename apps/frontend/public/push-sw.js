/* Handlers Web Push du service worker — importés par le SW généré (vite-plugin-pwa,
 * workbox.importScripts). Le SW généré par workbox ne permet pas d'ajouter des listeners
 * dans sa config : on les injecte via ce script séparé.
 *
 * Payload attendu (cf. apps/backend/src/services/webPush.ts) : { title, body, data }. */

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch (e) { payload = {} }
  const title = payload.title || 'HabaShop'
  const options = {
    body: payload.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: payload.data || {},
    // Regroupe par type → évite d'empiler N notifications identiques (ex. rupture stock).
    tag: (payload.data && payload.data.type) || 'habashop',
    renotify: true,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  // Route la notification vers l'écran pertinent (parité avec le tap mobile).
  let path = '/app/dashboard'
  if (data.type === 'low_stock') path = '/app/stock'
  else if (data.type === 'trial_expiring') path = '/app/settings'
  else if (data.type === 'stock_transfer') path = '/app/stock'
  const url = new URL(path, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Réutilise un onglet HabaShop déjà ouvert s'il y en a un, sinon en ouvre un.
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
