import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * LES SURFACES NOUVELLEMENT AUDITÉES — le CÂBLAGE, pas la règle.
 *
 * `auditDiff.test.ts` prouve l'invariant ; il ne peut RIEN dire de ce que les routes
 * en demandent, ni même de leur EXISTENCE. La leçon est déjà écrite dans ce dépôt :
 * le garde de zone franc avait été posé sur quatre routes et vérifié sur UNE, et deux
 * régressions étaient parties en production dans les trois autres.
 *
 * ⚠️ CE QUI EST JUGÉ ICI EST LE CHOIX DE PRODUIT autant que le code : on audite les
 * changements de CONFIGURATION et d'ARGENT, pas le volume transactionnel. Une vente
 * auditée noierait le reste — la route du journal plafonne à 100 lignes sans filtre de
 * date, donc une boutique à 200 ventes/jour n'aurait plus qu'un journal de ventes, et
 * la suppression de dépense de la semaine dernière serait devenue introuvable.
 */

const { db } = vi.hoisted(() => ({
  db: {
    expense: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    product: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: Record<string, unknown>) => {
    req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }
    req.tenantId = 'T1'
  },
}))

const { auditSpy } = vi.hoisted(() => ({ auditSpy: vi.fn() }))
// ⚠️ On ESPIONNE `writeAudit`, on ne le REMPLACE pas : le mock délègue au module réel.
// Un mock qui avalerait la promesse resterait vert même si `auditLog.create` n'était
// jamais appelé — la pastille qui ne peut pas rougir.
vi.mock('../lib/writeAudit', async (orig) => {
  const reel = await orig<typeof import('../lib/writeAudit')>()
  return { writeAudit: (label: string, write: Promise<unknown>) => { auditSpy(label); return reel.writeAudit(label, write) } }
})

import { expenseRoutes } from '../routes/expenses'
import { productRoutes } from '../routes/products'

async function build(routes: (app: ReturnType<typeof Fastify>) => Promise<void>) {
  const app = Fastify()
  // ⚠️ Sans ce compilateur, Ajv casse sur les schémas zod (« schema is invalid »).
  app.setValidatorCompiler(validatorCompiler)
  await app.register(routes as never)
  return app
}

