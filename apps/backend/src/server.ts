import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import * as Sentry from '@sentry/node'
import { prisma } from './db'
import { redis } from './redis'

// Routes
import { authRoutes }         from './routes/auth'
import { accountRoutes }      from './routes/account'
import { tenantRoutes }       from './routes/tenant'
import { productRoutes }      from './routes/products'
import { customerRoutes }     from './routes/customers'
import { saleRoutes }         from './routes/sales'
import { supplierRoutes }     from './routes/suppliers'
import { orderRoutes }        from './routes/orders'
import { employeeRoutes }     from './routes/employees'
import { hrRoutes }           from './routes/hr'
import { expenseRoutes }      from './routes/expenses'
import { analyticsRoutes }    from './routes/analytics'
import { reportsRoutes }      from './routes/reports'
import { exportRoutes }       from './routes/export'
import { billingRoutes }      from './routes/billing'
import { paymentRoutes }      from './routes/payments'
import { adminRoutes }        from './routes/admin'
import { notificationRoutes } from './routes/notifications'
import { whatsappRoutes }     from './routes/whatsapp'
import { aiRoutes }           from './routes/ai'
import { docsRoutes }         from './routes/docs'
import { goalsRoutes }        from './routes/goals'
import { publicRoutes }       from './routes/public'
import {
  sendTrialReminder7Days,
  sendTrialReminder3Days,
  sendTrialExpired,
  sendWeeklyReport,
  sendStockAlertEmail,
} from './services/email'
import { runMonthlyPayrollReports } from './services/payrollReport'
import { payrollRoutes } from './routes/payroll'

// ─── Validation des variables d'environnement obligatoires ───
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET']
const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v])
if (missingVars.length > 0) {
  console.error('❌ FATAL: variables d\'environnement manquantes:', missingVars.join(', '))
  console.error('📋 Consultez apps/backend/.env.example pour la configuration')
  process.exit(1)
}
const OPTIONAL_ENV_VARS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'ANTHROPIC_API_KEY']
OPTIONAL_ENV_VARS.forEach(v => {
  if (!process.env[v]) console.warn(`⚠️  Variable optionnelle manquante: ${v} — fonctionnalité associée désactivée`)
})

// ─── Sentry (inerte sans SENTRY_DSN) ───
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
    release: 'habashop@2.3.0',
    tracesSampleRate: 0.05,
  })
  console.log('📡 Sentry initialisé')
}

// ─── Alertes webhook Discord/Slack (inerte sans ALERT_WEBHOOK_URL) ───
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK_URL
async function sendAlert(title: string, message: string, level: 'info' | 'warning' | 'error' = 'error'): Promise<void> {
  if (!ALERT_WEBHOOK) return
  const colors = { info: 3447003, warning: 16776960, error: 16711680 }
  try {
    await fetch(ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [{ title, description: message, color: colors[level], timestamp: new Date().toISOString(), footer: { text: 'HabaShop Production' } }] }),
    })
  } catch { /* ne pas crasher si l'alerte échoue */ }
}

