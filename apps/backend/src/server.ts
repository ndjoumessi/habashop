import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import Redis from 'ioredis'
import { prisma } from './db'

// Routes
import { authRoutes }         from './routes/auth'
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
import { exportRoutes }       from './routes/export'
import { billingRoutes }      from './routes/billing'
import { adminRoutes }        from './routes/admin'
import { notificationRoutes } from './routes/notifications'
import { whatsappRoutes }     from './routes/whatsapp'
import { aiRoutes }           from './routes/ai'
import { docsRoutes }         from './routes/docs'

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
  if (process.env.REDIS_URL) {
    rateLimitOpts.redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    })
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
  app.setErrorHandler((error: any, _request, reply) => {
    if (error?.code === 'P2025') {
      return reply.code(404).send({ error: 'Ressource introuvable' })
    }
    app.log.error(error)
    return reply.code(error?.statusCode ?? 500).send({ error: error?.message ?? 'Erreur serveur' })
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
  await app.register(exportRoutes)
  await app.register(billingRoutes)
  await app.register(adminRoutes)
  await app.register(notificationRoutes)
  await app.register(whatsappRoutes)
  await app.register(aiRoutes)
  await app.register(docsRoutes)

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

// Filets de sécurité process : on logge toujours ; en prod on ne crashe pas
// sur une promesse rejetée non gérée (Railway garde le service en ligne).
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason)
  if (process.env.NODE_ENV === 'production') return
  process.exit(1)
})
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
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