/** Les entrées d'audit réellement écrites, sous une forme lisible. */
const entrees = () => db.auditLog.create.mock.calls.map((c) => {
  const { data } = c[0] as { data: Record<string, unknown> }
  return {
    tenantId: data.tenantId,
    module: data.module,
    action: data.action,
    desc: JSON.parse(String(data.description)) as Record<string, unknown>,
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  db.auditLog.create.mockResolvedValue({ id: 'a1' })
})

describe('DÉPENSES — l’argent qui sort laisse une trace', () => {
  it('une création consigne le libellé ET le montant', () => {
    // Sans le montant, « Loyer août » n'apprend rien à qui relit le journal.
    db.expense.create.mockResolvedValue({ id: 'e1', label: 'Loyer août', amountTTC: 100000 })
    return build(expenseRoutes).then(app =>
      app.inject({ method: 'POST', url: '/api/expenses', payload: { date: '2026-08-01', label: 'Loyer août', category: 'Loyer', amountHT: 100000, amountTTC: 100000, mode: 'cash' } }),
    ).then(() => {
      expect(entrees()).toEqual([{
        tenantId: 'T1', module: 'expenses', action: 'CREATE_EXPENSE',
        desc: { name: 'Loyer août', amountTTC: { avant: null, apres: 100000 } },
      }])
    })
  })

  it('une modification consigne AVANT → APRÈS, sujet compris', async () => {
    db.expense.findFirst.mockResolvedValue({ id: 'e1', label: 'Loyer août', category: 'Loyer', amountTTC: 100000, status: 'EN ATTENTE' })
    db.expense.update.mockResolvedValue({ id: 'e1', label: 'Loyer août', category: 'Loyer', amountTTC: 120000, status: 'PAYÉ' })
    const app = await build(expenseRoutes)
    await app.inject({ method: 'PUT', url: '/api/expenses/e1', payload: { amountTTC: 120000, status: 'PAYÉ' } })

    expect(entrees()).toEqual([{
      tenantId: 'T1', module: 'expenses', action: 'UPDATE_EXPENSE',
      desc: { name: 'Loyer août', amountTTC: { avant: 100000, apres: 120000 }, status: { avant: 'EN ATTENTE', apres: 'PAYÉ' } },
    }])
  })

  it('⚠️ un enregistrement SANS changement n’écrit RIEN', async () => {
    // C'est le cas MAJORITAIRE quand l'écran renvoie tout son formulaire. Une entrée
    // par enregistrement remplirait à elle seule les 100 lignes du journal.
    const etat = { id: 'e1', label: 'Loyer août', category: 'Loyer', amountTTC: 100000, status: 'PAYÉ' }
    db.expense.findFirst.mockResolvedValue(etat)
    db.expense.update.mockResolvedValue(etat)
    const app = await build(expenseRoutes)
    await app.inject({ method: 'PUT', url: '/api/expenses/e1', payload: { amountTTC: 100000, status: 'PAYÉ' } })

    expect(db.auditLog.create).not.toHaveBeenCalled()
    expect(auditSpy).not.toHaveBeenCalled()
  })

  it('⚠️ une SUPPRESSION est relue AVANT de disparaître — sinon il ne reste rien', async () => {
    // `Expense` n'a pas de `deletedAt` : après le `delete`, l'audit est la SEULE trace.
    db.expense.findFirst.mockResolvedValue({ label: 'Loyer août', amountTTC: 100000 })
    db.expense.delete.mockResolvedValue({})
    const app = await build(expenseRoutes)
    await app.inject({ method: 'DELETE', url: '/api/expenses/e1' })

    const ordre = [db.expense.findFirst, db.expense.delete].map(f => f.mock.invocationCallOrder[0])
    expect(ordre[0], 'la relecture doit précéder la suppression').toBeLessThan(ordre[1])
    expect(entrees()).toEqual([{
      tenantId: 'T1', module: 'expenses', action: 'DELETE_EXPENSE',
      desc: { name: 'Loyer août', amountTTC: { avant: 100000, apres: null } },
    }])
  })

  it('⚠️ la relecture est SCOPÉE AU TENANT, pas au seul identifiant', async () => {
    // Un `findUnique` par id rendrait la ligne d'une AUTRE boutique : `update`
    // refuserait ensuite, mais le journal aurait déjà lu ce qu'il ne devait pas voir.
    db.expense.findFirst.mockResolvedValue({ id: 'e1', label: 'X', amountTTC: 1 })
    db.expense.update.mockResolvedValue({ id: 'e1', label: 'X', amountTTC: 2 })
    const app = await build(expenseRoutes)
    await app.inject({ method: 'PUT', url: '/api/expenses/e1', payload: { amountTTC: 2 } })

    for (const appel of db.expense.findFirst.mock.calls) {
      expect((appel[0] as { where: { tenantId?: string } }).where.tenantId).toBe('T1')
    }
  })
})

describe('PRODUITS — le catalogue et les prix', () => {
  /**
   * ⚠️ LE MOCK APPLIQUE CE QU'ON LUI SOUMET. Un `mockResolvedValue` figé rend le même
   * objet quel que soit le corps reçu : les deux côtés du diff portent alors les mêmes
   * valeurs, et le test reste VERT même si la liste blanche s'élargit à du texte libre.
   * MESURÉ — le sabotage SA4 (ajout de `description` à la liste) est passé au vert sur
   * la première version de ce fichier. Le test décrivait un monde qui n'existe pas.
   */
  const avecProduit = (avant: Record<string, unknown>) => {
    db.product.findFirst.mockResolvedValue(avant)
    db.product.update.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ ...avant, ...a.data }))
  }

  it('une modification de prix consigne le produit ET l’écart', async () => {
    avecProduit({ name: 'Riz local 5kg', sellPrice: 1000, stockQty: 12, isActive: true, description: 'sac de 5 kg' })
    const app = await build(productRoutes)
    await app.inject({ method: 'PUT', url: '/api/products/p1', payload: { sellPrice: 1200 } })

    expect(entrees()).toEqual([{
      tenantId: 'T1', module: 'products', action: 'UPDATE_PRODUCT',
      desc: { name: 'Riz local 5kg', sellPrice: { avant: 1000, apres: 1200 } },
    }])
  })

  it('⚠️ un champ HORS liste blanche ne déclenche AUCUNE entrée', async () => {
    // `description` et `notes` sont du texte libre saisi par le commerçant ; `emoji`
    // est cosmétique. Les consigner remplirait le journal de bruit — et le texte
    // libre est le seul endroit où une donnée personnelle peut arriver.
    avecProduit({ name: 'Riz', sellPrice: 1000, description: 'ancienne', emoji: '📦' })
    const app = await build(productRoutes)
    await app.inject({ method: 'PUT', url: '/api/products/p1', payload: { description: 'texte neuf', emoji: '🍚' } })

    expect(db.auditLog.create).not.toHaveBeenCalled()
  })

  it('⚠️ un stock ramené à ZÉRO est consigné — le piège du `||`', async () => {
    avecProduit({ name: 'Riz', stockQty: 40 })
    const app = await build(productRoutes)
    await app.inject({ method: 'PUT', url: '/api/products/p1', payload: { stockQty: 0 } })

    expect(entrees()[0]?.desc).toEqual({ name: 'Riz', stockQty: { avant: 40, apres: 0 } })
  })

  it('DISCRIMINANT — le mock applique VRAIMENT le corps reçu', async () => {
    // Sans cette preuve, les trois cas ci-dessus pourraient être verts parce que le
    // mock ignore ce qu'on lui envoie, et non parce que le code est juste.
    avecProduit({ name: 'Riz', sellPrice: 1000 })
    const app = await build(productRoutes)
    const r = await app.inject({ method: 'PUT', url: '/api/products/p1', payload: { sellPrice: 4242 } })
    expect(r.json()).toMatchObject({ name: 'Riz', sellPrice: 4242 })
  })
})

describe('CE QU’ON N’AUDITE PAS — décision de produit, pas oubli', () => {
  it('AUCUNE route ne consigne la création d’une VENTE', () => {
    // ⚠️ Règle de FORME sur le source : une vente auditée noierait le journal (100
    // lignes, sans filtre de date côté serveur), et `Sale` porte DÉJÀ tout le détail.
    // Le remboursement, lui, EST audité — c'est le geste qui défait de l'argent.
    // Ce test existe pour que le prochain ajout soit une DÉCISION, pas un réflexe.
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'routes', 'sales.ts'), 'utf8') as string
    const actions = [...src.matchAll(/action:\s*'([A-Z_]+)'/g)].map(m => m[1])
    expect(actions.length, 'le balayage doit trouver au moins une action').toBeGreaterThan(0)
    expect(actions).toContain('REFUND_SALE')
    expect(actions).not.toContain('CREATE_SALE')
  })
})
