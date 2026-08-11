import type { FastifyInstance } from 'fastify'
import type { EmployeeBody } from '../types'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { getTenantId } from '../lib/tenantId'
import { ID_PARAMS, EMPLOYEE_CREATE, EMPLOYEE_UPDATE } from '../schemas/writesB'

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/employees', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    return prisma.employee.findMany({ where: { tenantId } })
  })

  app.post('/api/employees', { preHandler: authenticate, schema: { body: EMPLOYEE_CREATE } }, async (request, reply) => {
    const {
      name, role, dept, type, salary,
      phone, email, isActive, color,
      hiredAt, endAt, perf, avatar,
    } = request.body as EmployeeBody

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'Nom requis' })
    }
    const tenantId = getTenantId(request)

    try {
      const emp = await prisma.employee.create({
        data: {
          tenantId,
          name:     name.trim(),
          role:     role     ?? '',
          dept:     dept     ?? 'Ventes',
          type:     type     ?? 'CDI',
          salary:   Number(salary ?? 0),
          phone:    phone    ?? '',
          email:    email    ?? '',
          isActive: isActive !== false,
          color:    color    ?? '#6C47FF',
          avatar:   avatar   ?? name.split(' ').map((n: string) => n[0] ?? '').join('').slice(0, 2).toUpperCase(),
          hiredAt:  hiredAt ? new Date(hiredAt) : new Date(),
          // ⚠️ ASYMÉTRIE VOULUE avec `hiredAt` : une embauche sans date retombe sur AUJOURD'HUI
          // (elle a forcément eu lieu), une fin de contrat sans date reste `null` — l'inventer
          // daterait une échéance que personne n'a fixée, et le CDI n'en a pas.
          endAt:    endAt ? new Date(endAt) : null,
          // ⚠️ `Number(perf ?? 3)` NOTAIT 3 tout nouvel employé — une évaluation que
          // personne n'avait faite, indiscernable d'un vrai 3. `null` = pas encore évalué.
          perf:     perf == null ? null : Number(perf),
        }
      })
      return emp
    } catch (err) {
      console.error('Create employee error:', (err as Error).message)
      return reply.code(500).send({ error: 'Erreur création employé', details: (err as Error).message })
    }
  })

  app.put('/api/employees/:id', { preHandler: authenticate, schema: { params: ID_PARAMS, body: EMPLOYEE_UPDATE } }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const {
      name, role, dept, type, salary,
      phone, email, address, photo, isActive, color,
      hiredAt, endAt, perf,
    } = request.body as EmployeeBody

    try {
      const updated = await prisma.employee.update({
        where: { id, tenantId },
        data: {
          ...(name     !== undefined && { name     }),
          ...(role     !== undefined && { role     }),
          ...(dept     !== undefined && { dept     }),
          ...(type     !== undefined && { type     }),
          ...(salary   !== undefined && { salary: Number(salary) }),
          ...(phone    !== undefined && { phone    }),
          ...(email    !== undefined && { email    }),
          ...(address  !== undefined && { address  }),
          ...(photo    !== undefined && { photo    }),
          ...(isActive !== undefined && { isActive }),
          ...(color    !== undefined && { color    }),
          ...(hiredAt  !== undefined && { hiredAt: new Date(hiredAt) }),
          // ⚠️ `endAt` transmis mais VIDE (`null` ou `''`) EFFACE l'échéance — ce n'est pas
          // une absence de donnée, c'est la seule façon de requalifier un CDD en CDI. La
          // distinction porte sur le `!== undefined` : non transmis ⇒ on n'y touche pas.
          ...(endAt    !== undefined && { endAt: endAt ? new Date(endAt) : null }),
          ...(perf     !== undefined && { perf: Number(perf) }),
        }
      })
      return updated
    } catch (err) {
      console.error('Update employee error:', (err as Error).message)
      return reply.code(500).send({ error: 'Erreur mise à jour employé', details: (err as Error).message })
    }
  })

  app.delete('/api/employees/:id', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    try {
      await prisma.employee.delete({ where: { id, tenantId } })
      return { success: true }
    } catch (err) {
      // ⚠️ Ceci est un HARD delete : les FK vers Employee décident du sort des données liées.
      // Présences, shifts, congés, primes et historique de salaire partent en CASCADE ; les
      // BULLETINS DE PAIE, eux, sont en RESTRICT (`model Payroll`) — ils sont la preuve de ce
      // qui a été versé et ne doivent pas disparaître avec la fiche. La contrainte refuse donc
      // la suppression, et ce refus doit être LISIBLE : un 500 au message Prisma brut ferait
      // conclure à une panne, pas à une règle (et fuiterait du détail interne, cf. § P1.6).
      if ((err as { code?: string }).code === 'P2003') {
        return reply.code(409).send({
          error: "Cet employé a des bulletins de paie : suppression impossible. Désactivez la fiche plutôt que de la supprimer.",
          code: 'EMPLOYEE_HAS_PAYROLL',
        })
      }
      // P2025 : la fiche n'existe pas, ou appartient à une autre boutique (le `where` est
      // scopé) → 404, jamais un 500.
      if ((err as { code?: string }).code === 'P2025') {
        return reply.code(404).send({ error: 'Employé introuvable' })
      }
      throw err   // le handler global journalise et masque le détail interne
    }
  })
}