async function start() {
  const app = Fastify({ logger: true, trustProxy: true }) // derrière le proxy Railway : request.ip = vrai client (X-Forwarded-For) → clé rate-limit stable

  // ─── CORS ───────────────────────────────
  const allowedOrigins = [
    'https://habashop.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ]
  // Localhost on any port is always allowed (dev only)
  const isLocalhost = (origin: string) =>
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin)
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (isLocalhost(origin) || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error('CORS not allowed'), false)
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // ─── HELMET (en-têtes de sécurité) ──────
  // API JSON consommée par un frontend cross-origin (Vercel) : on garde les
  // en-têtes utiles (HSTS, X-Content-Type-Options, frameguard…) et on désactive
  // CSP / politiques cross-origin qui interfèreraient avec le SPA distant + le WS.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  })

  // ─── JWT ────────────────────────────────
  await app.register(jwt, {
    secret: process.env.JWT_SECRET as string, // garanti présent par la validation au démarrage
  })

  // ─── RATE LIMIT ─────────────────────────
  // Store partagé Redis si REDIS_URL est défini (sinon mémoire — non fiable en multi-replica).
  const rateLimitOpts: any = {
    global: false, // n'applique qu'aux routes qui déclarent config.rateLimit
    max: 100,
    timeWindow: '1 minute',
  }
  if (redis) {
    rateLimitOpts.redis = redis
    console.log('🧮 Rate-limit : store Redis partagé activé')
  } else {
    console.warn('⚠️  Rate-limit : REDIS_URL absent → store mémoire (non fiable en multi-replica)')
  }
  await app.register(rateLimit, rateLimitOpts)

  // ─── WEBSOCKET ──────────────────────────
  await app.register(websocket)

  // ─── ERROR HANDLER ──────────────────────
  // Prisma P2025 = "record not found" → 404. Couvre les update/delete
  // scopés par tenant (where:{id, tenantId}) : un accès cross-tenant ne
  // matche aucun enregistrement et doit renvoyer 404, pas 500.
  app.setErrorHandler((error: any, request, reply) => {
    if (error?.code === 'P2025') {
      return reply.code(404).send({ error: 'Ressource introuvable' })
    }
    const status = error?.statusCode ?? 500
    if (status >= 500) {
      Sentry.captureException(error, { extra: { url: request.url, method: request.method, tenantId: (request as any).tenantId } })
    }
    app.log.error(error)
    return reply.code(status).send({ error: error?.message ?? 'Erreur serveur' })
  })

  // ─── HEALTH CHECK ───────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    version: '2.1.0',
    build: 'p2025-404',
    timestamp: new Date().toISOString(),
  }))

  app.get('/api/health-extended', async (_request, reply) => {
    const start = Date.now()
    let dbStatus = 'ok'
    let dbLatency = 0
    let tables: { employeeBonus: number; salaryHistory: number; employee: number } | null = null
    try {
      const t0 = Date.now()
      await prisma.$queryRaw`SELECT 1`
      dbLatency = Date.now() - t0
      const [bonusCount, salaryCount, employeeCount] = await Promise.all([
        prisma.employeeBonus.count(),
        prisma.salaryHistory.count(),
        prisma.employee.count(),
      ])
      tables = { employeeBonus: bonusCount, salaryHistory: salaryCount, employee: employeeCount }
    } catch {
      dbStatus = 'error'
    }
    const mem = process.memoryUsage()
    return reply.send({
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      version: '2.3.0',
      uptime: Math.round(process.uptime()),
      latency: Date.now() - start,
      services: {
        database: { status: dbStatus, latency: dbLatency },
        redis:    { status: process.env.REDIS_URL ? 'configured' : 'not-configured' },
        whatsapp: { status: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'not-configured' },
        ai:       { status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not-configured' },
      },
      memory: {
        used:  Math.round(mem.heapUsed / 1024 / 1024),
        total: Math.round(mem.heapTotal / 1024 / 1024),
        unit:  'MB',
      },
      tables,
      routes: ['/api/bonuses', '/api/salary-history'],
      buildTime: new Date().toISOString(),
    })
  })

  // ─── ROUTES ─────────────────────────────
  await app.register(authRoutes)
  await app.register(accountRoutes)
  await app.register(tenantRoutes)
  await app.register(productRoutes)
  await app.register(customerRoutes)
  await app.register(saleRoutes)
  await app.register(supplierRoutes)
  await app.register(orderRoutes)
  await app.register(employeeRoutes)
  await app.register(hrRoutes)
  await app.register(expenseRoutes)
  await app.register(analyticsRoutes)
  await app.register(reportsRoutes)
  await app.register(payrollRoutes)
  await app.register(exportRoutes)
  await app.register(billingRoutes)
  await app.register(paymentRoutes)
  await app.register(adminRoutes)
  await app.register(notificationRoutes)
  await app.register(whatsappRoutes)
  await app.register(aiRoutes)
  await app.register(docsRoutes)
  await app.register(goalsRoutes)
  await app.register(publicRoutes) // routes publiques (sans authentification) — /api/public/*

  // ─── CRONS EMAIL (rappels essai + rapport hebdo) ──
  // Rappels d'essai — toutes les heures
  setInterval(() => {
    runTrialReminders().catch(err => console.error('❌ Cron trial reminders:', err))
  }, 60 * 60 * 1000)

  // Rapport hebdomadaire — lundi 8h (vérifié chaque heure)
  setInterval(() => {
    const now = new Date()
    if (now.getDay() !== 1 || now.getHours() !== 8 || now.getMinutes() > 5) return
    runWeeklyReports().catch(err => console.error('❌ Cron weekly reports:', err))
  }, 60 * 60 * 1000)

  // Alertes stock — quotidien 7h (vérifié chaque heure)
  setInterval(() => {
    const now = new Date()
    if (now.getHours() !== 7 || now.getMinutes() > 5) return
    runDailyStockAlerts().catch(err => console.error('❌ Cron stock alerts:', err))
  }, 60 * 60 * 1000)

  // Récap paie — 1er du mois 8h (vérifié chaque heure) ; récap du mois qui vient de se clôturer
  setInterval(() => {
    const now = new Date()
    if (now.getDate() !== 1 || now.getHours() !== 8 || now.getMinutes() > 5) return
    runMonthlyPayrollReports().catch(err => console.error('❌ Cron récap paie:', err))
  }, 60 * 60 * 1000)

  // ─── DÉMARRAGE ──────────────────────────
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

// ─── Logique des crons email ─────────────────────────────────────────────
async function runTrialReminders(): Promise<void> {
  const now     = new Date()
  const in7days = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
  const in3days = new Date(now.getTime() + 3 * 24 * 3600 * 1000)
  const window30 = 30 * 60 * 1000 // ±30 min pour éviter les doublons

  // Essai expirant dans ~7 jours
  const remind7 = await prisma.tenant.findMany({
    where: { status: 'trial', trialEnds: { gte: new Date(in7days.getTime() - window30), lte: new Date(in7days.getTime() + window30) } },
    include: { users: { where: { role: 'ADMIN' }, take: 1 } },
  })
  for (const tenant of remind7) {
    const admin = tenant.users[0]
    if (!admin?.email) continue
    const sales = await prisma.sale.aggregate({ where: { tenantId: tenant.id }, _sum: { total: true }, _count: { id: true } })
    await sendTrialReminder7Days({
      to: admin.email, shopName: tenant.name, ownerName: admin.name ?? tenant.name,
      caToday: sales._sum.total ?? 0, txCount: sales._count.id ?? 0, currency: 'XOF',
    }).catch(() => {})
  }

  // Essai expirant dans ~3 jours
  const remind3 = await prisma.tenant.findMany({
    where: { status: 'trial', trialEnds: { gte: new Date(in3days.getTime() - window30), lte: new Date(in3days.getTime() + window30) } },
    include: { users: { where: { role: 'ADMIN' }, take: 1 } },
  })
  for (const tenant of remind3) {
    const admin = tenant.users[0]
    if (!admin?.email) continue
    await sendTrialReminder3Days({ to: admin.email, shopName: tenant.name, ownerName: admin.name ?? tenant.name }).catch(() => {})
  }

  // Essai venant d'expirer (dernière fenêtre) → suspension + email
  const expired = await prisma.tenant.findMany({
    where: { status: 'trial', trialEnds: { gte: new Date(now.getTime() - window30), lte: now } },
    include: { users: { where: { role: 'ADMIN' }, take: 1 } },
  })
  for (const tenant of expired) {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'suspended', isActive: false, suspendedAt: new Date(), suspendReason: 'trial_expired' } }).catch(() => {})
    const admin = tenant.users[0]
    if (!admin?.email) continue
    await sendTrialExpired({ to: admin.email, shopName: tenant.name, ownerName: admin.name ?? tenant.name }).catch(() => {})
  }

  if (remind7.length + remind3.length + expired.length > 0) {
    console.log('📧 Cron emails:', { remind7: remind7.length, remind3: remind3.length, expired: expired.length })
  }
}

