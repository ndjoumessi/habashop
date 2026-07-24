import { Expo, type ExpoPushMessage } from 'expo-server-sdk'
import { basePrisma, prisma } from '../db'
import { sendWebPush, parseWebSubscription, type WebPushSubscription } from './webPush'

// Service d'envoi de notifications push Expo (serveur → appareils mobiles via exp.host).
// ⚠️ FIRE-AND-FORGET : tout est fail-silent — une erreur push ne doit JAMAIS faire échouer
// la transaction métier appelante (vente, congé…). Les tokens sont enregistrés par l'app
// mobile via POST /api/notifications/token (modèle PushToken).

// EXPO_ACCESS_TOKEN optionnel (renforce la sécurité d'envoi si configuré côté projet Expo).
const expo = new Expo(
  process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : undefined,
)

interface PushData {
  type: 'low_stock' | 'payment_received' | 'leave_pending' | 'trial_expiring' | 'stock_transfer'
  [key: string]: unknown
}

// Tokens d'un tenant filtrés par rôle. Respecte l'opt-in push tenant (notifPushAll).
// Rôles normalisés en MAJUSCULES (le champ User.role est une String libre).
async function tokensForRoles(tenantId: string, roles: string[]): Promise<string[]> {
  // NE JAMAIS lever : appelé en fire-and-forget (`void`) → une exception deviendrait une
  // unhandled rejection. Toute erreur DB renvoie une liste vide (aucun push, fail-silent).
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { notifPushAll: true },
    })
    if (tenant?.notifPushAll === false) return [] // push désactivé pour ce tenant
    const upper = roles.map((r) => r.toUpperCase())
    const rows = await prisma.pushToken.findMany({
      where: { tenantId, user: { role: { in: upper } } },
      select: { token: true },
    })
    return rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t))
  } catch (err) {
    console.warn('[push] tokensForRoles échec (non bloquant):', err)
    return []
  }
}

// Subscriptions WEB (PWA) des rôles ciblés — pendant de tokensForRoles pour le canal navigateur.
// Même opt-in tenant (notifPushAll). NE JAMAIS lever (fire-and-forget).
async function webSubsForRoles(tenantId: string, roles: string[]): Promise<WebPushSubscription[]> {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { notifPushAll: true } })
    if (tenant?.notifPushAll === false) return []
    const upper = roles.map((r) => r.toUpperCase())
    const rows = await prisma.pushToken.findMany({
      where: { tenantId, platform: 'web', user: { role: { in: upper } } },
      select: { token: true },
    })
    return rows.map((r) => parseWebSubscription(r.token)).filter((s): s is WebPushSubscription => s !== null)
  } catch (err) {
    console.warn('[push] webSubsForRoles échec (non bloquant):', err)
    return []
  }
}

// Orchestrateur UNIQUE : fanne une notification vers le mobile (Expo) ET le web (VAPID).
// Les canaux sont indépendants et fail-silent chacun → l'un peut échouer sans affecter l'autre.
async function dispatch(tenantId: string, roles: string[], title: string, body: string, data: PushData): Promise<void> {
  const [expoTokens, webSubs] = await Promise.all([tokensForRoles(tenantId, roles), webSubsForRoles(tenantId, roles)])
  await Promise.all([sendPush(expoTokens, title, body, data), sendWebPush(webSubs, title, body, data)])
}

// Envoi bas niveau : chunk par 100 (limite Expo), tickets inspectés pour purger les tokens
// morts (DeviceNotRegistered) de la base. Aucune exception propagée.
export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data: PushData,
): Promise<void> {
  try {
    const valid = tokens.filter((t) => Expo.isExpoPushToken(t))
    if (valid.length === 0) return

    const messages: ExpoPushMessage[] = valid.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
    }))

    const invalid: string[] = []
    for (const chunk of expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk)
        // Alignement ticket↔token via chunk[j].to (robuste si un chunk échoue).
        tickets.forEach((ticket, j) => {
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            const to = chunk[j]?.to
            if (typeof to === 'string') invalid.push(to)
          }
        })
      } catch (err) {
        console.warn('[push] envoi chunk échoué (non bloquant):', err)
      }
    }

    if (invalid.length > 0) {
      // Purge des tokens morts → évite de réenvoyer indéfiniment vers des appareils désinscrits.
      // `basePrisma` : nettoyage TECHNIQUE par token exact (renvoyé par Expo), souvent déclenché
      // fire-and-forget dans le ctx d'une AUTRE boutique (ex. push transfert vers la partenaire) —
      // l'injection tenant scinderait la purge au mauvais tenant et raterait les tokens morts.
      await basePrisma.pushToken.deleteMany({ where: { token: { in: invalid } } }).catch(() => {})
    }
  } catch (err) {
    console.warn('[push] sendPush échec global (non bloquant):', err)
  }
}

