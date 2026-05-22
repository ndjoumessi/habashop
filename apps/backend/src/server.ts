import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import twilio from 'twilio'
import Anthropic from '@anthropic-ai/sdk'
import { CronJob } from 'cron'
const prisma = new PrismaClient()

const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM
  ?? 'whatsapp:+14155238886'

// ── Lazy init Twilio ──
// Lu à chaque appel pour garantir les vars Railway
function getTwilioClient() {
  const sid   = (process.env.TWILIO_ACCOUNT_SID  ?? '').trim()
  const token = (process.env.TWILIO_AUTH_TOKEN   ?? '').trim()
  if (!sid || !token) {
    console.error('[Twilio] vars manquantes sid:', !!sid, 'token:', !!token)
    return null
  }
  try {
    return twilio(sid, token)
  } catch (e: any) {
    console.error('[Twilio] init error:', e.message)
    return null
  }
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
        if (!client) throw new Error('Twilio non configuré')
        await client.messages.create({
          from: TWILIO_FROM,
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
        if (!client) throw new Error('Twilio non configuré')
        await client.messages.create({
          from: TWILIO_FROM,
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

  app.post('/api/products', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user as any
    const {
      sku, name, category, buyPrice, sellPrice,
      stockQty, stockMin, unit, emoji, taxRate,
      description, barcode, isActive,
      wholesalePrice, semiWholesalePrice,
      hasPromotion, promotionPrice,
    } = request.body as any

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'Nom requis' })
    }

    try {
      const product = await prisma.product.create({
        data: {
          tenantId,
          sku: sku || `PRD-${Date.now()}`,
          name: name.trim(),
          category: category || 'Général',
          buyPrice: buyPrice || 0,
          sellPrice: sellPrice || 0,
          stockQty: stockQty || 0,
          stockMin: stockMin || 5,
          unit: unit || 'unité',
          emoji: emoji || '📦',
          taxRate: taxRate || 18,
          description: description || '',
          barcode: barcode || '',
          isActive: isActive !== false,
          wholesalePrice: wholesalePrice || null,
          semiWholesalePrice: semiWholesalePrice || null,
          hasPromotion: hasPromotion || false,
          promotionPrice: promotionPrice || null,
        }
      })
      return product
    } catch (err: any) {
      console.error('Create product error:', err)
      return reply.code(500).send({
        error: 'Erreur création produit',
        details: err.message,
      })
    }
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
    try {
      return await prisma.customer.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      })
    } catch (err: any) {
      console.error('Get customers error:', err)
      return []
    }
  })

  app.post('/api/customers', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user as any
    const {
      name, type, phone, email, address,
      loyaltyPoints, totalRevenue,
    } = request.body as any

    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Le nom est requis' })
    }

    try {
      const customer = await prisma.customer.create({
        data: {
          tenantId,
          name:          name?.trim() ?? '',
          type:          type          ?? 'retail',
          phone:         phone         ?? '',
          email:         email         ?? '',
          address:       address       ?? '',
          loyaltyPoints: loyaltyPoints ?? 0,
          totalRevenue:  totalRevenue  ?? 0,
        }
      })
      return customer
    } catch (err: any) {
      console.error('Create customer error:', err)
      return reply.code(500).send({
        error: 'Erreur création client',
        details: err.message,
      })
    }
  })

  app.put('/api/customers/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    const data = request.body as any
    try {
      return await prisma.customer.update({
        where: { id, tenantId },
        data: {
          name: data.name,
          type: data.type,
          phone: data.phone,
          email: data.email,
          address: data.address,
        }
      })
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
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

  app.post('/api/employees', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user as any
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
    const { tenantId } = request.user as any
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
    const { tenantId } = request.user as any
    const { id } = request.params as any
    try {
      await prisma.employee.delete({ where: { id, tenantId } })
      return { success: true }
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })

  // ════════════════════════════════════════
  // EMPLOYEE BONUSES ROUTES
  // ════════════════════════════════════════

  app.get('/api/bonuses', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.employeeBonus.findMany({
      where: { tenantId },
      orderBy: { date: 'desc' },
    })
  })

  app.get('/api/bonuses/employee/:employeeId', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { employeeId } = request.params as any
    return prisma.employeeBonus.findMany({
      where: { tenantId, employeeId },
      orderBy: { date: 'desc' },
    })
  })

  app.post('/api/bonuses', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user as any
    const { employeeId, amount, reason, date } = request.body as any
    if (!employeeId || !amount) return reply.code(400).send({ error: 'employeeId et amount requis' })
    try {
      const bonus = await prisma.employeeBonus.create({
        data: {
          tenantId,
          employeeId,
          amount: Number(amount),
          reason: reason ?? 'Prime',
          date: date ? new Date(date) : new Date(),
        }
      })
      return bonus
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })

  app.delete('/api/bonuses/:id', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user as any
    const { id } = request.params as any
    try {
      await prisma.employeeBonus.delete({ where: { id, tenantId } })
      return { success: true }
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })

  // ════════════════════════════════════════
  // SALARY HISTORY ROUTES
  // ════════════════════════════════════════

  app.get('/api/salary-history', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    return prisma.salaryHistory.findMany({
      where: { tenantId },
      orderBy: { date: 'desc' },
    })
  })

  app.get('/api/salary-history/employee/:employeeId', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user as any
    const { employeeId } = request.params as any
    return prisma.salaryHistory.findMany({
      where: { tenantId, employeeId },
      orderBy: { date: 'desc' },
    })
  })

  app.post('/api/salary-history', { preHandler: authenticate }, async (request, reply) => {
    const { tenantId } = request.user as any
    const { employeeId, oldSalary, newSalary, reason, date } = request.body as any
    if (!employeeId || newSalary === undefined) return reply.code(400).send({ error: 'employeeId et newSalary requis' })
    try {
      const entry = await prisma.salaryHistory.create({
        data: {
          tenantId,
          employeeId,
          oldSalary: Number(oldSalary ?? 0),
          newSalary: Number(newSalary),
          reason: reason ?? '',
          date: date ? new Date(date) : new Date(),
        }
      })
      return entry
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
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

  app.post('/api/whatsapp/send-ticket', { preHandler: [authenticate] }, async (request: any, reply: any) => {
    const { phone, items, total, paymentMode, discount, reference } = request.body as any

    if (!phone?.trim()) {
      return reply.code(400).send({ error: 'Numéro de téléphone requis' })
    }

    const twClient = getTwilioClient()
    if (!twClient) {
      console.error('❌ getTwilioClient() returned null')
      return reply.code(503).send({
        error:   'Service WhatsApp non disponible',
        details: 'Variables TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN manquantes dans Railway',
      })
    }

    const cleaned = phone.replace(/[\s\-\(\)]/g, '').replace(/^00/, '+')
    const waPhone = cleaned.startsWith('+') ? `whatsapp:${cleaned}` : `whatsapp:+${cleaned}`

    const now     = new Date()
    const dateStr = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })
    const timeStr = now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })
    const ref     = reference || `#${Date.now().toString().slice(-6)}`

    const itemLines = Array.isArray(items)
      ? items.map((i: any) => {
          const lineTotal = Number(i.price ?? 0) * Number(i.qty ?? 1)
          return `• ${i.name} ×${i.qty} — ${lineTotal.toLocaleString('fr-FR')} F`
        }).join('\n')
      : '• Articles non détaillés'

    const totalFmt    = Number(total ?? 0).toLocaleString('fr-FR')
    const discountLine = discount && Number(discount) > 0
      ? `\n🏷️ Remise : -${Number(discount).toLocaleString('fr-FR')} F`
      : ''

    const body = [
      '🧾 *TICKET DE CAISSE*',
      `📍 HabaShop — ${dateStr} à ${timeStr}`,
      `🔖 Réf : ${ref}`,
      '',
      '━━━━━━━━━━━━━━━━━',
      '📦 *Articles commandés*',
      itemLines,
      '━━━━━━━━━━━━━━━━━',
      discountLine,
      `💰 *TOTAL TTC : ${totalFmt} F CFA*`,
      `💳 Paiement : ${paymentMode ?? 'Espèces'}`,
      '',
      '✅ *Merci pour votre achat !*',
      '_Ce ticket fait office de reçu._',
      '_Conservez-le comme justificatif._',
    ].filter(l => l !== null && l !== undefined).join('\n')

    console.log('📱 Envoi WhatsApp vers:', waPhone)
    console.log('📤 From:', TWILIO_FROM)

    try {
      const msg = await twClient.messages.create({ from: TWILIO_FROM, to: waPhone, body })
      console.log('✅ WhatsApp envoyé, SID:', msg.sid)
      return reply.send({ success: true, sid: msg.sid, to: waPhone })
    } catch (err: any) {
      console.error('❌ Twilio error code:', err.code)
      console.error('❌ Twilio error msg:', err.message)

      const TWILIO_ERRORS: Record<number, string> = {
        21608: "Ce numéro n'est pas inscrit sur WhatsApp",
        21211: 'Format de numéro invalide',
        21614: 'Numéro non joignable sur WhatsApp',
        63007: 'Canal WhatsApp non disponible',
        63016: 'Message non livrable',
        20003: 'Authentification Twilio échouée',
        21401: 'Numéro expéditeur invalide',
        21606: 'Numéro non activé pour WhatsApp',
      }

      return reply.code(500).send({
        error:   TWILIO_ERRORS[err.code] ?? err.message ?? "Erreur lors de l'envoi",
        code:    err.code ?? 0,
        details: err.message,
      })
    }
  })

  app.get('/api/whatsapp/test', async (_req: any, reply: any) => {
    const client = getTwilioClient()
    return reply.send({
      configured:      !!client,
      sid_set:         !!(process.env.TWILIO_ACCOUNT_SID ?? '').trim(),
      token_set:       !!(process.env.TWILIO_AUTH_TOKEN  ?? '').trim(),
      from:            TWILIO_FROM,
      twilio_version:  require('twilio/package.json').version,
      status:          client ? '✅ Ready' : '❌ Not configured',
    })
  })

  app.post('/api/whatsapp/send-alert', { preHandler: authenticate }, async (request, reply) => {
    const { phone, alertType, data, lang } = request.body as any

    try {
      const client = getTwilioClient()
      if (!client) return reply.code(503).send({ error: 'Service WhatsApp non configuré' })
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
        from: TWILIO_FROM,
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

  // ─── AI CHAT ──────────────────────────
  app.post('/api/ai/chat', { preHandler: authenticate }, async (request, reply) => {
    // Accepte {message: string} (simple) ou {messages: array} (historique)
    const { message: singleMsg, messages: msgHistory, lang } = request.body as any
    const { tenantId } = request.user as any

    if (!singleMsg?.trim() && (!msgHistory || msgHistory.length === 0)) {
      return reply.code(400).send({ error: 'message ou messages requis' })
    }

    try {
      const [products, sales, employees, expenses] = await Promise.all([
        prisma.product.findMany({ where: { tenantId, isActive: true }, take: 30 }),
        prisma.sale.findMany({
          where: { tenantId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          take: 50,
        }),
        prisma.employee.findMany({ where: { tenantId, isActive: true } }),
        prisma.expense.findMany({ where: { tenantId }, take: 20 }),
      ])

      const totalCA = sales.reduce((s: number, sale: any) => s + sale.total, 0)
      const lowStock = products.filter((p: any) => p.stockQty <= p.stockMin)
      const totalExpenses = expenses.reduce((s: number, e: any) => s + e.amountTTC, 0)

      const systemPrompt = `Tu es l'assistant IA de HabaShop, un logiciel de gestion commerciale pour commerces africains.
Tu aides le gérant à prendre de meilleures décisions basées sur ses données réelles.

DONNÉES RÉELLES DE LA BOUTIQUE (30 derniers jours) :
- Produits actifs : ${products.length}
- CA du mois : ${totalCA.toLocaleString('fr-FR')} FCFA
- Ventes ce mois : ${sales.length}
- Panier moyen : ${sales.length > 0 ? Math.round(totalCA / sales.length).toLocaleString('fr-FR') : 0} FCFA
- Dépenses : ${totalExpenses.toLocaleString('fr-FR')} FCFA
- Résultat net : ${(totalCA - totalExpenses).toLocaleString('fr-FR')} FCFA
- Employés actifs : ${employees.length}
- Masse salariale : ${employees.reduce((s: number, e: any) => s + e.salary, 0).toLocaleString('fr-FR')} FCFA
- Produits en rupture/bas : ${lowStock.length}
- Produits en rupture : ${lowStock.filter((p: any) => p.stockQty === 0).length}
- Top 5 produits : ${products.slice(0, 5).map((p: any) => `${p.name} (stock:${p.stockQty})`).join(', ')}

INSTRUCTIONS :
- Réponds en ${lang === 'fr' ? 'français' : lang === 'en' ? 'anglais' : lang === 'es' ? 'espagnol' : 'italien'}
- Sois concis, pratique et orienté vers l'action
- Utilise des emojis pour la lisibilité
- Base tes réponses sur les données réelles fournies
- Si une question dépasse tes données, dis-le clairement
- Maximum 300 mots par réponse`

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return reply.code(503).send({ error: 'Clé API Anthropic non configurée' })
      const anthropic = new Anthropic({ apiKey })

      // Construit le tableau de messages pour Anthropic
      const msgsToSend = singleMsg?.trim()
        ? [{ role: 'user' as const, content: singleMsg.trim() }]
        : Array.isArray(msgHistory) && msgHistory.length > 0
          ? (msgHistory as any[]).slice(-10).map((m: any) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
          : []

      if (msgsToSend.length === 0) {
        return reply.code(400).send({ error: 'Message ou historique requis' })
      }

      const message = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 800,
        system: systemPrompt,
        messages: msgsToSend,
      })

      return {
        response: message.content[0].type === 'text'
          ? message.content[0].text
          : 'Désolé, je ne peux pas répondre pour le moment.'
      }
    } catch (err: any) {
      console.error('Chat AI error:', err.message)
      return reply.code(500).send({ error: err.message })
    }
  })

  // ─── API DOCS ─────────────────────────
  app.get('/api/docs', async () => {
    return {
      name: 'HabaShop API',
      version: '2.0.0',
      description: 'API REST pour HabaShop — Logiciel de gestion commerciale',
      baseUrl: 'https://habashop-production.up.railway.app',
      authentication: {
        type: 'Bearer JWT',
        endpoint: 'POST /api/auth/login',
        example: {
          request: { email: 'your@email.com', password: 'yourpassword' },
          response: { token: 'eyJ...', user: { id: '...', name: '...', role: '...' } }
        }
      },
      endpoints: [
        { method: 'GET',  path: '/health',                   description: 'Health check',             auth: false },
        { method: 'POST', path: '/api/auth/login',           description: 'Authentification',         auth: false },
        { method: 'GET',  path: '/api/products',             description: 'Liste des produits',       auth: true  },
        { method: 'POST', path: '/api/products',             description: 'Créer un produit',         auth: true  },
        { method: 'PUT',  path: '/api/products/:id',         description: 'Modifier un produit',      auth: true  },
        { method: 'DELETE', path: '/api/products/:id',       description: 'Supprimer un produit',     auth: true  },
        { method: 'GET',  path: '/api/sales',                description: 'Liste des ventes',         auth: true  },
        { method: 'POST', path: '/api/sales',                description: 'Créer une vente',          auth: true  },
        { method: 'GET',  path: '/api/customers',            description: 'Liste des clients',        auth: true  },
        { method: 'POST', path: '/api/customers',            description: 'Créer un client',          auth: true  },
        { method: 'GET',  path: '/api/suppliers',            description: 'Liste des fournisseurs',   auth: true  },
        { method: 'GET',  path: '/api/orders',               description: 'Liste des commandes',      auth: true  },
        { method: 'GET',  path: '/api/employees',            description: 'Liste des employés',       auth: true  },
        { method: 'GET',  path: '/api/expenses',             description: 'Liste des dépenses',       auth: true  },
        { method: 'GET',  path: '/api/dashboard/stats',      description: 'Statistiques dashboard',   auth: true  },
        { method: 'GET',  path: '/api/reports/sales',        description: 'Rapport ventes',           auth: true  },
        { method: 'GET',  path: '/api/products/low-stock',   description: 'Produits en rupture',      auth: true  },
        { method: 'POST', path: '/api/ai/analyze',           description: 'Analyse IA Claude',        auth: true  },
        { method: 'POST', path: '/api/ai/chat',              description: 'Chat IA Claude',           auth: true  },
        { method: 'POST', path: '/api/whatsapp/send-ticket', description: 'Envoyer ticket WhatsApp',  auth: true  },
        { method: 'POST', path: '/api/whatsapp/broadcast',   description: 'WhatsApp marketing (max 20)', auth: true },
      ],
      rateLimits: { requests: '100/minute par token', whatsapp: '20 messages/envoi', ai: '10 analyses/heure' },
    }
  })

  app.get('/api/docs/html', async (_request, reply) => {
    const endpoints = [
      { method: 'GET',  path: '/api/products',         desc: 'Liste des produits',   auth: true  },
      { method: 'POST', path: '/api/sales',            desc: 'Créer une vente',      auth: true  },
      { method: 'GET',  path: '/api/customers',        desc: 'Liste des clients',    auth: true  },
      { method: 'GET',  path: '/api/dashboard/stats',  desc: 'Stats dashboard',      auth: true  },
      { method: 'POST', path: '/api/ai/analyze',       desc: 'Analyse IA Claude',    auth: true  },
      { method: 'POST', path: '/api/ai/chat',          desc: 'Chat IA Claude',       auth: true  },
      { method: 'POST', path: '/api/whatsapp/send-ticket', desc: 'Ticket WhatsApp', auth: true  },
      { method: 'GET',  path: '/health',               desc: 'Health check',         auth: false },
    ]
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>HabaShop API Documentation</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;background:#0C0B14;color:#e2e8f0}
    .header{background:linear-gradient(135deg,#5B4EE8,#7C6FF0);padding:32px}
    .header h1{font-size:28px;font-weight:900;color:#fff;margin-bottom:8px}
    .header p{color:rgba(255,255,255,.75);font-size:14px}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-left:8px}
    .badge-get{background:#10B981;color:#fff}
    .badge-post{background:#5B4EE8;color:#fff}
    .container{max-width:900px;margin:0 auto;padding:24px}
    .card{background:#181628;border:1px solid rgba(255,255,255,.1);border-radius:12px;margin-bottom:12px;overflow:hidden}
    .card-header{padding:14px 18px;display:flex;align-items:center;gap:12px}
    .card-body{padding:0 18px 14px}
    .endpoint-path{font-family:monospace;font-size:14px;color:#a78bfa}
    .endpoint-desc{font-size:13px;color:#94a3b8}
    pre{background:#0C0B14;border-radius:8px;padding:14px;font-size:12px;overflow-x:auto;color:#7C6FF0;margin-top:8px;border:1px solid rgba(91,78,232,.2)}
    .auth-badge{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:2px 8px;font-size:10px}
    .public-badge{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.2);border-radius:6px;padding:2px 8px;font-size:10px}
    .section-title{font-size:16px;font-weight:800;color:#e2e8f0;margin:20px 0 10px}
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 HabaShop API v2.0</h1>
    <p>API REST complète pour intégrer HabaShop dans vos applications</p>
    <p style="margin-top:8px;font-family:monospace;font-size:13px;">Base URL: https://habashop-production.up.railway.app</p>
  </div>
  <div class="container">
    <div class="section-title">🔐 Authentification</div>
    <div class="card">
      <div class="card-header">
        <span class="badge badge-post">POST</span>
        <span class="endpoint-path">/api/auth/login</span>
        <span class="public-badge">Public</span>
      </div>
      <div class="card-body">
        <pre>{"email":"admin@habashop.com","password":"demo1234"}</pre>
      </div>
    </div>
    <div class="section-title">📦 Endpoints</div>
    ${endpoints.map(e => `
    <div class="card">
      <div class="card-header">
        <span class="badge badge-${e.method.toLowerCase()}">${e.method}</span>
        <span class="endpoint-path">${e.path}</span>
        <span class="${e.auth ? 'auth-badge' : 'public-badge'}">${e.auth ? '🔒 Auth requis' : '🌍 Public'}</span>
        <span class="endpoint-desc" style="margin-left:auto">${e.desc}</span>
      </div>
    </div>`).join('')}
    <div class="section-title">💻 Exemple SDK JavaScript</div>
    <div class="card">
      <div class="card-body" style="padding-top:14px">
        <pre>const axios = require('axios')
const BASE = 'https://habashop-production.up.railway.app'

const { data: { token } } = await axios.post(BASE + '/api/auth/login', {
  email: 'admin@habashop.com', password: 'demo1234'
})
const headers = { Authorization: 'Bearer ' + token }
const { data: products } = await axios.get(BASE + '/api/products', { headers })
console.log(products.length + ' produits')</pre>
      </div>
    </div>
  </div>
</body>
</html>`
    return reply.type('text/html').send(html)
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
        const client = getTwilioClient()
        if (!client) { failed++; continue }
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone.replace(/^0/, '')}`
        await client.messages.create({
          from: TWILIO_FROM,
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

  // ─── HEALTH EXTENDED ─────────────────
  app.get('/api/health-extended', async (_request, reply) => {
    try {
      const [bonusCount, salaryCount, employeeCount] = await Promise.all([
        prisma.employeeBonus.count(),
        prisma.salaryHistory.count(),
        prisma.employee.count(),
      ])
      return reply.send({
        status: 'ok',
        tables: { employeeBonus: bonusCount, salaryHistory: salaryCount, employee: employeeCount },
        routes: ['/api/bonuses', '/api/salary-history'],
        buildTime: new Date().toISOString(),
      })
    } catch (err: any) {
      return reply.code(500).send({ status: 'error', error: err.message })
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