async function runWeeklyReports(): Promise<void> {
  const now          = new Date()
  const weekAgo      = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
  const twoWeeksAgo  = new Date(now.getTime() - 14 * 24 * 3600 * 1000)

  const tenants = await prisma.tenant.findMany({
    where: { isActive: true, status: { in: ['trial', 'active'] } },
    include: { users: { where: { role: 'ADMIN' }, take: 1 } },
  })

  for (const tenant of tenants) {
    const admin = tenant.users[0]
    if (!admin?.email) continue
    // Respect la préférence tenant : skip si rapports ventes email désactivés
    if ((tenant as { notifEmailSales?: boolean }).notifEmailSales === false) continue

    const [salesWeek, salesLastWeek, lowStock] = await Promise.all([
      prisma.sale.aggregate({ where: { tenantId: tenant.id, createdAt: { gte: weekAgo } }, _sum: { total: true }, _count: { id: true } }),
      prisma.sale.aggregate({ where: { tenantId: tenant.id, createdAt: { gte: twoWeeksAgo, lt: weekAgo } }, _sum: { total: true } }),
      prisma.product.count({ where: { tenantId: tenant.id, isActive: true, deletedAt: null, stockQty: { lte: prisma.product.fields.stockMin } } }).catch(() => 0),
    ])

    const topItems = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { tenantId: tenant.id, createdAt: { gte: weekAgo } } },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 1,
    }).catch(() => [] as { productId: string }[])

    let topProduct = 'Aucune vente cette semaine'
    if (topItems[0]) {
      const prod = await prisma.product.findUnique({ where: { id: topItems[0].productId }, select: { name: true } }).catch(() => null)
      if (prod) topProduct = prod.name
    }

    await sendWeeklyReport({
      to: admin.email, shopName: tenant.name, ownerName: admin.name ?? tenant.name,
      caWeek: salesWeek._sum.total ?? 0, txWeek: salesWeek._count.id ?? 0,
      caLastWeek: salesLastWeek._sum.total ?? 0, topProduct, lowStock: lowStock as number,
    }).catch(() => {})
  }

  console.log(`📊 Rapports hebdo envoyés: ${tenants.length}`)
}

