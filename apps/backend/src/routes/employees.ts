import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/employees', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.employee.findMany({ where: { tenantId } })
  })

  app.post('/api/employees', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const {
      name, role, dept, type, salary,
      phone, email, isActive, color,
      hiredAt, perf, avatar,
    } = request.body as any

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'Nom requis' })
    }

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
          perf:     Number(perf ?? 3),
        }
      })
      return emp
    } catch (err: any) {
      console.error('Create employee error:', err.message)
      return reply.code(500).send({ error: 'Erreur création employé', details: err.message })
    }
  })

  app.put('/api/employees/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as any
    const {
      name, role, dept, type, salary,
      phone, email, address, photo, isActive, color,
      hiredAt, perf,
    } = request.body as any

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
          ...(perf     !== undefined && { perf: Number(perf) }),
        }
      })
      return updated
    } catch (err: any) {
      console.error('Update employee error:', err.message)
      return reply.code(500).send({ error: 'Erreur mise à jour employé', details: err.message })
    }
  })

  app.delete('/api/employees/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user
    const { id } = request.params as any
    try {
      await prisma.employee.delete({ where: { id, tenantId } })
      return { success: true }
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })
}
