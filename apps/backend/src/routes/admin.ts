import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { authenticateAdmin } from '../middleware/superAdmin'

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/tenants', { preHandler: authenticateAdmin }, async () => {
    return prisma.tenant.findMany({
      include: { _count: { select: { users: true, products: true, sales: true } } },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.get('/api/admin/stats', { preHandler: authenticateAdmin }, async () => {
    const [tenants, users, sales, products] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.sale.aggregate({ _sum: { total: true }, _count: true }),
      prisma.product.count(),
    ])
    return {
      totalTenants: tenants,
      totalUsers: users,
      totalSales: (sales as any)._count,
      totalRevenue: (sales as any)._sum.total ?? 0,
      totalProducts: products,
    }
  })

  app.post('/api/admin/tenants', { preHandler: authenticateAdmin }, async (request) => {
    const { name, currency, country, plan, adminEmail, adminPassword } = request.body as any
    const tenant = await prisma.tenant.create({
      data: { name, currency: currency ?? 'XOF', country: country ?? 'SN', plan: plan ?? 'starter' },
    })
    if (adminEmail && adminPassword) {
      await prisma.user.create({
        data: {
          name: `Admin ${name}`,
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 12),
          role: 'ADMIN',
          tenantId: tenant.id,
        },
      })
    }
    return tenant
  })

  // SUPER_ADMIN : demandes en attente
  app.get('/api/admin/plan-requests', { preHandler: authenticateAdmin }, async () => {
    return prisma.planRequest.findMany({
      where: { status: 'pending' },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    })
  })

  // SUPER_ADMIN : approuver / rejeter une demande
  app.patch('/api/admin/plan-requests/:id', { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params as any
    const { action, adminNotes } = (request.body ?? {}) as any
    const { userId } = request.user

    const planRequest = await prisma.planRequest.findUnique({ where: { id }, include: { tenant: true } })
    if (!planRequest) return reply.code(404).send({ error: 'Demande introuvable' })

    if (action === 'approve') {
      await Promise.all([
        prisma.planRequest.update({
          where: { id },
          data: { status: 'approved', adminNotes: adminNotes || null, reviewedAt: new Date(), reviewedBy: userId },
        }),
        prisma.tenant.update({
          where: { id: planRequest.tenantId },
          data: {
            plan: planRequest.plan,
            status: 'active',
            isActive: true,
            planActivatedAt: new Date(),
            trialEnds: new Date(Date.now() + (planRequest.period === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
          },
        }),
      ])
      console.log(`✅ Plan ${planRequest.plan} approuvé pour ${planRequest.tenant.name}`)
      return { message: `Plan ${planRequest.plan} activé`, tenant: planRequest.tenant.name, plan: planRequest.plan, period: planRequest.period }
    }

    if (action === 'reject') {
      await Promise.all([
        prisma.planRequest.update({
          where: { id },
          data: { status: 'rejected', adminNotes: adminNotes || null, reviewedAt: new Date(), reviewedBy: userId },
        }),
        prisma.tenant.update({
          where: { id: planRequest.tenantId },
          data: { status: 'trial', paymentRef: null, paymentMethod: null },
        }),
      ])
      return { message: 'Demande rejetée', tenant: planRequest.tenant.name }
    }

    return reply.code(400).send({ error: 'Action invalide. Utilisez approve ou reject.' })
  })
}
