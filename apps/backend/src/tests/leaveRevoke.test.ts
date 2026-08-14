import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

/**
 * UNE DEMANDE QUI CESSE D'ÊTRE APPROUVÉE REND LE PLANNING.
 *
 * Décision de produit de Nelson (2026-08-14). Jusque-là `applyApprovedLeaveSideEffects`
 * marquait le jour (un `Shift` `leave`, une `Attendance` `LEAVE`) et RIEN ne démarquait :
 * `DELETE /:id` retirait la demande en laissant le planning afficher un congé sans
 * demande derrière. MESURÉ sur `e2e-tenant` : après une purge complète, une seule
 * exécution de la suite E2E ramenait 3 shifts et 3 présences orphelins.
 *
 * ⚠️ TROIS CHEMINS, PAS UN. Supprimer, refuser un congé DÉJÀ APPROUVÉ, et déplacer les
 * dates d'un congé approuvé produisent le même écran faux. Ne traiter que `DELETE`
 * aurait déplacé le défaut.
 */

const { db } = vi.hoisted(() => ({
  db: {
    leaveRequest: { findFirst: vi.fn(), delete: vi.fn(), update: vi.fn() },
    shift:        { deleteMany: vi.fn(), upsert: vi.fn() },
    attendance:   { deleteMany: vi.fn(), upsert: vi.fn() },
  },
}))
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: Record<string, unknown>) => {
    req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }
    req.tenantId = 'T1'
  },
}))

import { leaveRequestRoutes } from '../routes/leaveRequests'

async function build() {
  const app = Fastify()
  await app.register(leaveRequestRoutes)
  return app
}

const CONGE = { id: 'lr1', employeeId: 'emp1', startDate: '2026-06-01', endDate: '2026-06-03', status: 'APPROVED' }

/** Les jours réellement démarqués, dans l'ordre. */
const joursLiberes = () => db.shift.deleteMany.mock.calls
  .map(c => (c[0] as { where: { date: string } }).where.date)

/**
 * ⚠️ LE MOCK APPLIQUE LA REQUÊTE REÇUE. Un `mockResolvedValue` figé rendrait la même
 * chose pour la relecture de la demande ET pour la recherche « un autre congé
 * couvre-t-il ce jour ? » : le test resterait vert même si le code cessait de poser la
 * seconde question, c'est-à-dire précisément le cas qui compte.
 */
/** La forme des `where` que les deux appels produisent — typée, pour que le mock ne
 *  puisse pas lire un champ que le code n'envoie pas. */
type OuConge = {
  id?: string | { not: string }
  employeeId?: string
  status?: string
  startDate?: { lte: string }
  endDate?: { gte: string }
}

function avecCongés(conges: Array<Record<string, unknown>>) {
  db.leaveRequest.findFirst.mockImplementation(async (a: { where: OuConge; select?: unknown }) => {
    const w = a.where
    // Relecture par identifiant (les routes) — pas de filtre de statut ni de dates.
    if (typeof w.id === 'string') return conges.find(c => c.id === w.id) ?? null
    const exclu = typeof w.id === 'object' ? w.id.not : undefined
    // Recherche de RECOUVREMENT (la révocation) : un autre congé approuvé du même
    // employé couvre-t-il ce jour ? Le mock rejoue la comparaison lexicographique de
    // chaînes ISO, exactement comme Postgres sur ces colonnes `String`.
    return conges.find(c =>
      c.employeeId === w.employeeId
      && c.status === w.status
      && c.id !== exclu
      && String(c.startDate) <= String(w.startDate?.lte)
      && String(c.endDate) >= String(w.endDate?.gte),
    ) ?? null
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  db.leaveRequest.delete.mockResolvedValue({})
  db.leaveRequest.update.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ ...CONGE, ...a.data }))
  db.shift.deleteMany.mockResolvedValue({ count: 1 })
  db.attendance.deleteMany.mockResolvedValue({ count: 1 })
  db.shift.upsert.mockResolvedValue({})
  db.attendance.upsert.mockResolvedValue({})
})

