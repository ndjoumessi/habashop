import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXPENSE_CATEGORIES, isExpenseCategory } from '../lib/expenseCategories'

/**
 * BUDGETS DE DÉPENSE PERSISTÉS.
 *
 * ─── CE QUI EST GARDÉ ────────────────────────────────────────────────────────
 * ① le DOMAINE : une catégorie inconnue est REFUSÉE, pas filtrée en silence ;
 * ② la PORTÉE : l'écriture vise la boutique ACTIVE, jamais celle du JWT ;
 * ③ la TRACE : un changement de budget laisse un AVANT → APRÈS ;
 * ④ le JUMEAU : la liste de catégories du back == celle du front.
 */

/* ── Prisma mocké, avec un état en mémoire qui APPLIQUE les filtres ───────────
   ⚠️ Un `mockResolvedValue([...])` rendrait la même liste quel que soit le `where`
   reçu : le test resterait VERT si la route cessait d'envoyer `tenantId`. Ici le
   faux `findMany` filtre réellement, donc une fuite inter-boutiques rougit.        */
type Ligne = { tenantId: string; category: string; amount: number }
let table: Ligne[] = []
const audits: { action: string; description: string; tenantId: string }[] = []

const db = {
  expenseBudget: {
    findMany: vi.fn(async ({ where }: { where: { tenantId: string } }) =>
      table.filter(l => l.tenantId === where.tenantId).map(l => ({ category: l.category, amount: l.amount }))),
    upsert: vi.fn(async ({ where, create, update }: {
      where: { tenantId_category: { tenantId: string; category: string } }
      create: Ligne; update: { amount: number }
    }) => {
      const { tenantId, category } = where.tenantId_category
      const i = table.findIndex(l => l.tenantId === tenantId && l.category === category)
      if (i >= 0) table[i] = { ...table[i], amount: update.amount }
      else table.push({ ...create })
      return table.find(l => l.tenantId === tenantId && l.category === category)!
    }),
  },
  auditLog: {
    create: vi.fn(async ({ data }: { data: { action: string; description: string; tenantId: string } }) => {
      audits.push(data); return data
    }),
  },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
}
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))

/** Boutique ACTIVE ≠ boutique du JWT : c'est ce que la route doit respecter. */
const TENANT_JWT = 'boutique-origine'
const TENANT_ACTIF = 'boutique-active'

vi.mock('../middleware/authenticate', () => ({
  authenticate: vi.fn(async (request: Record<string, unknown>) => {
    request.user = { userId: 'u1', tenantId: TENANT_JWT, role: 'ADMIN' }
    request.tenantId = TENANT_ACTIF
  }),
}))

async function monter(): Promise<FastifyInstance> {
  const { expenseBudgetRoutes } = await import('../routes/expenseBudgets')
  const { validatorCompiler } = await import('fastify-type-provider-zod')
  const app = Fastify()
  // ⚠️ Obligatoire : sans lui, Ajv reçoit un schéma zod et casse (« schema is invalid »).
  app.setValidatorCompiler(validatorCompiler)
  await app.register(expenseBudgetRoutes)
  await app.ready()
  return app
}

beforeEach(() => { table = []; audits.length = 0; vi.clearAllMocks() })

describe('GET /api/expense-budgets', () => {
  it('⚠️ rend TOUTES les catégories, à zéro quand rien n’est posé', async () => {
    // Un dictionnaire partiel obligerait chaque appelant à inventer un défaut — et
    // c'est exactement d'où venaient les littéraux codés en dur du front.
    const app = await monter()
    const r = await app.inject({ method: 'GET', url: '/api/expense-budgets' })
    expect(r.statusCode).toBe(200)
    const { budgets } = r.json()
    expect(Object.keys(budgets).sort()).toEqual([...EXPENSE_CATEGORIES].sort())
    for (const c of EXPENSE_CATEGORIES) expect(budgets[c]).toBe(0)
  })

  it('⚠️ ne lit QUE la boutique active — pas celle du JWT, pas les autres', async () => {
    table = [
      { tenantId: TENANT_ACTIF, category: 'Loyer', amount: 500_000 },
      { tenantId: TENANT_JWT,   category: 'Loyer', amount: 111_111 },
      { tenantId: 'une-autre',  category: 'Loyer', amount: 999_999 },
    ]
    const app = await monter()
    const { budgets } = (await app.inject({ method: 'GET', url: '/api/expense-budgets' })).json()
    expect(budgets.Loyer).toBe(500_000)
  })
})