// ─── Alertes stock quotidiennes ──────────────────────────────────────────
async function runDailyStockAlerts(): Promise<void> {
  // Tenants actifs/trial avec préférence notifEmailStock activée
  const tenants = await prisma.tenant.findMany({
    where: {
      isActive: true,
      status: { in: ['trial', 'active'] },
      notifEmailStock: true,
    },
    select: { id: true, name: true },
  })

  let sent = 0
  for (const tenant of tenants) {
    try {
      // Produits actifs en rupture (stockQty = 0) ou stock bas (stockQty <= stockMin)
      const lowStockProducts = await prisma.product.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          deletedAt: null,
          stockQty: { lte: prisma.product.fields.stockMin },
        },
        select: { name: true, stockQty: true, stockMin: true },
        orderBy: [{ stockQty: 'asc' }, { name: 'asc' }],
      })

      if (lowStockProducts.length === 0) continue

      // Email admin du tenant
      const admin = await prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
          isActive: true,
          deletedAt: null,
        },
        select: { email: true, name: true },
      })

      if (!admin?.email) continue

      const ok = await sendStockAlertEmail({
        to: admin.email,
        shopName: tenant.name,
        products: lowStockProducts,
      })
      if (ok) sent++
    } catch (err: any) {
      console.warn(`⚠️ Stock alert failed for tenant ${tenant.id}:`, err?.message)
    }
  }

  console.log(`📦 Alertes stock envoyées: ${sent}/${tenants.length} tenants`)
}

// Filets de sécurité process : on logge toujours ; en prod on ne crashe pas
// sur une promesse rejetée non gérée (Railway garde le service en ligne).
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason)
  Sentry.captureException(reason)
  if (process.env.NODE_ENV === 'production') return
  process.exit(1)
})
process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error)
  Sentry.captureException(error)
  await sendAlert('❌ HabaShop — Crash', `Erreur non gérée: ${error.message}`, 'error')
  process.exit(1)
})

// Arrêt propre
const shutdown = async () => {
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

start()
