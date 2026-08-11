import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler, hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

/**
 * FIN DE CONTRAT — le champ qui existait partout SAUF là où on l'écrit.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * `Employee.endAt` est en base depuis des mois, `GET /api/employees` le renvoie,
 * l'onglet Contrats en dérive son alerte d'échéance et la modale offre un champ
 * de saisie. Deux maillons manquaient, et ils suffisaient à tout annuler :
 *   • `EMPLOYEE_FIELDS` (`schemas/writesB.ts`) ne portait pas la clé ;
 *   • le handler ne la lisait ni ne l'écrivait.
 * MESURÉ en production le 2026-08-09 : les 5 employés de `demo-tenant-001` ont
 * `endAt: null`, Aminata Touré comprise — un CDD sans date de fin.
 *
 * ─── CE QUE CE FICHIER GARDE, ET QUE LE VERROU FRONT NE PEUT PAS GARDER ───────
 * `hrEmployeeMapping.test.ts` relit `EMPLOYEE_FIELDS` à l'exécution : il prouve que
 * la clé est ACCEPTÉE. Il ne peut rien dire de ce que le handler en fait — un zod
 * ouvert sur un handler qui ignore le champ redonne exactement le défaut d'origine,
 * sous un verrou vert. Ici on assert sur ce qui atteint PRISMA.
 */
const { db } = vi.hoisted(() => ({
  db: { employee: { create: vi.fn(), update: vi.fn() } },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => { req.user = { role: 'ADMIN', tenantId: 'MINE', userId: 'u1' }; req.tenantId = 'MINE' },
}))

import { employeeRoutes } from '../routes/employees'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setErrorHandler((error: any, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) return reply.code(400).send({ error: 'invalid', code: 'VALIDATION' })
    return reply.code(error?.statusCode ?? 500).send({ error: error?.message ?? 'Erreur serveur' })
  })
  await app.register(employeeRoutes)
  await app.ready()
  return app
}

beforeEach(() => vi.clearAllMocks())

/** Données réellement transmises à Prisma par le dernier appel — c'est le seul juge. */
const dataDe = (m: { mock: { calls: any[][] } }) => m.mock.calls[0][0].data

describe('POST /api/employees — la date de fin est ÉCRITE', () => {
  it('une chaîne ISO devient une vraie Date en base', async () => {
    db.employee.create.mockResolvedValue({ id: 'e1' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST', url: '/api/employees',
      payload: { name: 'Aminata Touré', type: 'CDD', endAt: '2026-12-31T00:00:00.000Z' },
    })
    expect(res.statusCode).toBe(200)
    const d = dataDe(db.employee.create)
    expect(d.endAt).toBeInstanceOf(Date)
    expect((d.endAt as Date).toISOString()).toBe('2026-12-31T00:00:00.000Z')
  })

  it('⚠️ absente, elle reste `null` — JAMAIS la date du jour', async () => {
    // Asymétrie voulue avec `hiredAt`, qui retombe sur aujourd'hui : une embauche a
    // forcément eu lieu, une échéance n'existe que si quelqu'un l'a fixée. Dater un CDI
    // inventerait une fin de contrat — la famille « défaut qui se fait passer pour une
    // mesure », sur un champ qui déclenche une alerte d'échéance.
    db.employee.create.mockResolvedValue({ id: 'e2' })
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/api/employees', payload: { name: 'Kofi', type: 'CDI' } })
    const d = dataDe(db.employee.create)
    expect(d.endAt).toBeNull()
    // Contrôle positif du témoin : `hiredAt`, lui, EST daté par défaut. Sans lui, l'assertion
    // ci-dessus serait vraie d'un handler qui aurait cessé d'écrire quoi que ce soit.
    expect(d.hiredAt).toBeInstanceOf(Date)
  })
})

describe('PUT /api/employees/:id — la date de fin est MODIFIABLE, et EFFAÇABLE', () => {
  it('une date transmise est écrite', async () => {
    db.employee.update.mockResolvedValue({ id: 'e1' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT', url: '/api/employees/e1', payload: { endAt: '2027-06-30T00:00:00.000Z' },
    })
    expect(res.statusCode).toBe(200)
    expect((dataDe(db.employee.update).endAt as Date).toISOString()).toBe('2027-06-30T00:00:00.000Z')
    // Le scope tenant reste au `where` — un PUT ne doit pas devenir un chemin cross-tenant.
    expect(db.employee.update.mock.calls[0][0].where).toEqual({ id: 'e1', tenantId: 'MINE' })
  })

  it('⚠️ `null` EFFACE l’échéance — c’est la requalification d’un CDD en CDI', async () => {
    db.employee.update.mockResolvedValue({ id: 'e1' })
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/employees/e1', payload: { endAt: null } })
    expect(res.statusCode).toBe(200)
    const d = dataDe(db.employee.update)
    expect('endAt' in d, 'la clé doit être PRÉSENTE, sinon rien n’est effacé').toBe(true)
    expect(d.endAt).toBeNull()
  })

  it('⚠️ NON TRANSMISE, elle n’est PAS touchée — `null` et `undefined` ne sont pas la même chose', async () => {
    // La distinction porte tout : une modale qui ne parle pas de contrat (changement de
    // téléphone) effacerait l'échéance de tous les CDD si l'absence valait effacement.
    db.employee.update.mockResolvedValue({ id: 'e1' })
    const app = await buildApp()
    await app.inject({ method: 'PUT', url: '/api/employees/e1', payload: { phone: '+221771234567' } })
    const d = dataDe(db.employee.update)
    expect('endAt' in d).toBe(false)
    expect(d.phone).toBe('+221771234567')   // témoin : le corps a bien été traité
  })

  it('une chaîne VIDE efface aussi — le front n’envoie jamais `\'\'`, le serveur ne s’y fie pas', async () => {
    // `new Date('')` est `Invalid Date` : sans ce repli, un appelant direct (mobile, curl,
    // futur écran) obtiendrait un 500 au lieu d'un effacement.
    db.employee.update.mockResolvedValue({ id: 'e1' })
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: '/api/employees/e1', payload: { endAt: '' } })
    expect(res.statusCode).toBe(200)
    expect(dataDe(db.employee.update).endAt).toBeNull()
  })
})