describe('SUPPRESSION d’un congé approuvé', () => {
  it('libère CHAQUE jour couvert — shift `leave` et présence `LEAVE`', async () => {
    avecCongés([{ ...CONGE }])
    const app = await build()
    const res = await app.inject({ method: 'DELETE', url: '/api/leave-requests/lr1' })

    expect(res.statusCode, res.body).toBe(200)
    expect(joursLiberes()).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
    // ⚠️ Le TYPE entre dans le filtre : un shift ordinaire ce jour-là n'est pas à nous.
    expect(db.shift.deleteMany.mock.calls[0][0]).toEqual({
      where: { tenantId: 'T1', employeeId: 'emp1', date: '2026-06-01', shiftTypeKey: 'leave' },
    })
    expect(db.attendance.deleteMany.mock.calls[0][0]).toEqual({
      where: { tenantId: 'T1', employeeId: 'emp1', date: '2026-06-01', status: 'LEAVE' },
    })
  })

  it('⚠️ un congé NON approuvé ne démarque RIEN — il n’avait rien marqué', async () => {
    avecCongés([{ ...CONGE, status: 'PENDING' }])
    const app = await build()
    await app.inject({ method: 'DELETE', url: '/api/leave-requests/lr1' })

    expect(db.shift.deleteMany).not.toHaveBeenCalled()
    expect(db.attendance.deleteMany).not.toHaveBeenCalled()
  })

  it('⚠️ LE CAS DÉCISIF — un AUTRE congé approuvé couvre les mêmes jours : on ne démarque pas', async () => {
    // C'était EXACTEMENT le résidu purgé sur `e2e-tenant` : deux demandes identiques.
    // Démarquer en retirant la première effacerait un congé que la seconde justifie.
    avecCongés([{ ...CONGE }, { ...CONGE, id: 'lr2' }])
    const app = await build()
    await app.inject({ method: 'DELETE', url: '/api/leave-requests/lr1' })

    expect(joursLiberes()).toEqual([])
    expect(db.attendance.deleteMany).not.toHaveBeenCalled()
  })

  it('DISCRIMINANT — le recouvrement est jugé JOUR PAR JOUR, pas en tout ou rien', async () => {
    // Un autre congé ne couvrant que le 02 : les 01 et 03 doivent être libérés, pas lui.
    avecCongés([{ ...CONGE }, { ...CONGE, id: 'lr2', startDate: '2026-06-02', endDate: '2026-06-02' }])
    const app = await build()
    await app.inject({ method: 'DELETE', url: '/api/leave-requests/lr1' })

    expect(joursLiberes()).toEqual(['2026-06-01', '2026-06-03'])
  })
})

describe('REFUS d’un congé — le jumeau de la suppression', () => {
  it('un congé APPROUVÉ puis refusé libère le planning', async () => {
    avecCongés([{ ...CONGE }])
    const app = await build()
    const res = await app.inject({ method: 'POST', url: '/api/leave-requests/lr1/refuse' })

    expect(res.statusCode, res.body).toBe(200)
    expect(joursLiberes()).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })

  it('refuser une demande EN ATTENTE ne touche à rien', async () => {
    avecCongés([{ ...CONGE, status: 'PENDING' }])
    const app = await build()
    await app.inject({ method: 'POST', url: '/api/leave-requests/lr1/refuse' })

    expect(db.shift.deleteMany).not.toHaveBeenCalled()
  })
})

describe('DÉPLACEMENT des dates — le chemin le moins visible', () => {
  it('l’ANCIENNE plage est libérée et la NOUVELLE marquée, dans cet ordre', async () => {
    // Sans ça, le congé s'affiche là où il n'est plus, et pas là où il est.
    avecCongés([{ ...CONGE }])
    const app = await build()
    const res = await app.inject({
      method: 'PATCH', url: '/api/leave-requests/lr1',
      payload: { startDate: '2026-06-10', endDate: '2026-06-11' },
    })

    expect(res.statusCode, res.body).toBe(200)
    expect(joursLiberes()).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
    expect(db.shift.upsert.mock.calls.map(c => (c[0] as { create: { date: string } }).create.date))
      .toEqual(['2026-06-10', '2026-06-11'])
    // ⚠️ ORDRE : révoquer APRÈS avoir ré-appliqué effacerait les jours communs aux deux
    // plages. On vérifie que la dernière suppression précède la première pose.
    const finRevoke = db.shift.deleteMany.mock.invocationCallOrder.at(-1) as number
    const debutApply = db.shift.upsert.mock.invocationCallOrder[0]
    expect(finRevoke).toBeLessThan(debutApply)
  })

  it('⚠️ un PATCH qui ne change PAS les dates ne remue rien', async () => {
    // Corriger un motif ou un libellé ne doit pas reconstruire le planning : ce serait
    // des écritures pour rien, et une occasion d'effacer ce qu'un autre congé justifie.
    avecCongés([{ ...CONGE }])
    const app = await build()
    await app.inject({ method: 'PATCH', url: '/api/leave-requests/lr1', payload: { reason: 'motif corrigé' } })

    expect(db.shift.deleteMany).not.toHaveBeenCalled()
    expect(db.shift.upsert).not.toHaveBeenCalled()
  })
})
