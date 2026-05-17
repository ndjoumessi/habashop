import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import twilio from 'twilio'
import Anthropic from '@anthropic-ai/sdk'
import { CronJob } from 'cron'
import 'dotenv/config'

const prisma = new PrismaClient()

const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) throw new Error('Twilio credentials manquants')
  return twilio(accountSid, authToken)
}

// ─── CRON: RÉSUMÉ SOIR ────────────────
async function sendEveningReport() {
  try {
    const tenants = await prisma.tenant.findMany()
    for (const tenant of tenants) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const [sales, allProducts] = await Promise.all([
        prisma.sale.findMany({
          where: { tenantId: tenant.id, createdAt: { gte: today } },
          include: { items: true },
        }),
        prisma.product.findMany({ where: { tenantId: tenant.id, isActive: true } }),
      ])
      const lowStock = allProducts.filter(p => p.stockQty <= p.stockMin)
      const totalCA = sales.reduce((s, sale) => s + sale.total, 0)
      const ownerPhone = process.env.OWNER_PHONE ?? '+393275469250'
      const message =
        `📊 *HabaShop — Résumé du ${today.toLocaleDateString('fr-FR')}*\n\n` +
        `💰 CA du jour : *${totalCA.toLocaleString('fr-FR')} FCFA*\n` +
        `🛒 Transactions : *${sales.length}*\n` +
        `💵 Panier moyen : *${sales.length > 0 ? Math.round(totalCA / sales.length).toLocaleString('fr-FR') : 0} FCFA*\n\n` +
        (lowStock.length > 0
          ? `⚠️ *${lowStock.length} produit(s) en rupture :*\n${lowStock.slice(0, 5).map(p => `• ${p.name} (${p.stockQty}/${p.stockMin})`).join('\n')}\n\n`
          : `✅ Aucune rupture de stock\n\n`) +
        `_Bonne soirée !_ 🌙`
      try {
        const client = getTwilioClient()
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886',
          to: `whatsapp:${ownerPhone}`,
          body: message,
        })
        console.log(`✅ Résumé soir envoyé pour ${tenant.name}`)
      } catch (err: any) {
        console.error(`❌ Erreur envoi résumé: ${err.message}`)
      }
    }
  } catch (err: any) {
    console.error('Cron evening error:', err.message)
  }
}

// ─── CRON: ALERTE MATIN ───────────────
async function sendMorningStockAlert() {
  try {
    const tenants = await prisma.tenant.findMany()
    for (const tenant of tenants) {
      const allProducts = await prisma.product.findMany({ where: { tenantId: tenant.id, isActive: true } })
      const lowStock = allProducts.filter(p => p.stockQty <= p.stockMin)
      if (lowStock.length === 0) continue
      const ownerPhone = process.env.OWNER_PHONE ?? '+393275469250'
      const message =
        `🌅 *HabaShop — Alerte stock du matin*\n\n` +
        `⚠️ *${lowStock.length} produit(s) nécessitent une commande :*\n\n` +
        lowStock.map(p => {
          const status = p.stockQty === 0 ? '🔴 RUPTURE' : '🟡 BAS'
          return `${status} ${p.name}\n   Stock: ${p.stockQty} / Seuil: ${p.stockMin}`
        }).join('\n') +
        `\n\n💡 Pensez à commander dès aujourd'hui !\n📦 Gérez votre stock sur HabaShop`
      try {
        const client = getTwilioClient()
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886',
          to: `whatsapp:${ownerPhone}`,
          body: message,
        })
        console.log(`✅ Alerte matin envoyée pour ${tenant.name}`)
      } catch (err: any) {
        console.error(`❌ Erreur alerte matin: ${err.message}`)
      }
    }
  } catch (err: any) {
    console.error('Cron morning error:', err.message)
  }
}

// Résumé soir tous les jours à 20h00, alerte matin à 8h00
new CronJob('0 20 * * *', sendEveningReport, null, true, 'Africa/Dakar')
new CronJob('0 8 * * *', sendMorningStockAlert, null, true, 'Africa/Dakar')
console.log('⏰ Cron jobs planifiés : résumé 20h + alertes 8h')

// ─── MIDDLEWARE AUTH ──────────────────
async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Non autorisé' })
  }
}

async function authenticateAdmin(request: any, reply: any) {
  try {
    await request.jwtVerify()
    if ((request.user as any).role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Accès refusé — SUPER_ADMIN requis' })
    }
  } catch {
    reply.code(401).send({ error: 'Non autorisé' })
  }
}