const fmtAmount = (xof: number) => `${(Number(xof) || 0).toLocaleString('fr-FR')} FCFA`

// ⚠️ Rupture/stock bas → MANAGER + ADMIN (+ SUPER_ADMIN superset).
export async function sendStockAlert(tenantId: string, productName: string, stock: number): Promise<void> {
  await dispatch(tenantId, ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    '⚠️ Rupture de stock',
    `${productName} — stock : ${stock}`,
    { type: 'low_stock', productName, stock },
  )
}

// 💰 Paiement reçu (mobile money / carte) → ADMIN (+ SUPER_ADMIN).
export async function sendPaymentReceived(tenantId: string, amountXOF: number, method: string): Promise<void> {
  await dispatch(tenantId, ['ADMIN', 'SUPER_ADMIN'],
    '💰 Paiement reçu',
    `${fmtAmount(amountXOF)} via ${method}`,
    { type: 'payment_received', amount: amountXOF, method },
  )
}

// 📋 Demande de congé en attente → ADMIN (+ SUPER_ADMIN).
export async function sendLeavePending(tenantId: string, employeeName: string): Promise<void> {
  await dispatch(tenantId, ['ADMIN', 'SUPER_ADMIN'],
    '📋 Congé en attente',
    `${employeeName} a soumis une demande`,
    { type: 'leave_pending', employeeName },
  )
}

// ⏰ Essai expirant dans N jours → ADMIN (+ SUPER_ADMIN). Envoyé depuis le cron trial reminders.
export async function sendTrialExpiring(tenantId: string, daysLeft: number): Promise<void> {
  await dispatch(tenantId, ['ADMIN', 'SUPER_ADMIN'],
    '⏰ Essai expire bientôt',
    `Votre essai HabaShop expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
    { type: 'trial_expiring', daysLeft },
  )
}

// ↔ Transfert confirmé par la destination → MANAGER + ADMIN de la boutique SOURCE.
export async function sendTransferConfirmed(sourceTenantId: string, destShopName: string, productName: string, quantity: number): Promise<void> {
  await dispatch(sourceTenantId, ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    '✅ Transfert confirmé',
    `${destShopName} a reçu ${quantity} × ${productName}`,
    { type: 'stock_transfer', status: 'completed', productName, quantity },
  )
}

// ↔ Transfert annulé → MANAGER + ADMIN d'une boutique (appelé pour source ET destination).
export async function sendTransferCancelled(tenantId: string, byShopName: string, productName: string): Promise<void> {
  await dispatch(tenantId, ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    '❌ Transfert annulé',
    `${byShopName} a annulé le transfert de ${productName}`,
    { type: 'stock_transfer', status: 'cancelled', productName },
  )
}

// 📦 Alertes stock groupées (cron quotidien) → MANAGER + ADMIN + SUPER_ADMIN.
// Envoie une seule notif résumant N produits en rupture (le pire en premier).
export async function sendStockAlertBatch(
  tenantId: string,
  products: Array<{ name: string; stockQty: number }>,
): Promise<void> {
  if (products.length === 0) return
  const worst = products[0]
  const body = products.length === 1
    ? `${worst.name} — stock : ${worst.stockQty}`
    : `${worst.name} et ${products.length - 1} autre${products.length > 2 ? 's' : ''}`
  await dispatch(tenantId, ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
    `⚠️ ${products.length} produit${products.length > 1 ? 's' : ''} en rupture`,
    body,
    { type: 'low_stock', productName: worst.name, stock: worst.stockQty },
  )
}
