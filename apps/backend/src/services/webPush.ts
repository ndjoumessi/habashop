import webpush from 'web-push'
import { basePrisma } from '../db'

// ── Web Push (PWA navigateur) — DISTINCT du push Expo mobile (pushService.ts) ──────────
// Expo pousse vers exp.host ; le web pousse vers le service push du navigateur via le Web
// Push Protocol + clés VAPID. Les deux coexistent : une notification part vers les DEUX
// (mobile + navigateurs abonnés). SEUL module autorisé à importer `web-push`.
//
// ⚠️ FIRE-AND-FORGET, fail-silent comme pushService : un échec push ne doit JAMAIS casser
// la transaction métier appelante. web-push est GRATUIT (pas de garde de dépense).
//
// Config par env, LUE À CHAUD (comme les plafonds de quota) → activable sans redéploiement :
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (paire générée par `web-push generate-vapid-keys`)
//   VAPID_SUBJECT (mailto: ou https:, défaut mailto:support@habashop). Clés absentes → no-op.

export type WebPushSubscription = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

// Clé publique VAPID exposée au frontend (pour pushManager.subscribe). null si non configuré.
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null
}

// Configure web-push depuis l'env si la paire est présente. Renvoie false sinon (no-op amont).
function ensureConfigured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@habashop.com'
  try {
    webpush.setVapidDetails(subject, pub, priv)
    return true
  } catch {
    return false // clés malformées → on n'envoie rien plutôt que de lever
  }
}

// Parse un token stocké (PushToken.token = JSON de la subscription pour platform='web').
// Renvoie null si illisible → la subscription est ignorée (jamais d'exception).
export function parseWebSubscription(token: string): WebPushSubscription | null {
  try {
    const s = JSON.parse(token)
    if (s && typeof s.endpoint === 'string' && s.keys?.p256dh && s.keys?.auth) return s
  } catch { /* token non-JSON (ex. token Expo) → pas une subscription web */ }
  return null
}

// Envoi bas niveau vers N subscriptions web. Purge celles devenues invalides (404/410 =
// abonnement expiré/révoqué) par endpoint exact — `basePrisma` (nettoyage technique, souvent
// dans le ctx d'une autre boutique, cf. pushService). Aucune exception propagée.
export async function sendWebPush(
  subscriptions: WebPushSubscription[],
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (subscriptions.length === 0) return
  if (!ensureConfigured()) return // VAPID absent → silencieux (feature non activée)
  const payload = JSON.stringify({ title, body, data })
  const dead: string[] = []
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload)
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) dead.push(sub.endpoint)
        // autres erreurs (réseau, 5xx) : on ignore (fail-silent), pas de purge (transitoire).
      }
    }),
  )
  if (dead.length > 0) {
    // L'endpoint vit DANS le JSON du token → deleteMany ne peut pas le cibler en SQL.
    // On relit les tokens web, on filtre applicativement ceux dont l'endpoint est mort,
    // et on supprime par id. Fail-silent (nettoyage best-effort).
    try {
      const rows = await basePrisma.pushToken.findMany({ where: { platform: 'web' }, select: { id: true, token: true } })
      const deadIds = rows
        .filter((r) => { const s = parseWebSubscription(r.token); return s !== null && dead.includes(s.endpoint) })
        .map((r) => r.id)
      if (deadIds.length) await basePrisma.pushToken.deleteMany({ where: { id: { in: deadIds } } })
    } catch { /* purge best-effort */ }
  }
}