async function start() {
  const app = Fastify({ logger: true })

  // ─── PLUGINS ────────────────────────────
  const allowedOrigins = [
    'http://localhost:5173',
    'https://habashop.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ]
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error('CORS not allowed'), false)
    },
    credentials: true,
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'habashop-secret-dev-2026',
  })

  // ─── HEALTH CHECK ─────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  }))

  // ════════════════════════════════════════
  // AUTH ROUTES
  // ════════════════════════════════════════

  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as any

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.code(401).send({ error: 'Email ou mot de passe incorrect' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.code(401).send({ error: 'Email ou mot de passe incorrect' })

    if (!user.isActive) return reply.code(403).send({ error: 'Compte désactivé' })

    const token = app.jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '7d' }
    )

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        shopName: tenant?.name ?? 'HabaShop',
      },
    }
  })

  app.post('/api/auth/register', async (request, reply) => {
    const { name, email, password, shopName, currency, country } = request.body as any

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.code(409).send({ error: 'Email déjà utilisé' })

    const passwordHash = await bcrypt.hash(password, 12)

    const tenant = await prisma.tenant.create({
      data: {
        name: shopName,
        currency: currency ?? 'XOF',
        country: country ?? 'SN',
        plan: 'starter',
      },
    })

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: 'ADMIN', tenantId: tenant.id },
    })

    const token = app.jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      { expiresIn: '7d' }
    )

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shopName: tenant.name },
    }
  })

  app.get('/api/auth/me', { preHandler: authenticate }, async (request) => {
    const { userId } = request.user as any
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    })
    if (!user) throw new Error('Utilisateur introuvable')
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      shopName: user.tenant?.name,
      currency: user.tenant?.currency,
    }
  })

  // ════════════════════════════════════════
  // PRODUCTS / STOCK ROUTES
  // ════════════════════════════════════════

  app.get('/api/products', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  })

  app.post('/api/products', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.product.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/products/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    return prisma.product.update({ where: { id, tenantId }, data: request.body as any })
  })

  app.delete('/api/products/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    await prisma.product.delete({ where: { id, tenantId } })
    return { success: true }
  })

  app.get('/api/products/low-stock', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const products = await prisma.product.findMany({ where: { tenantId, isActive: true } })
    return products.filter((p: any) => p.stockQty <= p.stockMin)
  })

  // ════════════════════════════════════════
  // TENANT ROUTES
  // ════════════════════════════════════════

  app.get('/api/tenant', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.tenant.findUnique({ where: { id: tenantId } })
  })

  app.put('/api/tenant', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const data = request.body as any
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name:     data.name,
        currency: data.currency,
        country:  data.country,
        vatRate:  data.vatRate,
        address:  data.address,
        phone:    data.phone,
        email:    data.email,
      },
    })
  })

  // ════════════════════════════════════════
  // SALES ROUTES
  // ════════════════════════════════════════

  app.get('/api/sales', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { limit = 50, offset = 0 } = request.query as any
    return prisma.sale.findMany({
      where: { tenantId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    })
  })

  app.post('/api/sales', { preHandler: authenticate }, async (request) => {
    const { tenantId, userId } = request.user as any
    const { items, paymentMode, total, discount } = request.body as any

    return prisma.$transaction(async (tx: any) => {
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          cashierId: userId,
          total,
          paymentMode,
          discountAmount: discount?.amount ?? 0,
          discountType: discount?.type ?? null,
        },
      })

      for (const item of items) {
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            qty: item.qty,
            unitPrice: item.price,
            total: item.price * item.qty,
          },
        })
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.qty } },
        })
      }

      return newSale
    })
  })

  // ════════════════════════════════════════
  // CUSTOMERS ROUTES
  // ════════════════════════════════════════

  app.get('/api/customers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  })

  app.post('/api/customers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.customer.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/customers/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    return prisma.customer.update({ where: { id, tenantId }, data: request.body as any })
  })

  // ════════════════════════════════════════
  // SUPPLIERS ROUTES
  // ════════════════════════════════════════

  app.get('/api/suppliers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.supplier.findMany({ where: { tenantId } })
  })

  app.post('/api/suppliers', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.supplier.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/suppliers/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    return prisma.supplier.update({ where: { id, tenantId }, data: request.body as any })
  })

  // ════════════════════════════════════════
  // PURCHASE ORDERS ROUTES
  // ════════════════════════════════════════

  app.get('/api/orders', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { items: true, supplier: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/api/orders', { preHandler: authenticate }, async (request) => {
    const { tenantId, userId } = request.user as any
    const { supplierId, items, expectedAt, notes } = request.body as any

    const ref = `CMD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    const total = (items as any[]).reduce((s: number, i: any) => s + i.qty * i.unitPrice, 0)

    return prisma.purchaseOrder.create({
      data: {
        ref, tenantId, supplierId,
        createdById: userId,
        total, expectedAt, notes,
        status: 'DRAFT',
        items: {
          create: (items as any[]).map((i: any) => ({
            productName: i.product,
            qty: i.qty,
            unitPrice: i.unitPrice,
            total: i.qty * i.unitPrice,
          })),
        },
      },
      include: { items: true },
    })
  })

  app.patch('/api/orders/:id/status', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    const { status } = request.body as any
    return prisma.purchaseOrder.update({ where: { id, tenantId }, data: { status } })
  })

  // ════════════════════════════════════════
  // EMPLOYEES / HR ROUTES
  // ════════════════════════════════════════

  app.get('/api/employees', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.employee.findMany({ where: { tenantId } })
  })

  app.post('/api/employees', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.employee.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/employees/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    return prisma.employee.update({ where: { id, tenantId }, data: request.body as any })
  })

  // ════════════════════════════════════════
  // EXPENSES ROUTES
  // ════════════════════════════════════════

  app.get('/api/expenses', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.expense.findMany({ where: { tenantId }, orderBy: { date: 'desc' } })
  })

  app.post('/api/expenses', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.expense.create({ data: { ...(request.body as any), tenantId } })
  })

  app.put('/api/expenses/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    return prisma.expense.update({ where: { id, tenantId }, data: request.body as any })
  })

  app.delete('/api/expenses/:id', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    await prisma.expense.delete({ where: { id, tenantId } })
    return { success: true }
  })

  // ════════════════════════════════════════
  // DASHBOARD / REPORTS ROUTES
  // ════════════════════════════════════════

  app.get('/api/dashboard/stats', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const [salesToday, salesMonth, totalProducts, activeEmployees, pendingOrders, allProducts] =
      await Promise.all([
        prisma.sale.aggregate({
          where: { tenantId, createdAt: { gte: today } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.sale.aggregate({
          where: { tenantId, createdAt: { gte: monthStart } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.product.count({ where: { tenantId, isActive: true } }),
        prisma.employee.count({ where: { tenantId, isActive: true } }),
        prisma.purchaseOrder.count({ where: { tenantId, status: 'SENT' } }),
        prisma.product.findMany({
          where: { tenantId, isActive: true },
          select: { stockQty: true, stockMin: true },
        }),
      ])

    const lowStockProducts = allProducts.filter((p: { stockQty: number; stockMin: number }) => p.stockQty <= p.stockMin).length

    return {
      salesToday: salesToday._sum.total ?? 0,
      transactionsToday: salesToday._count,
      salesMonth: salesMonth._sum.total ?? 0,
      transactionsMonth: salesMonth._count,
      totalProducts,
      lowStockProducts,
      activeEmployees,
      pendingOrders,
    }
  })

  app.get('/api/reports/sales', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { period = '7days' } = request.query as any

    const now = new Date()
    const from = new Date()
    if (period === 'today') from.setHours(0, 0, 0, 0)
    else if (period === '7days') from.setDate(now.getDate() - 7)
    else if (period === '30days') from.setDate(now.getDate() - 30)
    else if (period === '3months') from.setMonth(now.getMonth() - 3)
    else from.setFullYear(now.getFullYear(), 0, 1)

    const sales = await prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: from } },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const total = sales.reduce((s: number, sale: any) => s + sale.total, 0)
    const byPayment = sales.reduce((acc: Record<string, number>, sale: any) => {
      acc[sale.paymentMode] = (acc[sale.paymentMode] ?? 0) + sale.total
      return acc
    }, {} as Record<string, number>)

    return { total, count: sales.length, byPayment, sales }
  })

  // ════════════════════════════════════════
  // WHATSAPP ROUTES (Twilio)
  // ════════════════════════════════════════

  app.post('/api/whatsapp/send-ticket', { preHandler: authenticate }, async (request, reply) => {
    const { phone, ticket, shopName, lang } = request.body as any

    try {
      const client = getTwilioClient()
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone.replace(/^0/, '')}`

      const messages: Record<string, string> = {
        fr: `🛒 *${shopName}*\n\n✅ Merci pour votre achat !\n\n📋 *Ticket #${ticket.ref}*\n${(ticket.items ?? []).map((i: any) => `• ${i.name} ×${i.qty} — ${i.total} FCFA`).join('\n')}\n\n💰 *Total : ${ticket.total} FCFA*\n💳 Paiement : ${ticket.paymentMode}\n📅 ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\n\n_Merci de votre confiance !_ 🙏`,
        en: `🛒 *${shopName}*\n\n✅ Thank you for your purchase!\n\n📋 *Receipt #${ticket.ref}*\n${(ticket.items ?? []).map((i: any) => `• ${i.name} ×${i.qty} — ${i.total}`).join('\n')}\n\n💰 *Total: ${ticket.total}*\n💳 Payment: ${ticket.paymentMode}\n📅 ${new Date().toLocaleDateString('en-US')}\n\n_Thank you for your trust!_ 🙏`,
        es: `🛒 *${shopName}*\n\n✅ ¡Gracias por su compra!\n\n📋 *Ticket #${ticket.ref}*\n${(ticket.items ?? []).map((i: any) => `• ${i.name} ×${i.qty} — ${i.total}`).join('\n')}\n\n💰 *Total: ${ticket.total}*\n💳 Pago: ${ticket.paymentMode}\n📅 ${new Date().toLocaleDateString('es-ES')}\n\n_¡Gracias por su confianza!_ 🙏`,
        it: `🛒 *${shopName}*\n\n✅ Grazie per il suo acquisto!\n\n📋 *Scontrino #${ticket.ref}*\n${(ticket.items ?? []).map((i: any) => `• ${i.name} ×${i.qty} — ${i.total}`).join('\n')}\n\n💰 *Totale: ${ticket.total}*\n💳 Pagamento: ${ticket.paymentMode}\n📅 ${new Date().toLocaleDateString('it-IT')}\n\n_Grazie per la sua fiducia!_ 🙏`,
      }

      const result = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886',
        to:   `whatsapp:${formattedPhone}`,
        body: messages[lang] ?? messages.fr,
      })
      return { success: true, sid: result.sid }
    } catch (err: any) {
      console.error('Twilio error:', err.message)
      return reply.code(503).send({ error: 'Échec envoi WhatsApp', details: err.message })
    }
  })

  app.post('/api/whatsapp/send-alert', { preHandler: authenticate }, async (request, reply) => {
    const { phone, alertType, data, lang } = request.body as any

    try {
      const client = getTwilioClient()
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone.replace(/^0/, '')}`

      let body = ''
      if (alertType === 'low_stock') {
        body = lang === 'fr'
          ? `⚠️ *HabaShop — Alerte Stock*\n\n🔴 *Rupture critique :*\n${(data.products ?? []).map((p: any) => `• ${p.name} — Stock: ${p.stock}/${p.threshold}`).join('\n')}\n\n📦 Commander immédiatement pour éviter la rupture.`
          : `⚠️ *HabaShop — Stock Alert*\n\n🔴 *Critical stock:*\n${(data.products ?? []).map((p: any) => `• ${p.name} — Stock: ${p.stock}/${p.threshold}`).join('\n')}\n\n📦 Order immediately to avoid stockout.`
      }

      if (!body) return reply.code(400).send({ error: 'alertType inconnu' })

      const result = await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886',
        to:   `whatsapp:${formattedPhone}`,
        body,
      })
      return { success: true, sid: result.sid }
    } catch (err: any) {
      console.error('Twilio alert error:', err.message)
      return reply.code(503).send({ error: err.message })
    }
  })

  // ════════════════════════════════════════
  // ADMIN ROUTES (SUPER_ADMIN uniquement)
  // ════════════════════════════════════════

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

  // ════════════════════════════════════════
  // AI ROUTES (Claude)
  // ════════════════════════════════════════

  app.post('/api/ai/analyze', { preHandler: authenticate }, async (request, reply) => {
    const { type, lang } = request.body as any
    const { tenantId } = request.user as any

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return reply.code(503).send({ error: 'Clé API Anthropic non configurée' })

    try {
      const [products, sales, expenses, employees] = await Promise.all([
        prisma.product.findMany({ where: { tenantId, isActive: true }, take: 50 }),
        prisma.sale.findMany({
          where: { tenantId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          include: { items: { include: { product: true } } },
          take: 100,
        }),
        prisma.expense.findMany({ where: { tenantId }, take: 50 }),
        prisma.employee.findMany({ where: { tenantId, isActive: true } }),
      ])

      const totalRevenue  = sales.reduce((s, sale) => s + sale.total, 0)
      const avgDailySales = totalRevenue / 30
      const lowStockProducts = products.filter(p => p.stockQty <= p.stockMin)
      const totalExpenses = expenses.reduce((s, e) => s + e.amountTTC, 0)
      const totalSalaries = employees.reduce((s, e) => s + e.salary, 0)
      const margin = totalRevenue > 0
        ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : '0'

      const productSales: Record<string, { name: string; qty: number; revenue: number }> = {}
      sales.forEach(sale => {
        sale.items.forEach((item: any) => {
          const id = item.productId
          if (!productSales[id]) productSales[id] = { name: item.product?.name ?? 'Produit', qty: 0, revenue: 0 }
          productSales[id].qty     += item.qty
          productSales[id].revenue += item.total
        })
      })
      const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

      const langLabel = lang === 'fr' ? 'français' : lang === 'en' ? 'anglais' : lang === 'es' ? 'espagnol' : 'italien'

      const PROMPTS: Record<string, string> = {
        full: `Tu es un expert en gestion commerciale pour les commerces africains.
Analyse ces données réelles d'une boutique et fournis des insights actionnables.

DONNÉES DU MOIS ÉCOULÉ :
- Chiffre d'affaires : ${totalRevenue.toLocaleString('fr-FR')} FCFA
- Ventes moyennes/jour : ${avgDailySales.toFixed(0)} FCFA
- Nombre de ventes : ${sales.length}
- Marge estimée : ${margin}%
- Dépenses totales : ${totalExpenses.toLocaleString('fr-FR')} FCFA
- Masse salariale : ${totalSalaries.toLocaleString('fr-FR')} FCFA/mois
- Employés actifs : ${employees.length}
- Produits actifs : ${products.length}
- Produits en rupture/bas : ${lowStockProducts.length}

TOP 5 PRODUITS (par CA) :
${topProducts.map((p, i) => `${i+1}. ${p.name} — ${p.revenue.toLocaleString('fr-FR')} FCFA (${p.qty} unités)`).join('\n')}

PRODUITS EN ALERTE STOCK :
${lowStockProducts.slice(0,5).map(p => `• ${p.name} — Stock: ${p.stockQty}/${p.stockMin}`).join('\n')}

Fournis une analyse STRUCTURÉE en ${langLabel} avec :
1. 📊 BILAN DU MOIS (2-3 phrases)
2. 🏆 POINTS FORTS (2-3 points)
3. ⚠️ POINTS D'ATTENTION (2-3 points)
4. 📦 RECOMMANDATIONS STOCK
5. 💰 PRÉVISIONS CA (mois prochain)
6. 🎯 3 ACTIONS PRIORITAIRES (cette semaine)

Sois précis, concis et orienté vers l'action.`,

        stock: `Tu es expert en gestion de stock pour commerces africains.

STOCK ACTUEL :
${products.map(p => `• ${p.name} — Stock: ${p.stockQty} / Seuil: ${p.stockMin} / Prix: ${p.sellPrice}`).join('\n')}

VENTES DU MOIS PAR PRODUIT :
${topProducts.map(p => `• ${p.name} — ${p.qty} unités / ${p.revenue.toLocaleString('fr-FR')} FCFA`).join('\n')}

En ${langLabel}, analyse et recommande :
1. 🔴 COMMANDES URGENTES (ruptures < 7 jours)
2. 🟡 COMMANDES PLANIFIÉES (ruptures 7-30 jours)
3. 📈 PRODUITS À STOCKER PLUS
4. 📉 PRODUITS À RÉDUIRE
5. 💡 OPTIMISATION COÛTS D'ACHAT`,

        revenue: `Tu es expert en analyse financière pour commerces africains.

DONNÉES FINANCIÈRES :
- CA ce mois : ${totalRevenue.toLocaleString('fr-FR')} FCFA
- Dépenses : ${totalExpenses.toLocaleString('fr-FR')} FCFA
- Résultat : ${(totalRevenue - totalExpenses).toLocaleString('fr-FR')} FCFA
- Marge : ${margin}%
- Masse salariale : ${totalSalaries.toLocaleString('fr-FR')} FCFA
- Transactions : ${sales.length}
- Panier moyen : ${sales.length > 0 ? (totalRevenue / sales.length).toFixed(0) : 0} FCFA

En ${langLabel}, fournis :
1. 📊 ANALYSE DE LA RENTABILITÉ
2. 📈 PRÉVISIONS SUR 3 MOIS
3. 💡 LEVIERS DE CROISSANCE (+20% CA)
4. ✂️ OPTIMISATION DES COÛTS
5. 🎯 OBJECTIFS MENSUELS RECOMMANDÉS`,

        hr: `Tu es expert RH pour commerces africains.

ÉQUIPE :
${employees.map(e => `• ${e.name} — ${e.role} — ${e.dept} — Salaire: ${e.salary.toLocaleString('fr-FR')} FCFA`).join('\n')}

CA DU MOIS : ${totalRevenue.toLocaleString('fr-FR')} FCFA
RATIO MASSE SALARIALE/CA : ${totalRevenue > 0 ? ((totalSalaries / totalRevenue) * 100).toFixed(1) : 0}%

En ${langLabel}, analyse :
1. 👥 EFFICACITÉ DE L'ÉQUIPE (CA par employé)
2. 💰 OPTIMISATION MASSE SALARIALE
3. 📋 BESOINS EN RECRUTEMENT
4. 🏆 RECOMMANDATIONS RH`,
      }

      const anthropic = new Anthropic({ apiKey })
      const message = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: PROMPTS[type] ?? PROMPTS.full }],
      })

      const analysis = message.content[0].type === 'text' ? message.content[0].text : 'Analyse non disponible'

      return {
        success: true,
        analysis,
        data: { totalRevenue, avgDailySales, totalSales: sales.length, margin, lowStockCount: lowStockProducts.length, topProducts },
      }
    } catch (err: any) {
      console.error('Claude AI error:', err.message)
      return reply.code(500).send({ error: 'Analyse IA non disponible', details: err.message })
    }
  })

  // ─── CRON TEST ROUTES ─────────────────
  app.post('/api/whatsapp/test-evening', { preHandler: authenticate }, async () => {
    await sendEveningReport()
    return { success: true, message: 'Résumé soir envoyé !' }
  })

  app.post('/api/whatsapp/test-morning', { preHandler: authenticate }, async () => {
    await sendMorningStockAlert()
    return { success: true, message: 'Alerte matin envoyée !' }
  })

  // ─── WHATSAPP BROADCAST ───────────────
  app.post('/api/whatsapp/broadcast', { preHandler: authenticate }, async (request, reply) => {
    const { phones, message, lang } = request.body as { phones: string[]; message: string; lang: string }
    if (!phones?.length || !message?.trim()) {
      return reply.code(400).send({ error: 'Paramètres manquants' })
    }
    if (phones.length > 20) {
      return reply.code(400).send({ error: 'Maximum 20 destinataires par envoi' })
    }

    let sent = 0
    let failed = 0

    for (const phone of phones) {
      try {
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone.replace(/^0/, '')}`
        const client = getTwilioClient()
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886',
          to: `whatsapp:${formattedPhone}`,
          body: message,
        })
        sent++
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch {
        failed++
      }
    }

    return { sent, failed }
  })

  // ─── LOYALTY ──────────────────────────
  app.get('/api/customers/:id/loyalty', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const customer = await prisma.customer.findUnique({ where: { id } })
      if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
      const points = (customer as any).loyaltyPoints ?? 0
      const tier = points >= 5000 ? 'Gold' : points >= 2000 ? 'Silver' : 'Bronze'
      return { points, tier, history: [] }
    } catch {
      return { points: 0, tier: 'Bronze', history: [] }
    }
  })

  app.post('/api/customers/:id/loyalty', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { points } = request.body as { points: number; reason: string }
    try {
      const customer = await prisma.customer.findUnique({ where: { id } })
      if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
      const current = (customer as any).loyaltyPoints ?? 0
      const updated = await prisma.customer.update({
        where: { id },
        data: { loyaltyPoints: current + points } as any,
      })
      return { points: (updated as any).loyaltyPoints ?? current + points }
    } catch {
      return { points: points }
    }
  })

  // ─── DÉMARRAGE ────────────────────────
  try {
    await prisma.$connect()
    await app.listen({
      port: Number(process.env.PORT ?? 3001),
      host: '0.0.0.0',
    })
    console.log('🚀 HabaShop API démarrée sur le port', process.env.PORT ?? 3001)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
