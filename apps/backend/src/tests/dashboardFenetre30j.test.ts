import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

/**
 * ⚠️ UNE SEULE BORNE POUR TOUT L'ÉCRAN — c'est CETTE propriété qui est verrouillée ici,
 * pas la valeur « 30 jours ».
 *
 * Le tableau de bord lisait le MOIS CALENDAIRE (`monthStart`). Mesuré le 2026-10-01 : le
 * 1ᵉʳ du mois, le KPI « CA mensuel » valait le CA de la matinée — et c'est le premier écran
 * de l'application. La fenêtre devient donc glissante sur 30 jours, via `salesWindowStart`,
 * déjà SOURCE UNIQUE de `/api/reports/sales` et déjà jumelée côté front.
 *
 * ⚠️ Le KPI, le camembert « CA par catégorie » et le top produits doivent partager la borne
 * EXACTE, à la milliseconde. C'est la famille du « total calculé sur ce qui est affiché » :
 * quatre dénominateurs avaient déjà coexisté sur un seul camembert, chacun correct
 * localement. Deux bornes distinctes rendraient un camembert dont les parts ne somment pas
 * au chiffre affiché juste au-dessus.
 *
 * ⚠️ Et la période de COMPARAISON est désormais pleine : les 30 jours d'avant, pas « le mois
 * précédent sur la même durée écoulée ». Tôt dans le mois, cette dernière comparait quelques
 * heures et rendait le badge de tendance nul.
 */

const { db } = vi.hoisted(() => ({
  db: {
    sale: { aggregate: vi.fn(), findMany: vi.fn() },
    product: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), fields: { stockMin: {} } },
    employee: { count: vi.fn() },
    purchaseOrder: { count: vi.fn() },
    saleItem: { groupBy: vi.fn(), findMany: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../lib/cache', () => ({ getCached: (_k: string, _t: number, fn: () => unknown) => fn() }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: { user?: object; tenantId?: string }) => {
    req.user = { tenantId: 'T1' }; req.tenantId = 'T1'
  },
}))

import { analyticsRoutes } from '../routes/analytics'

/**
 * Même arithmétique que `salesWindowStart` : un recul en JOURS CALENDAIRES, l'heure du jour
 * conservée.
 *
 * ⚠️ Surtout pas une soustraction en millisecondes. `setDate(d - 30)` traversant un
 * changement d'heure rend 30 jours ± 1 h en absolu : une assertion « ~30 × 86 400 000 à
 * 5 s près » serait verte aujourd'hui et rouge fin octobre sur un poste en Europe/Paris,
 * verte en CI (UTC) et rouge en local. Le même piège que les tests de crons.
 */
function reculJours(instant: number, jours: number): number {
  const d = new Date(instant)
  d.setDate(d.getDate() - jours)
  return d.getTime()
}

async function appeler() {
  const app = Fastify()
  await app.register(analyticsRoutes)
  await app.ready()
  const avant = Date.now()
  const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats' })
  return { res, corps: res.json(), avant, apres: Date.now() }
}

/** `gte` du n-ième appel à `sale.aggregate`, en millisecondes. */
function gteAgregat(n: number): number {
  const where = db.sale.aggregate.mock.calls[n][0].where
  return new Date(where.createdAt.gte).getTime()
}

beforeEach(() => {
  vi.clearAllMocks()
  db.product.count.mockResolvedValue(50)
  db.employee.count.mockResolvedValue(5)
  db.purchaseOrder.count.mockResolvedValue(2)
  db.product.findMany.mockResolvedValue([])
  db.product.findFirst.mockResolvedValue({ name: 'P' })
  db.saleItem.groupBy.mockResolvedValue([])
  db.saleItem.findMany.mockResolvedValue([])
  db.sale.findMany.mockResolvedValue([])
  db.sale.aggregate
    .mockResolvedValueOnce({ _sum: { total: 1200 }, _count: 3 })
    .mockResolvedValueOnce({ _sum: { total: 5000 }, _count: 10 })
    .mockResolvedValueOnce({ _sum: { total: 1000 } })
    .mockResolvedValueOnce({ _sum: { total: 4000 } })
})

describe('GET /api/dashboard/stats — fenêtre de 30 jours GLISSANTS', () => {
  it('⚠️ DÉCISIF : le KPI, le camembert et le top produits partagent la borne EXACTE', async () => {
    await appeler()
    const borne = gteAgregat(1)
    const duTop = new Date(db.saleItem.groupBy.mock.calls[0][0].where.sale.createdAt.gte).getTime()
    const duCamembert = new Date(db.saleItem.findMany.mock.calls[0][0].where.sale.createdAt.gte).getTime()
    expect(duTop, 'top produits sur une autre borne que le KPI').toBe(borne)
    expect(duCamembert, 'camembert sur une autre borne que le KPI').toBe(borne)
  })

  it('la borne est à 30 jours en arrière, GLISSANTE — pas le 1ᵉʳ du mois', async () => {
    const { avant, apres } = await appeler()
    const borne = gteAgregat(1)
    // `now` est pris DANS la route, entre `avant` et `apres` : on encadre, on n'approxime pas.
    expect(borne).toBeGreaterThanOrEqual(reculJours(avant, 30))
    expect(borne).toBeLessThanOrEqual(reculJours(apres, 30))
  })

  it('la période de COMPARAISON est les 30 jours PLEINS d’avant — contiguë, sans trou', async () => {
    const { avant, apres } = await appeler()
    const borne = gteAgregat(1)
    const prec = db.sale.aggregate.mock.calls[3][0].where.createdAt
    expect(new Date(prec.lt).getTime(), 'les deux périodes doivent être contiguës').toBe(borne)
    const debut = new Date(prec.gte).getTime()
    expect(debut).toBeGreaterThanOrEqual(reculJours(avant, 60))
    expect(debut).toBeLessThanOrEqual(reculJours(apres, 60))
  })

  it('⚠️ le JOUR reste le jour CALENDAIRE — minuit local, pas 24 h glissantes', async () => {
    await appeler()
    const minuit = new Date(gteAgregat(0))
    expect([minuit.getHours(), minuit.getMinutes(), minuit.getSeconds()]).toEqual([0, 0, 0])
  })

  /**
   * ⚠️ LE NOM FAIT PARTIE DE LA CORRECTION. Un champ nommé `salesMonth` qui porte 30 jours
   * glissants est exactement le champ déclaré qui se fait passer pour une mesure : il se
   * relit trois fois sans qu'on voie le défaut. L'ancien nom doit DISPARAÎTRE, pas cohabiter
   * — deux noms pour un même nombre, c'est le motif du jumeau.
   */
  it('⚠️ la réponse porte sales30d / transactions30d / sales30dTrend, et PLUS l’ancien nom', async () => {
    const { corps } = await appeler()
    expect(corps.sales30d).toBe(5000)
    expect(corps.transactions30d).toBe(10)
    expect(corps.sales30dTrend).toBe(25)
    expect(corps).not.toHaveProperty('salesMonth')
    expect(corps).not.toHaveProperty('transactionsMonth')
    expect(corps).not.toHaveProperty('salesMonthTrend')
  })

  it('le jour garde ses propres champs, inchangés', async () => {
    const { corps } = await appeler()
    expect(corps.salesToday).toBe(1200)
    expect(corps.transactionsToday).toBe(3)
    expect(corps.salesTodayTrend).toBe(20)
  })
})
