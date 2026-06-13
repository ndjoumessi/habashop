import { Expo, type ExpoPushMessage } from 'expo-server-sdk'
import { prisma } from '../db'

// Service d'envoi de notifications push Expo (serveur → appareils mobiles via exp.host).
// ⚠️ FIRE-AND-FORGET : tout est fail-silent — une erreur push ne doit JAMAIS faire échouer
// la transaction métier appelante (vente, congé…). Les tokens sont enregistrés par l'app
// mobile via POST /api/notifications/token (modèle PushToken).

// EXPO_ACCESS_TOKEN optionnel (renforce la sécurité d'envoi si configuré côté projet Expo).
const expo = new Expo(
  process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : undefined,
)

interface PushData {
  type: 'low_stock' | 'payment_received' | 'leave_pending'
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
      await prisma.pushToken.deleteMany({ where: { token: { in: invalid } } }).catch(() => {})
    }
  } catch (err) {
    console.warn('[push] sendPush échec global (non bloquant):', err)
  }
}

const fmtAmount = (xof: number) => `${(Number(xof) || 0).toLocaleString('fr-FR')} FCFA`

// ⚠️ Rupture/stock bas → MANAGER + ADMIN (+ SUPER_ADMIN superset).
export async function sendStockAlert(tenantId: string, productName: string, stock: number): Promise<void> {
  const tokens = await tokensForRoles(tenantId, ['MANAGER', 'ADMIN', 'SUPER_ADMIN'])
  await sendPush(
    tokens,
    '⚠️ Rupture de stock',
    `${productName} — stock : ${stock}`,
    { type: 'low_stock', productName, stock },
  )
}

// 💰 Paiement reçu (mobile money / carte) → ADMIN (+ SUPER_ADMIN).
export async function sendPaymentReceived(tenantId: string, amountXOF: number, method: string): Promise<void> {
  const tokens = await tokensForRoles(tenantId, ['ADMIN', 'SUPER_ADMIN'])
  await sendPush(
    tokens,
    '💰 Paiement reçu',
    `${fmtAmount(amountXOF)} via ${method}`,
    { type: 'payment_received', amount: amountXOF, method },
  )
}

// 📋 Demande de congé en attente → ADMIN (+ SUPER_ADMIN).
export async function sendLeavePending(tenantId: string, employeeName: string): Promise<void> {
  const tokens = await tokensForRoles(tenantId, ['ADMIN', 'SUPER_ADMIN'])
  await sendPush(
    tokens,
    '📋 Congé en attente',
    `${employeeName} a soumis une demande`,
    { type: 'leave_pending', employeeName },
  )
}
