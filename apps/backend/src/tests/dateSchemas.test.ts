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

  it('⚠️ LIMITE ASSUMÉE — un NOMBRE est lu comme un horodatage epoch, pas refusé', async () => {
    // `z.coerce.date()` fait `new Date(42.5)` → 1970-01-01T00:00:00.042Z, une date
    // parfaitement valide. C'est le contrat standard de JavaScript, et un client qui
    // envoie des millisecondes epoch est légitime.
    //
    // ⚠️ LE REVERS EST RÉEL : un montant arrivé par erreur dans le champ `date`
    // s'enregistrerait en 1970 au lieu d'être refusé. On l'ÉCRIT plutôt que de le
    // masquer — et on ne resserre pas de soi-même : aucun appelant n'envoie de nombre
    // (le front fait `new Date(x).toISOString()`), et inventer un seuil de plausibilité
    // serait une règle de plus, avec ses propres angles morts. Si ce cas doit devenir
    // un refus, c'est une décision de produit, pas un effet de bord d'un correctif.
    const app = await build(expenseRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/expenses', payload: { ...BASE, date: 42.5 } })
    expect(res.statusCode).toBe(200)
    expect((dateVueParPrisma() as Date).toISOString()).toBe('1970-01-01T00:00:00.042Z')
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
    const res = await app.inject({ method: 'POST', url: '/api/employees', payload: { name: 'Awa', hiredAt: 'hier matin' } })
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

describe('plus aucun champ date en `z.any()`', () => {
  it('la règle est DÉRIVÉE du fichier de schémas, pas d’une liste écrite à la main', async () => {
    // ⚠️ Une liste de champs recopiée ici se périmerait au premier ajout, en silence :
    // le seul symptôme d'un `z.any()` sur une date est un 500 chez l'appelant.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', 'schemas', 'writesB.ts'), 'utf8')
    const lignes = src.split('\n').filter(l => /^\s*\w*[Dd]ate\w*\s*:/.test(l) || /^\s*(hiredAt|endAt)\s*:/.test(l))
    // COUVERTURE : sans ce compte, un motif de recherche cassé rendrait zéro ligne et
    // la règle serait vraie sur du vide.
    expect(lignes.length).toBeGreaterThanOrEqual(3)
    expect(lignes.filter(l => l.includes('z.any()'))).toEqual([])
  })
})
