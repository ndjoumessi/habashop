import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * LES DATES SUR LE FIL — une saisie invalide est un 400, jamais un 500.
 *
 * Défaut MESURÉ le 2026-08-14 sur un tenant jetable, en exerçant la VRAIE route contre
 * la VRAIE base : `POST /api/expenses` avec `date: '2026-08-14'` — une date seule, ce
 * que rend un champ de saisie — passait le `z.any()` et se faisait refuser par Prisma
 * (« premature end of input »). L'appelant recevait **500**. Une erreur de saisie
 * déguisée en panne serveur ne revient pas à l'écran : elle part dans Sentry.
 *
 * ⚠️ CE TEST EXERCE LES ROUTES, PAS LES SCHÉMAS. Asserter sur `EXPENSE_CREATE.parse()`
 * prouverait la règle et non son câblage — or c'est précisément le câblage qui était en
 * cause : le `validatorCompiler` doit REMPLACER le corps pour que la coercition
 * atteigne Prisma. Un test sur le schéma seul resterait vert si on l'oubliait.
 */

const { db } = vi.hoisted(() => ({
  db: {
    expense:  { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn() },
    employee: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    customer: { findFirst: vi.fn() },
    subscription: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    subscriptionItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    // ⚠️ Le PUT passe par une transaction : sans ce mock, le callback n'est jamais
    // appelé et le test serait vert sans avoir rien exercé.
    $transaction: vi.fn(),
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

import { errorHandler } from '../lib/errorHandler'
import { expenseRoutes } from '../routes/expenses'
import { employeeRoutes } from '../routes/employees'
import { subscriptionRoutes } from '../routes/subscriptions'

async function build(routes: unknown) {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  // ⚠️ LE VRAI HANDLER D'ERREUR, celui que `server.ts` branche. C'est LUI qui traduit
  // un échec zod en `{ error, code: 'VALIDATION' }` — sans lui, Fastify rend son
  // `FST_ERR_VALIDATION` brut et le test jugerait un montage qui n'existe nulle part.
  app.setErrorHandler(errorHandler)
  await app.register(routes as never)
  return app
}

const BASE = { label: 'Loyer août', category: 'Loyer', amountHT: 100000, amountTTC: 119250, mode: 'cash' }
/** Ce que Prisma a REÇU comme date, à la création de dépense. */
const dateVueParPrisma = () => (db.expense.create.mock.calls[0]?.[0] as { data: { date: unknown } })?.data.date

beforeEach(() => {
  vi.clearAllMocks()
  db.expense.create.mockResolvedValue({ id: 'e1', label: 'Loyer août', amountTTC: 119250 })
  db.auditLog.create.mockResolvedValue({ id: 'a1' })
  db.employee.create.mockResolvedValue({ id: 'emp1' })
  db.customer.findFirst.mockResolvedValue({ id: 'c1' })
  db.subscription.create.mockResolvedValue({ id: 's1' })
  db.subscription.findFirst.mockResolvedValue({ id: 's1' })
  // La transaction EXÉCUTE son callback avec le client mocké — sinon rien ne s'exerce.
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db))
})

describe('DÉPENSES — la date atteint Prisma sous une forme qu’il accepte', () => {
  it('⚠️ une date SEULE est acceptée et CONVERTIE — c’est le cas qui rendait 500', async () => {
    const app = await build(expenseRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/expenses', payload: { ...BASE, date: '2026-08-14' } })

    expect(res.statusCode, res.body).toBe(200)
    // ⚠️ L'ASSERTION DÉCISIVE porte sur le TYPE reçu par Prisma, pas sur le code HTTP :
    // une chaîne qui passerait la validation sans être convertie referait exactement
    // le même 500 en production, et le test serait vert.
    const d = dateVueParPrisma()
    expect(d).toBeInstanceOf(Date)
    expect((d as Date).toISOString()).toBe('2026-08-14T00:00:00.000Z')
  })

  it('une date ISO complète passe toujours — rien de ce qui marchait ne casse', async () => {
    const app = await build(expenseRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/expenses', payload: { ...BASE, date: '2026-08-14T09:30:00.000Z' } })

    expect(res.statusCode).toBe(200)
    expect((dateVueParPrisma() as Date).toISOString()).toBe('2026-08-14T09:30:00.000Z')
  })

  it('⚠️ une date INVALIDE est un 400, et n’atteint JAMAIS la base', async () => {
    const app = await build(expenseRoutes)
    for (const mauvaise of ['pas une date', '2026-13-45', '', null]) {
      vi.clearAllMocks()
      const res = await app.inject({ method: 'POST', url: '/api/expenses', payload: { ...BASE, date: mauvaise } })
      expect(res.statusCode, `date=${JSON.stringify(mauvaise)} → ${res.statusCode}`).toBe(400)
      expect(JSON.parse(res.body).code).toBe('VALIDATION')
      // Le refus arrive AVANT tout travail : rien n'est écrit, pas même l'audit.
      expect(db.expense.create).not.toHaveBeenCalled()
      expect(db.auditLog.create).not.toHaveBeenCalled()
    }
  })

  it('⚠️ TOUT CE QUI N’EST PAS UNE CHAÎNE est refusé — décision de produit', async () => {
    // `new Date(x)` réussit sur bien plus de choses qu'on ne croit, et rend alors une
    // date ABSURDE plutôt qu'une erreur : 42.5, `true` et `null` donnent tous le
    // 1er janvier 1970. Il aurait été défendable de lire un nombre comme un horodatage
    // epoch — c'est le contrat de JavaScript — mais un MONTANT arrivé par erreur dans
    // le champ `date` se serait alors enregistré en 1970 au lieu d'être refusé. Sur de
    // la comptabilité, une valeur absurde acceptée coûte plus qu'un appel refusé.
    const app = await build(expenseRoutes)
    for (const mauvaise of [42.5, 0, 1786665073366, true, [], { j: 14 }]) {
      vi.clearAllMocks()
      const res = await app.inject({ method: 'POST', url: '/api/expenses', payload: { ...BASE, date: mauvaise } })
      expect(res.statusCode, `date=${JSON.stringify(mauvaise)} → ${res.statusCode}`).toBe(400)
      expect(db.expense.create).not.toHaveBeenCalled()
    }
  })

  it('DISCRIMINANT — le refus vient du TYPE, pas d’un rejet devenu aveugle', async () => {
    // ⚠️ Sans ce cas, une règle qui refuserait TOUT passerait le test ci-dessus en
    // ne gardant plus rien. Les deux formes de chaîne que le produit envoie
    // réellement doivent continuer de passer.
    const app = await build(expenseRoutes)
    for (const bonne of ['2026-08-14', '2026-08-14T09:30:00.000Z']) {
      vi.clearAllMocks()
      db.expense.create.mockResolvedValue({ id: 'e1', label: 'x', amountTTC: 1 })
      db.auditLog.create.mockResolvedValue({ id: 'a1' })
      const res = await app.inject({ method: 'POST', url: '/api/expenses', payload: { ...BASE, date: bonne } })
      expect(res.statusCode, `date=${bonne}`).toBe(200)
      expect(dateVueParPrisma()).toBeInstanceOf(Date)
    }
  })

  it('la MODIFICATION suit la même règle — les deux routes partagent le champ', async () => {
    db.expense.findFirst.mockResolvedValue({ id: 'e1', label: 'X', amountTTC: 1 })
    db.expense.update.mockResolvedValue({ id: 'e1', label: 'X', amountTTC: 1 })
    const app = await build(expenseRoutes)
    expect((await app.inject({ method: 'PUT', url: '/api/expenses/e1', payload: { date: 'n’importe quoi' } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'PUT', url: '/api/expenses/e1', payload: { date: '2026-08-14' } })).statusCode).toBe(200)
  })
})

describe('EMPLOYÉS — resserré aussi, sans casser ce qui marche', () => {
  it('⚠️ `hiredAt` VIDE reste accepté : le handler retombe sur AUJOURD’HUI', async () => {
    // Le refuser transformerait en 400 une embauche sans date saisie, qui fonctionne
    // aujourd'hui. On resserre contre le n'importe-quoi, jamais contre un chemin vivant.
    const app = await build(employeeRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/employees', payload: { name: 'Awa', hiredAt: '' } })
    expect(res.statusCode, res.body).toBe(200)
    const d = (db.employee.create.mock.calls[0]?.[0] as { data: { hiredAt: unknown } })?.data.hiredAt
    expect(d).toBeInstanceOf(Date)
  })

  it('mais une date de n’importe quoi devient un 400 — `new Date(x)` rendait `Invalid Date`', async () => {
    const app = await build(employeeRoutes)
    for (const mauvaise of ['hier matin', 42.5, true]) {
      vi.clearAllMocks()
      const res = await app.inject({ method: 'POST', url: '/api/employees', payload: { name: 'Awa', hiredAt: mauvaise } })
      expect(res.statusCode, `hiredAt=${JSON.stringify(mauvaise)}`).toBe(400)
      expect(db.employee.create).not.toHaveBeenCalled()
    }
  })

  it('⚠️ un NOMBRE dans `endAt` n’est PAS pris pour un effacement', async () => {
    // Le faire retomber sur `null` masquerait une valeur fausse sous une intention
    // (« l'utilisateur a vidé le champ ») — l'échéance disparaîtrait sans que personne
    // ne l'ait demandé. Une valeur qu'on ne sait pas lire se refuse, elle ne s'efface pas.
    const app = await build(employeeRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/employees', payload: { name: 'Awa', endAt: 0 } })
    expect(res.statusCode).toBe(400)
    expect(db.employee.create).not.toHaveBeenCalled()
  })

  it('⚠️ `endAt` reste EFFAÇABLE — `null` ET `\'\'` valent « efface »', async () => {
    // Colonne nullable : vider l'échéance est une intention (CDD requalifié en CDI).
    // Un schéma qui refuserait `null` rendrait la date ineffaçable — le défaut déjà
    // corrigé le 2026-08-11, qu'on ne réintroduit pas en resserrant.
    const app = await build(employeeRoutes)
    for (const vide of [null, '']) {
      vi.clearAllMocks()
      db.employee.create.mockResolvedValue({ id: 'emp1' })
      const res = await app.inject({ method: 'POST', url: '/api/employees', payload: { name: 'Awa', endAt: vide } })
      expect(res.statusCode, `endAt=${JSON.stringify(vide)}`).toBe(200)
      expect((db.employee.create.mock.calls[0]?.[0] as { data: { endAt: unknown } })?.data.endAt).toBeNull()
    }
  })

  it('et une vraie échéance est bien convertie', async () => {
    const app = await build(employeeRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/employees', payload: { name: 'Awa', endAt: '2027-01-31' } })
    expect(res.statusCode).toBe(200)
    const d = (db.employee.create.mock.calls[0]?.[0] as { data: { endAt: unknown } })?.data.endAt
    expect((d as Date).toISOString()).toBe('2027-01-31T00:00:00.000Z')
  })
})

describe('ABONNEMENTS — `startDate`, le jumeau que la méta-règle ne suffisait pas à garder', () => {
  /**
   * ⚠️ POURQUOI CE BLOC EXISTE. `startDate` portait `z.coerce.date().nullish()` : la
   * forme qui laisse passer un NOMBRE et l'enregistre en 1970. Il a été aligné en même
   * temps que les dépenses, mais couvert par la SEULE méta-règle — qui prouve la
   * source, jamais l'application. Le handler fait `startDate: startDate ?? null`, donc
   * ce qui atteint Prisma dépend entièrement du schéma : exactement la configuration
   * où un test de comportement est le seul à pouvoir rougir.
   */
  const SUB = { customerId: 'c1', name: 'Panier hebdo', dayOfWeek: 3, items: [{ productId: 'p1', quantity: 2 }] }
  /** Ce que Prisma a REÇU comme `startDate`. */
  const vueParPrisma = () => (db.subscription.create.mock.calls[0]?.[0] as { data: { startDate: unknown } })?.data.startDate

  it('une date SEULE est acceptée et CONVERTIE', async () => {
    const app = await build(subscriptionRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/subscriptions', payload: { ...SUB, startDate: '2026-08-14' } })

    // 201 : la route d'abonnement rend « Created », là où les dépenses rendent 200.
    expect(res.statusCode, res.body).toBe(201)
    // ⚠️ L'assertion porte sur le TYPE reçu par Prisma : une chaîne validée mais non
    // convertie ferait le même 500 que les dépenses, sous un test vert.
    expect(vueParPrisma()).toBeInstanceOf(Date)
    expect((vueParPrisma() as Date).toISOString()).toBe('2026-08-14T00:00:00.000Z')
  })

  it('⚠️ un NOMBRE est refusé — il s’enregistrait en 1970', async () => {
    const app = await build(subscriptionRoutes)
    for (const mauvaise of [42.5, 0, 1786665073366, true]) {
      vi.clearAllMocks()
      db.customer.findFirst.mockResolvedValue({ id: 'c1' })
      const res = await app.inject({ method: 'POST', url: '/api/subscriptions', payload: { ...SUB, startDate: mauvaise } })
      expect(res.statusCode, `startDate=${JSON.stringify(mauvaise)} → ${res.statusCode}`).toBe(400)
      expect(db.subscription.create).not.toHaveBeenCalled()
    }
  })

  it('⚠️ ABSENTE ou VIDE reste acceptée — « pas de date de début » est le comportement historique', async () => {
    // Colonne `DateTime?`. Refuser `null` casserait la création d'un abonnement sans
    // première livraison datée, qui fonctionne depuis toujours.
    const app = await build(subscriptionRoutes)
    for (const vide of [null, '', undefined]) {
      vi.clearAllMocks()
      db.customer.findFirst.mockResolvedValue({ id: 'c1' })
      db.subscription.create.mockResolvedValue({ id: 's1' })
      const charge: Record<string, unknown> = { ...SUB }
      if (vide !== undefined) charge.startDate = vide
      const res = await app.inject({ method: 'POST', url: '/api/subscriptions', payload: charge })
      expect(res.statusCode, `startDate=${JSON.stringify(vide)}`).toBe(201)
      // ⚠️ `null`, jamais 1970 : c'est tout l'objet de la correction.
      expect(vueParPrisma()).toBeNull()
    }
  })

  it('la MODIFICATION suit la même règle — et la transaction est bien exercée', async () => {
    const app = await build(subscriptionRoutes)
    expect((await app.inject({ method: 'PUT', url: '/api/subscriptions/s1', payload: { startDate: 42.5 } })).statusCode).toBe(400)

    vi.clearAllMocks()
    db.subscription.findFirst.mockResolvedValue({ id: 's1' })
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db))
    const ok = await app.inject({ method: 'PUT', url: '/api/subscriptions/s1', payload: { startDate: '2026-09-01' } })
    expect(ok.statusCode, ok.body).toBe(200)
    // ⚠️ COUVERTURE : sans cette assertion, un `$transaction` qui n'appellerait pas son
    // callback rendrait le test vert sans avoir rien exercé du tout.
    expect(db.subscription.update).toHaveBeenCalled()
    const maj = (db.subscription.update.mock.calls[0]?.[0] as { data: { startDate: unknown } }).data.startDate
    expect(maj).toBeInstanceOf(Date)
    expect((maj as Date).toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })
})

describe('TOUT champ date passe par l’une des trois formes NOMMÉES', () => {
  it('règle DÉRIVÉE du fichier de schémas, jamais d’une liste écrite à la main', async () => {
    // ⚠️ Une liste de champs recopiée ici se périmerait au premier ajout, EN SILENCE :
    // le seul symptôme d'une date mal validée est un 500, ou pire une date de 1970
    // enregistrée sans bruit. La règle se dérive donc des déclarations elles-mêmes.
    //
    // ⚠️ ELLE INTERDIT AUSSI `z.coerce.date()` NU, pas seulement `z.any()`. C'est par là
    // que le jumeau serait revenu : `startDate` (abonnements) portait exactement cette
    // forme, laissait passer un nombre, et l'aurait enregistré en 1970. Corriger les
    // dépenses sans corriger celui-là aurait déplacé le défaut au lieu de le fermer.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', 'schemas', 'writesB.ts'), 'utf8')

    const FORMES = ['DATE_REQUISE', 'DATE_AVEC_REPLI', 'DATE_EFFACABLE']
    const champs = src.split('\n')
      .filter(l => /^\s*(\w*[Dd]ate\w*|hiredAt|endAt)\s*:/.test(l))
      .filter(l => !l.includes('const '))   // les déclarations des formes elles-mêmes

    // COUVERTURE : sans ce compte, un motif de recherche cassé rendrait zéro ligne et
    // la règle serait vraie sur du vide.
    expect(champs.length).toBeGreaterThanOrEqual(5)
    // TÉMOIN POSITIF, dans la même invocation : les champs connus sont bien vus.
    expect(champs.some(l => /^\s*date\s*:/.test(l))).toBe(true)
    expect(champs.some(l => /^\s*startDate\s*:/.test(l))).toBe(true)

    const horsRegle = champs.filter(l => !FORMES.some(f => l.includes(f))).map(l => l.trim())
    expect(horsRegle).toEqual([])
  })
})
