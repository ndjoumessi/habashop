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
  paydunyaReference: string | null
}

export interface ProviderStat {
  count:    number        // nb de transactions réussies aujourd'hui
  amountXof: number       // montant cumulé en XOF (base)
  lastAt:   string | null // ISO de la dernière transaction réussie, null si aucune
}

/**
 * Agrège les transactions du jour par fournisseur de paiement.
 * MTN = ventes avec mtnMomoReference ; Campay = campayReference ; PayDunya = paydunyaReference.
 * Les ventes remboursées (status 'refunded') sont exclues du CA, cohérent avec
 * le reste de l'app. Fonction PURE → testable sans Fastify/DB.
 */
export function computePaymentStats(sales: PaymentStatSale[]): { mtn: ProviderStat; campay: ProviderStat; paydunya: ProviderStat } {
  const empty = (): ProviderStat => ({ count: 0, amountXof: 0, lastAt: null })
  const add = (p: ProviderStat, total: number, t: Date) => {
    p.count += 1
    p.amountXof += total
    if (!p.lastAt || t.getTime() > new Date(p.lastAt).getTime()) p.lastAt = t.toISOString()
  }
  const mtn = empty()
  const campay = empty()
  const paydunya = empty()

  for (const s of sales) {
    if (s.status === 'refunded') continue
    const t = s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt)
    if (s.mtnMomoReference)  add(mtn, s.total, t)
    if (s.campayReference)   add(campay, s.total, t)
    if (s.paydunyaReference) add(paydunya, s.total, t)
  }
  return { mtn, campay, paydunya }
}

/** Bornes UTC [00:00, 24:00) du jour courant (même convention que Ticket Z). */
function todayRangeUTC(now = new Date()): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  return { dayStart, dayEnd }
}

export async function paymentStatsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/payments/today-stats ──────────────────────────────────────
  // Transactions MTN MoMo + Campay + PayDunya du jour (count + montant XOF + dernière réussie).
  // Lecture tout-membre authentifié, scope tenant. Montants en XOF base
  // (le front convertit dans la devise d'affichage).
  app.get('/api/payments/today-stats', { preHandler: [authenticate] }, async (request: any) => {
    const { tenantId } = request.user
    const { dayStart, dayEnd } = todayRangeUTC()

    const sales = await prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: dayStart, lt: dayEnd } },
      select: { total: true, status: true, createdAt: true, mtnMomoReference: true, campayReference: true, paydunyaReference: true },
    })

    return computePaymentStats(sales as PaymentStatSale[])
  })
}
