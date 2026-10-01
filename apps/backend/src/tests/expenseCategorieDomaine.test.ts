import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { EXPENSE_CATEGORIES } from '../lib/expenseCategories'

/**
 * LE DOMAINE DE `Expense.category`, AU POINT D'ÉCRITURE.
 *
 * ⚠️ POURQUOI MAINTENANT, ALORS QUE J'AVAIS REFUSÉ DE LE FAIRE. L'objection était réelle :
 * poser un enum refuserait en 400 des catégories que des commerçants utilisent peut-être déjà.
 * MESURÉ en production le 2026-10-01 : 7 valeurs distinctes, 6 canoniques, et la seule hors
 * domaine — « Charges », 24 lignes — appartient à DEUX démos jetables issues de mon propre jeu,
 * qui expirent seules. Aucun commerçant réel n'en utilise. *L'objection tombe sur une mesure,
 * pas sur un raisonnement* — et c'est la mesure qui autorise le refus, pas l'inverse.
 *
 * ⚠️ LA PORTE EST LE SCHÉMA, ET ELLE EST UNIQUE. `routes/expenses.ts` passe le corps ENTIER à
 * Prisma (`data: { ...request.body }`) : il n'existe aucune seconde garde dans le handler.
 * `EXPENSE_FIELDS` décide donc seul de ce qui atteint la base — c'est écrit en toutes lettres
 * au-dessus du schéma, et c'est ce qui rend ce test suffisant.
 *
 * ⚠️ CRÉATION *ET* MISE À JOUR. Les deux partagent `EXPENSE_FIELDS`, mais une divergence future
 * est exactement ce qui a laissé deux routes de devise diverger sur la forme du refus. On exerce
 * les DEUX, nommément.
 *
 * ⚠️ CE VERROU NE REMPLACE PAS `styleCategorie()`. Le front continue de rendre un style neutre
 * sur une catégorie inconnue : les 24 lignes « Charges » existent toujours, et une colonne
 * `String` en base restera lisible par d'autres chemins (import, script, version antérieure).
 * *Fermer la porte d'entrée n'efface pas ce qui est déjà entré.*
 */

const creees: Record<string, unknown>[] = []
const db = {
  expense: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { creees.push(data); return { id: 'e1', ...data } }),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { creees.push(data); return { id: 'e1', ...data } }),
    findMany: vi.fn(async () => []),
    findUnique: vi.fn(async () => ({ id: 'e1', tenantId: 't1' })),
    findFirst: vi.fn(async () => ({ id: 'e1', tenantId: 't1' })),
    delete: vi.fn(async () => ({ id: 'e1' })),
    count: vi.fn(async () => 0),
  },
  auditLog: { create: vi.fn(async () => ({})) },
  $transaction: vi.fn(async (ops: unknown) => Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : ops),
}
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: vi.fn(async (request: Record<string, unknown>) => {
    request.user = { userId: 'u1', tenantId: 't1', role: 'ADMIN' }
    request.tenantId = 't1'
  }),
}))

async function monter(): Promise<FastifyInstance> {
  const mod = await import('../routes/expenses')
  const routes = (mod as Record<string, unknown>).expenseRoutes ?? (mod as Record<string, unknown>).default
  const { validatorCompiler } = await import('fastify-type-provider-zod')
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(routes as Parameters<FastifyInstance['register']>[0])
  await app.ready()
  return app
}

const corps = (category: string) => ({
  date: '2026-10-01T08:30:00.000Z', label: 'Loyer boutique', category,
  amountHT: 150000, vat: 18, amountTTC: 177000, mode: 'cash',
})

beforeEach(() => { creees.length = 0; vi.clearAllMocks() })

describe('Expense.category — domaine imposé au point d’écriture', () => {
  it('⚠️ les 8 catégories canoniques passent — témoin positif, sinon on garderait TOUT', async () => {
    const app = await monter()
    for (const c of EXPENSE_CATEGORIES) {
      const r = await app.inject({ method: 'POST', url: '/api/expenses', payload: corps(c) })
      expect(r.statusCode, `« ${c} » doit être acceptée (${r.body})`).toBeLessThan(300)
    }
    expect(creees.length, 'les 8 écritures doivent atteindre la base').toBe(EXPENSE_CATEGORIES.length)
  })

  it('⚠️ « Charges » est REFUSÉE en 400 — la valeur qui a fait tomber l’écran', async () => {
    const app = await monter()
    const r = await app.inject({ method: 'POST', url: '/api/expenses', payload: corps('Charges') })
    expect(r.statusCode).toBe(400)
    // ⚠️ RIEN n'atteint la base : un refus qui écrit quand même serait pire que pas de refus.
    expect(creees, 'aucune écriture sur un refus').toEqual([])
  })

  it('⚠️ et la MISE À JOUR aussi — deux routes, pas une', async () => {
    const app = await monter()
    const r = await app.inject({ method: 'PUT', url: '/api/expenses/e1', payload: { category: 'Crypto' } })
    const r2 = await app.inject({ method: 'PATCH', url: '/api/expenses/e1', payload: { category: 'Crypto' } })
    // L'une des deux méthodes existe ; celle qui existe doit refuser.
    const vues = [r, r2].filter(x => x.statusCode !== 404)
    expect(vues.length, 'au moins une route de mise à jour doit exister').toBeGreaterThan(0)
    for (const x of vues) expect(x.statusCode, `mise à jour : ${x.body}`).toBe(400)
    expect(creees, 'aucune écriture sur un refus').toEqual([])
  })

  it('⚠️ une dépense SANS catégorie reste acceptée — le champ est optionnel, pas requis', async () => {
    const app = await monter()
    const { category: _ignore, ...sansCat } = corps('Loyer')
    const r = await app.inject({ method: 'POST', url: '/api/expenses', payload: sansCat })
    expect(r.statusCode, r.body).toBeLessThan(300)
  })
})