describe('PUT /api/expense-budgets', () => {
  const corps = (budgets: Record<string, number>) => ({ method: 'PUT' as const, url: '/api/expense-budgets', payload: { budgets } })

  it('enregistre, puis relit la même chose', async () => {
    const app = await monter()
    const r = await app.inject(corps({ Loyer: 300_000, Marketing: 50_000 }))
    expect(r.statusCode).toBe(200)
    expect(r.json().budgets.Loyer).toBe(300_000)

    const relu = (await app.inject({ method: 'GET', url: '/api/expense-budgets' })).json()
    expect(relu.budgets.Loyer).toBe(300_000)
    expect(relu.budgets.Marketing).toBe(50_000)
    expect(relu.budgets.Transport, 'non touchée → reste à zéro').toBe(0)
  })

  it('⚠️ écrit sur la boutique ACTIVE, jamais sur celle du JWT', async () => {
    const app = await monter()
    await app.inject(corps({ Loyer: 300_000 }))
    expect(table.some(l => l.tenantId === TENANT_ACTIF && l.amount === 300_000)).toBe(true)
    expect(table.some(l => l.tenantId === TENANT_JWT), 'fuite vers la boutique du JWT').toBe(false)
  })

  it('est IDEMPOTENT — deux envois ne créent pas deux lignes', async () => {
    const app = await monter()
    await app.inject(corps({ Loyer: 300_000 }))
    await app.inject(corps({ Loyer: 300_000 }))
    expect(table.filter(l => l.category === 'Loyer')).toHaveLength(1)
  })

  it('⚠️ REFUSE une catégorie inconnue en 400 — jamais un filtrage silencieux', async () => {
    // Répondre 200 en ignorant la clé ferait croire à un enregistrement qui n'a pas
    // eu lieu : le défaut même qu'on vient de fermer côté écran.
    const app = await monter()
    const r = await app.inject(corps({ Crypto: 1_000 }))
    expect(r.statusCode).toBe(400)
    expect(r.json().code).toBe('UNKNOWN_EXPENSE_CATEGORY')
    expect(table, 'rien ne doit avoir été écrit').toHaveLength(0)
  })

  it('refuse un montant négatif (zod) et n’écrit rien', async () => {
    const app = await monter()
    const r = await app.inject(corps({ Loyer: -5 }))
    expect(r.statusCode).toBe(400)
    expect(table).toHaveLength(0)
  })

  it('refuse une clé hors « budgets » (strict) — anti mass-assignment', async () => {
    const app = await monter()
    const r = await app.inject({
      method: 'PUT', url: '/api/expense-budgets',
      payload: { budgets: { Loyer: 1 }, tenantId: 'boutique-pirate' },
    })
    expect(r.statusCode).toBe(400)
  })
})

describe('trace d’audit', () => {
  it('⚠️ consigne AVANT → APRÈS des seules catégories qui ont bougé', async () => {
    table = [{ tenantId: TENANT_ACTIF, category: 'Loyer', amount: 500_000 }]
    const app = await monter()
    await app.inject({ method: 'PUT', url: '/api/expense-budgets', payload: { budgets: { Loyer: 300_000 } } })

    expect(audits).toHaveLength(1)
    expect(audits[0].action).toBe('EXPENSE_BUDGET_CHANGE')
    expect(audits[0].tenantId).toBe(TENANT_ACTIF)
    const d = JSON.parse(audits[0].description)
    expect(d.Loyer, '« le budget a changé » ne permettrait rien de reconstituer')
      .toEqual({ avant: 500_000, apres: 300_000 })
    expect(Object.keys(d), 'seules les catégories modifiées').toEqual(['Loyer'])
  })

  it('⚠️ n’écrit AUCUNE trace quand rien ne change', async () => {
    table = [{ tenantId: TENANT_ACTIF, category: 'Loyer', amount: 500_000 }]
    const app = await monter()
    await app.inject({ method: 'PUT', url: '/api/expense-budgets', payload: { budgets: { Loyer: 500_000 } } })
    expect(audits, 'un journal noyé de non-événements ne se lit plus').toHaveLength(0)
  })

  it('⚠️ la trace ne contient que des catégories et des nombres — aucune PII', async () => {
    const app = await monter()
    await app.inject({ method: 'PUT', url: '/api/expense-budgets', payload: { budgets: { Loyer: 1 } } })
    const d = JSON.parse(audits[0].description)
    for (const [cle, val] of Object.entries(d)) {
      expect(isExpenseCategory(cle), `clé « ${cle} » hors domaine`).toBe(true)
      const v = val as { avant: unknown; apres: unknown }
      expect(typeof v.avant).toBe('number')
      expect(typeof v.apres).toBe('number')
    }
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
   JUMEAU — la liste du back doit être celle du front
   ══════════════════════════════════════════════════════════════════════════════ */

describe('domaine partagé front ↔ back', () => {
  /**
   * ⚠️ LU À L'EXÉCUTION, jamais par `import`. Le contexte Docker du backend est
   * `apps/backend` SEUL : `docs/` n'y est pas. Un import statique compilerait en
   * local puis casserait le déploiement Railway en TS2307 — invisible pour tsc,
   * pour la suite ET pour la revue.
   */
  const fixture = JSON.parse(readFileSync(
    join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'expense-categories.json'),
    'utf8',
  )) as { categories: string[] }

  it('⚠️ le scan LIT vraiment la fixture', () => {
    expect(fixture.categories.length).toBeGreaterThan(4)
    expect(fixture.categories).toContain('Loyer')
  })

  it('la liste backend est EXACTEMENT celle de la fixture', () => {
    expect([...EXPENSE_CATEGORIES]).toEqual(fixture.categories)
  })

  it('isExpenseCategory accepte le domaine et RIEN d’autre', () => {
    for (const c of fixture.categories) expect(isExpenseCategory(c)).toBe(true)
    for (const faux of ['Crypto', 'loyer', 'LOYER', '', 'Énergie ', null, 42, {}]) {
      expect(isExpenseCategory(faux), `« ${String(faux)} » ne doit pas passer`).toBe(false)
    }
  })
})
