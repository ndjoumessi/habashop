import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * Bulletins de paie PERSISTÉS — preuve comportementale sur les vraies routes.
 *
 * Avant, les statuts vivaient dans un `useState` de `Payroll.tsx` : un gérant marquait des
 * salaires « PAYÉ », rafraîchissait, et tout revenait à « EN ATTENTE ». On ne savait plus qui
 * avait été payé.
 *
 * ⚠️ Le point le plus important ici est l'INSTANTANÉ GELÉ. Un bulletin fige ses montants à la
 * génération ; une augmentation ultérieure ne doit pas réécrire une paie passée. C'est
 * l'INVERSE de la règle Abonnements (« au tarif du jour ») — donc exactement le genre de
 * décision qu'un futur lecteur « corrigerait » de bonne foi. D'où un test dédié.
 */

const OWNER = 'T1'
const AUTRE = 'T2'
let role = 'ADMIN'

type Row = Record<string, unknown>
let payrolls: Row[] = []
let employees: Row[] = []
let seq = 0

const { mocks } = vi.hoisted(() => ({ mocks: { audit: { create: (..._a: unknown[]) => Promise.resolve({}) } } }))

vi.mock('../db', () => ({
  prisma: {
    employee: {
      findMany: vi.fn(async ({ where }: { where: Row }) =>
        employees.filter(e => e.tenantId === where.tenantId && e.isActive === where.isActive)),
    },
    payroll: {
      findMany: vi.fn(async ({ where }: { where: Row }) =>
        payrolls.filter(p => p.tenantId === where.tenantId && (where.month === undefined || p.month === where.month))
          .sort((a, b) => String(a.employeeName).localeCompare(String(b.employeeName)))),
      // ⚠️ le mock APPLIQUE `skipDuplicates` sur la clé (tenantId, employeeId, month) —
      // un mock qui ignorerait ce contrat resterait vert même si la route dupliquait.
      createMany: vi.fn(async ({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) => {
        let count = 0
        for (const d of data) {
          const exists = payrolls.some(p => p.tenantId === d.tenantId && p.employeeId === d.employeeId && p.month === d.month)
          if (exists && skipDuplicates) continue
          if (exists) throw Object.assign(new Error('Unique constraint'), { code: 'P2002' })
          payrolls.push({ id: `pay${++seq}`, paidAt: null, ...d })
          count++
        }
        return { count }
      }),
      findFirst: vi.fn(async ({ where }: { where: Row }) =>
        payrolls.find(p => p.id === where.id && (where.tenantId === undefined || p.tenantId === where.tenantId)) ?? null),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const r = payrolls.find(p => p.id === where.id)
        if (!r) throw Object.assign(new Error('not found'), { code: 'P2025' })
        Object.assign(r, data)
        return r
      }),
    },
    auditLog: mocks.audit,
    tenant: { findUnique: vi.fn(async () => null) },
  },
}))
vi.mock('../redis', () => ({ redis: null }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (request: Record<string, unknown>) => {
    request.user = { userId: 'u1', tenantId: OWNER, role }
    request.tenantId = OWNER
  },
}))
vi.mock('../services/payrollReport', () => ({
  buildPayrollReport: vi.fn(), deliverPayrollReport: vi.fn(),
}))

import { payrollRoutes } from '../routes/payroll'
import { payrollNet } from '../utils/payroll'

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler) // routes à `schema` zod — sinon Ajv casse
  await app.register(payrollRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  role = 'ADMIN'
  seq = 0
  payrolls = []
  employees = [
    { id: 'e1', tenantId: OWNER, name: 'Awa Diop',   role: 'Caissière', salary: 150000, isActive: true, deletedAt: null },
    { id: 'e2', tenantId: OWNER, name: 'Bakary Sy',  role: 'Vendeur',   salary: 120000, isActive: true, deletedAt: null },
    { id: 'e3', tenantId: OWNER, name: 'Inactif',    role: 'Vendeur',   salary: 99000,  isActive: false, deletedAt: null },
    { id: 'x1', tenantId: AUTRE, name: 'Chez Autre', role: 'Manager',   salary: 500000, isActive: true, deletedAt: null },
  ]
})

