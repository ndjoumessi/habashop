import { api } from '@/lib/api'

// ── Abonnement Web Push (PWA) — canal navigateur, distinct du push mobile Expo ──────────
// L'abonnement vit PAR NAVIGATEUR (une PushSubscription posée sur le service worker).
// Backend : POST /api/notifications/token { platform:'web', token:JSON } (cf. webPush.ts serveur).

export function isWebPushSupported(): boolean {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

// La clé VAPID applicationServerKey doit être un Uint8Array (base64url → octets). PURE, testable.
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  // Allocation sur un ArrayBuffer explicite → type `Uint8Array<ArrayBuffer>` (satisfait
  // BufferSource attendu par pushManager.subscribe, contrairement à `new Uint8Array(len)`).
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// Ce navigateur est-il déjà abonné ? (source de vérité = la PushSubscription du SW, pas un flag).
export async function getWebPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

// Active le push sur CET appareil : permission → clé VAPID serveur → subscribe → enregistrement.
// Renvoie un motif d'échec exploitable par l'UI plutôt qu'un booléen opaque.
export type EnableResult = 'ok' | 'unsupported' | 'denied' | 'not-configured' | 'error'
export async function enableWebPush(): Promise<EnableResult> {
  if (!isWebPushSupported()) return 'unsupported'
  try {
    const perm = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()
    if (perm !== 'granted') return 'denied'

    const vapid = await api.get<{ configured: boolean; publicKey: string | null }>('/api/notifications/vapid-public-key')
    if (!vapid?.configured || !vapid.publicKey) return 'not-configured'

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true, // exigé par les navigateurs (pas de push silencieux)
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
    })
    await api.post('/api/notifications/token', { platform: 'web', token: JSON.stringify(sub) })
    return 'ok'
  } catch {
    return 'error'
  }
}

// Désactive le push sur cet appareil : désabonne le SW + supprime le token côté serveur.
export async function disableWebPush(): Promise<boolean> {
  try {
    const sub = await getWebPushSubscription()
    if (!sub) return true
    const token = JSON.stringify(sub)
    await sub.unsubscribe().catch(() => undefined)
    await api.delete('/api/notifications/token', { token }).catch(() => undefined)
    return true
  } catch {
    return false
  }
}
