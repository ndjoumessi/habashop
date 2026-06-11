import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

// Ventes minimales nécessaires au calcul des stats paiement du jour.
export interface PaymentStatSale {
  total:             number
  status:            string
  createdAt:         Date
  mtnMomoReference:  string | null
  campayReference:   string | null
}

export interface ProviderStat {
  count:    number        // nb de transactions réussies aujourd'hui
  amountXof: number       // montant cumulé en XOF (base)
  lastAt:   string | null // ISO de la dernière transaction réussie, null si aucune
}

/**
 * Agrège les transactions du jour par fournisseur de paiement.
 * MTN = ventes avec mtnMomoReference ; Campay = ventes avec campayReference.
 * Les ventes remboursées (status 'refunded') sont exclues du CA, cohérent avec
 * le reste de l'app. Fonction PURE → testable sans Fastify/DB.
 */
export function computePaymentStats(sales: PaymentStatSale[]): { mtn: ProviderStat; campay: ProviderStat } {
  const empty = (): ProviderStat => ({ count: 0, amountXof: 0, lastAt: null })
  const mtn = empty()
  const campay = empty()

  for (const s of sales) {
    if (s.status === 'refunded') continue
    const t = s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt)
    if (s.mtnMomoReference) {
      mtn.count += 1
      mtn.amountXof += s.total
      if (!mtn.lastAt || t.getTime() > new Date(mtn.lastAt).getTime()) mtn.lastAt = t.toISOString()
    }
    if (s.campayReference) {
      campay.count += 1
      campay.amountXof += s.total
      if (!campay.lastAt || t.getTime() > new Date(campay.lastAt).getTime()) campay.lastAt = t.toISOString()
    }
  }
  return { mtn, campay }
}

/** Bornes UTC [00:00, 24:00) du jour courant (même convention que Ticket Z). */
function todayRangeUTC(now = new Date()): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  return { dayStart, dayEnd }
}

export async function paymentStatsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/payments/today-stats ──────────────────────────────────────
  // Transactions MTN MoMo + Campay du jour (count + montant XOF + dernière réussie).
  // Lecture tout-membre authentifié, scope tenant. Montants en XOF base
  // (le front convertit dans la devise d'affichage).
  app.get('/api/payments/today-stats', { preHandler: [authenticate] }, async (request: any) => {
    const { tenantId } = request.user
    const { dayStart, dayEnd } = todayRangeUTC()

    const sales = await prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: dayStart, lt: dayEnd } },
      select: { total: true, status: true, createdAt: true, mtnMomoReference: true, campayReference: true },
    })

    return computePaymentStats(sales as PaymentStatSale[])
  })
}