describe('POST /api/payroll/generate', () => {
  it('crée un bulletin par employé ACTIF, en figeant les montants', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.created).toBe(2)                       // e3 est inactif → exclu
    expect(body.rows.map((r: Row) => r.employeeName)).toEqual(['Awa Diop', 'Bakary Sy'])
    expect(body.rows[0].baseSalary).toBe(150000)
    expect(body.rows[0].net).toBe(payrollNet({ baseSalary: 150000, bonus: 0, overtime: 0, deductions: 0, absences: 0 }))
    expect(body.rows[0].status).toBe('GÉNÉRÉ')
  })

  it("n'inclut JAMAIS un employé d'un autre tenant", async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })
    expect(res.json().rows.some((r: Row) => r.employeeName === 'Chez Autre')).toBe(false)
  })

  it('IDEMPOTENT — rejouer ne duplique pas et ne recrée rien', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })
    const res2 = await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })
    expect(res2.json().created).toBe(0)
    expect(res2.json().rows).toHaveLength(2)
    expect(payrolls).toHaveLength(2)
  })

  it('⚠️ INSTANTANÉ GELÉ — une augmentation POSTÉRIEURE ne réécrit pas le bulletin', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })
    const avant = payrolls.find(p => p.employeeId === 'e1')!.baseSalary
    expect(avant).toBe(150000)

    // L'employé est augmenté, puis on rejoue « Générer » (geste banal du mois suivant).
    employees.find(e => e.id === 'e1')!.salary = 400000
    await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })

    // Le bulletin de JUILLET garde le salaire de juillet. Sans ça, la paie passée serait
    // irrécupérable et l'export comptable mentirait rétroactivement.
    expect(payrolls.find(p => p.employeeId === 'e1')!.baseSalary).toBe(150000)

    // …et un mois NEUF, lui, prend bien le nouveau salaire.
    await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-08' } })
    const aout = payrolls.find(p => p.employeeId === 'e1' && p.month === '2026-08')!
    expect(aout.baseSalary).toBe(400000)
  })

  it('un mois déjà PAYÉ n’est pas réécrit par un second « Générer »', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })
    const id = payrolls[0].id
    await app.inject({ method: 'PATCH', url: `/api/payroll/${id}`, payload: { status: 'PAYÉ' } })

    employees.find(e => e.id === 'e1')!.salary = 999999
    await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })

    const apres = payrolls.find(p => p.id === id)!
    expect(apres.status).toBe('PAYÉ')       // statut préservé
    expect(apres.baseSalary).toBe(150000)   // montant préservé
  })
})

describe('clé de mois — le libellé d’affichage est REFUSÉ', () => {
  it.each([
    ['Juillet 2026', 'libellé FR de l’écran'],
    ['July 2026',    'libellé EN'],
    ['2026-13',      'mois inexistant'],
    ['2026-7',       'mois non zéro-paddé'],
  ])('POST generate rejette %s (%s) en 400', async (month) => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month } })
    expect(res.statusCode).toBe(400)
    expect(payrolls).toHaveLength(0) // aucune écriture
  })

  it('GET rejette aussi un libellé', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/payroll?month=Juillet%202026' })
    expect(res.statusCode).toBe(400)
  })
})

describe('PATCH /api/payroll/:id', () => {
  it('marque PAYÉ et pose `paidAt` CÔTÉ SERVEUR', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })
    const id = payrolls[0].id
    const res = await app.inject({ method: 'PATCH', url: `/api/payroll/${id}`, payload: { status: 'PAYÉ' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('PAYÉ')
    expect(res.json().paidAt).toBeTruthy()
  })

  it('repasser hors PAYÉ EFFACE `paidAt` (pas de date de versement qui n’a pas eu lieu)', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })
    const id = payrolls[0].id
    await app.inject({ method: 'PATCH', url: `/api/payroll/${id}`, payload: { status: 'PAYÉ' } })
    const res = await app.inject({ method: 'PATCH', url: `/api/payroll/${id}`, payload: { status: 'SUSPENDU' } })
    expect(res.json().paidAt).toBeNull()
  })

  it('un statut hors liste est rejeté en 400', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })
    const res = await app.inject({ method: 'PATCH', url: `/api/payroll/${payrolls[0].id}`, payload: { status: 'ANNULÉ' } })
    expect(res.statusCode).toBe(400)
  })

  it('CROSS-TENANT : bulletin d’un autre tenant → 404, et AUCUNE mutation', async () => {
    payrolls.push({ id: 'autre1', tenantId: AUTRE, employeeId: 'x1', month: '2026-07', status: 'GÉNÉRÉ', employeeName: 'Chez Autre', baseSalary: 500000, net: 500000, paidAt: null })
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/payroll/autre1', payload: { status: 'PAYÉ' } })
    expect(res.statusCode).toBe(404) // 404, jamais 403 : un 403 confirmerait que l'id existe
    expect(payrolls.find(p => p.id === 'autre1')!.status).toBe('GÉNÉRÉ')
  })
})

describe('garde de rôle — miroir de ROLE_PERMISSIONS[\'payroll\'] côté front', () => {
  it.each([['ADMIN'], ['SUPER_ADMIN'], ['MANAGER'], ['ACCOUNTANT'], ['HR']])('%s a accès', async (r) => {
    role = r
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/payroll?month=2026-07' })
    expect(res.statusCode).toBe(200)
  })

  it('CASHIER est refusé (403) — et n’écrit rien', async () => {
    role = 'CASHIER'
    const app = await buildApp()
    expect((await app.inject({ method: 'GET', url: '/api/payroll?month=2026-07' })).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/api/payroll/generate', payload: { month: '2026-07' } })).statusCode).toBe(403)
    expect(payrolls).toHaveLength(0)
  })
})
