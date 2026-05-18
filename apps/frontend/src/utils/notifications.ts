export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

export function sendNotification(
  title: string,
  options?: { body?: string; icon?: string; badge?: string; tag?: string; data?: any }
) {
  if (Notification.permission !== 'granted') return
  const notif = new Notification(title, {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    ...options,
  })
  notif.onclick = () => {
    window.focus()
    notif.close()
    if (options?.data?.url) window.location.href = options.data.url
  }
  return notif
}

export function notifyLowStock(products: { name: string; stock: number }[], lang = 'fr') {
  if (!products.length) return
  const title = lang === 'fr'
    ? `⚠️ ${products.length} rupture(s) de stock`
    : `⚠️ ${products.length} stock alert(s)`
  const body = products.slice(0, 3).map(p => `${p.name}: ${p.stock} unités`).join('\n')
  sendNotification(title, { body, tag: 'low-stock', data: { url: '/app/stock' } })
}

export function notifySale(amount: string, lang = 'fr') {
  sendNotification(lang === 'fr' ? '✅ Vente enregistrée' : '✅ Sale recorded', {
    body: amount,
    tag: 'sale',
    data: { url: '/app/pos' },
  })
}
