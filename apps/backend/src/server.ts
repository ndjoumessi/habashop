import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import { validatorCompiler } from 'fastify-type-provider-zod'
import { errorHandler } from './lib/errorHandler'
import { initTenantStore } from './lib/tenantContext'
import { getAppVersion } from './lib/version'
import * as Sentry from '@sentry/node'
import { prisma } from './db'
import { redis } from './redis'

// Routes
import { authRoutes }         from './routes/auth'
import { accountRoutes }      from './routes/account'
import { tenantRoutes }       from './routes/tenant'
import { productRoutes }      from './routes/products'
import { stockTransferRoutes } from './routes/stockTransfers'
import { customerRoutes }     from './routes/customers'
import { saleRoutes }         from './routes/sales'
import { ticketZRoutes }      from './routes/ticketZ'
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
import { mtnPaymentRoutes }    from './routes/mtnPayment'
import { campayPaymentRoutes } from './routes/campayPayment'
import { paydunyaPaymentRoutes } from './routes/paydunyaPayment'
import { paymentStatsRoutes }  from './routes/paymentStats'
import { integrationStatusRoutes } from './routes/integrationStatus'
import { adminRoutes }        from './routes/admin'
import { notificationRoutes } from './routes/notifications'
import { whatsappRoutes }     from './routes/whatsapp'
import { aiRoutes }           from './routes/ai'
import { docsRoutes }         from './routes/docs'
import { goalsRoutes }        from './routes/goals'
import { expenseBudgetRoutes } from './routes/expenseBudgets'
import { attendanceRoutes }   from './routes/attendance'
import { shiftRoutes }        from './routes/shifts'
import { leaveRequestRoutes } from './routes/leaveRequests'
import { subscriptionRoutes } from './routes/subscriptions'
import { integrationRoutes }  from './routes/integrations'
import { publicRoutes }       from './routes/public'
import { sendWeeklyReport } from './services/email'
import { runMonthlyPayrollReports } from './services/payrollReport'
import { payrollRoutes } from './routes/payroll'
import { runTrialReminders, runDailyStockAlerts, runDemoPiiSweep } from './services/notificationCrons'

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
// PayDunya : warning groupé (pas de crash) si l'intégration n'est pas (ou partiellement) configurée.
const PAYDUNYA_ENV_VARS = ['PAYDUNYA_MASTER_KEY', 'PAYDUNYA_PRIVATE_KEY', 'PAYDUNYA_PUBLIC_KEY', 'PAYDUNYA_TOKEN', 'PAYDUNYA_MODE']
const paydunyaMissing = PAYDUNYA_ENV_VARS.filter(v => !process.env[v])
if (paydunyaMissing.length > 0)
  console.warn(`⚠️  PayDunya non (ou partiellement) configuré — variables manquantes: ${paydunyaMissing.join(', ')}`)

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
  // bodyLimit 4 Mo : borne explicite (défaut Fastify = 1 Mo). Doit couvrir le plus gros
  // corps JSON légitime = photo employé base64 (front autorise 2 Mo brut → ~2,7 Mo base64,
  // cf. EditEmployeeModal). Les uploads multipart (OCR facture, 10 Mo) passent par
  // @fastify/multipart avec sa propre limite et ne sont PAS bornés par bodyLimit.
  const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 4 * 1024 * 1024 }) // derrière le proxy Railway : request.ip = vrai client (X-Forwarded-For) → clé rate-limit stable

  // Validation déclarative Zod : seul le validatorCompiler est posé (PAS le serializer)
  // → les réponses existantes ne sont pas touchées ; seules les routes qui déclarent
  // un `schema.body/params/querystring` zod sont validées. Les routes sans schéma sont
  // inchangées. Zod strip les clés inconnues et coerce les types déclarés.
  app.setValidatorCompiler(validatorCompiler)

  // Contexte tenant (item 8) : établi au plus tôt (contexte racine de la requête)
  // pour se propager jusqu'au handler ; `authenticate` y renseigne la boutique active.
  app.addHook('onRequest', (_req, _reply, done) => { initTenantStore(); done() })

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
  // GLOBAL : plafond de base par IP sur TOUTES les routes (défense anti-abus/scraping).
  // Les routes sensibles gardent leurs overrides plus stricts via config.rateLimit
  // (auth 5-30/fenêtre, checkouts 5/h, paiements 20/min) — un override par-route PRIME
  // sur ce défaut global. Les webhooks/IPN paiement et les health checks sont exemptés
  // (config.rateLimit:false sur leurs routes) pour ne jamais throttler un provider ou un moniteur.
  // Plafond généreux (300/min) : une boutique multi-caisses derrière un même NAT partage l'IP.
  // Plafond ajustable en prod via RATE_LIMIT_MAX (sans redéploiement) si une grosse boutique
  // multi-caisses derrière un même NAT le nécessite. Défaut 300/min. L'E2E prod (workers:1,
  // série) reste très en-dessous.
  const rateLimitOpts: any = {
    global: true,
    max: Number(process.env.RATE_LIMIT_MAX) || 300,
    timeWindow: '1 minute',
  }
  if (redis) {
    rateLimitOpts.redis = redis
    console.log('🧮 Rate-limit : store Redis partagé activé')
  } else {
    console.warn('⚠️  Rate-limit : REDIS_URL absent → store mémoire (non fiable en multi-replica)')
  }
  await app.register(rateLimit, rateLimitOpts)

  // ─── MULTIPART (upload factures OCR) ───
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } })

  // ─── FORM-URLENCODED (IPN PayDunya — clés à plat data[hash]/data[status]/…) ───
  // PayDunya poste son IPN en application/x-www-form-urlencoded avec des clés à crochets.
  // URLSearchParams donne des clés plates (ex. "data[hash]") → suffisant pour vérifier le hash.
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body: string, done) => {
    try { done(null, { _form: Object.fromEntries(new URLSearchParams(body)) }) }
    catch (err) { done(err as Error) }
  })

  // ─── WEBSOCKET ──────────────────────────
  await app.register(websocket)

  // ─── ERROR HANDLER ──────────────────────
  // Prisma P2025 = "record not found" → 404. Couvre les update/delete
  // scopés par tenant (where:{id, tenantId}) : un accès cross-tenant ne
  // matche aucun enregistrement et doit renvoyer 404, pas 500.
  // Handler extrait dans lib/errorHandler.ts (testable) — durci : un 500 ne fuite plus
  // error.message brut au client (audit P1.6). Voir le fichier pour le détail.
  app.setErrorHandler(errorHandler)

  // ─── HEALTH CHECK ───────────────────────
  // Exemptés du rate-limit global : sondes de monitoring / uptime pingées en continu.
  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    version: getAppVersion(), // source unique = package.json racine (jamais un littéral)
    timestamp: new Date().toISOString(),
  }))

  app.get('/api/health-extended', { config: { rateLimit: false } }, async (_request, reply) => {
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
      version: getAppVersion(), // source unique = package.json racine

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
      // ⚠️ `routes: ['/api/bonuses', '/api/salary-history']` A ÉTÉ SUPPRIMÉ. Un champ nommé
      // « routes » qui en listait DEUX sur 43 groupes enregistrés : reliquat de mise au point
      // de ces deux routes-là, jamais mis à jour, aucun consommateur. C'est le champ déclaré
      // qui se fait passer pour une mesure — et sa forme tronquée-en-silence par-dessus.
      // Le rendre juste voudrait dire énumérer les 43, ce que personne n'a demandé ; le
      // laisser à deux, c'est répondre faux à qui demande ce que le serveur expose.
      // ⚠️ `buildTime` A ÉTÉ RENOMMÉ EN `serverTime` — le champ n'a JAMAIS porté un temps
      // de build : c'était `new Date()`, donc l'instant de la RÉPONSE, le même appel que le
      // `timestamp` de `/health` sous un nom qui affirmait autre chose. Aucun consommateur
      // (mesuré : 1 occurrence dans tout le dépôt, sa propre définition) — le coût était
      // d'induire en erreur qui l'ouvre pour dater un déploiement.
      //
      // ⚠️ ET IL NE PEUT PAS ÊTRE RENDU VRAI ICI : `gen-version.mjs` ne bake aucun
      // horodatage, et il NO-OP dans l'image Docker (contexte = `apps/backend` seul, la
      // racine du monorepo est absente). Un horodatage baké dirait l'heure de la dernière
      // régénération LOCALE committée, pas celle du déploiement Railway — un mensonge plus
      // subtil que celui qu'on corrige. La preuve de déploiement reste `uptime` remis à
      // zéro, et `serverTime` en donne l'instant de bascule : boot = serverTime − uptime.
      serverTime: new Date().toISOString(),
    })
  })

  // ─── ROUTES ─────────────────────────────
  await app.register(authRoutes)
  await app.register(accountRoutes)
  await app.register(tenantRoutes)
  await app.register(expenseBudgetRoutes)
  await app.register(productRoutes)
  await app.register(stockTransferRoutes)
  await app.register(customerRoutes)
  await app.register(saleRoutes)
  await app.register(ticketZRoutes)
  await app.register(supplierRoutes)
  await app.register(orderRoutes)
  await app.register(employeeRoutes)
  await app.register(hrRoutes)
  await app.register(attendanceRoutes)
  await app.register(shiftRoutes)
  await app.register(leaveRequestRoutes)
  await app.register(expenseRoutes)
  await app.register(analyticsRoutes)
  await app.register(reportsRoutes)
  await app.register(payrollRoutes)
  await app.register(exportRoutes)
  await app.register(billingRoutes)
  await app.register(paymentRoutes)
  await app.register(mtnPaymentRoutes)
  await app.register(campayPaymentRoutes)
  await app.register(paydunyaPaymentRoutes)
  await app.register(integrationStatusRoutes)
  await app.register(paymentStatsRoutes)
  await app.register(adminRoutes)
  await app.register(notificationRoutes)
  await app.register(whatsappRoutes)
  await app.register(aiRoutes)
  await app.register(docsRoutes)
  await app.register(goalsRoutes)
  await app.register(subscriptionRoutes)
  await app.register(integrationRoutes)
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

  // Balayage PII des démos — lundi 9h (vérifié chaque heure). Après le rapport hebdo, pour
  // ne pas empiler deux tâches sur le même créneau.
  setInterval(() => {
    const now = new Date()
    if (now.getDay() !== 1 || now.getHours() !== 9 || now.getMinutes() > 5) return
    runDemoPiiSweep().catch(err => console.error('❌ Cron balayage PII démo:', err))
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
      // Item 8-B : scopé au tenant du rapport (findUnique par id nu = trou d'isolation).
      const prod = await prisma.product.findFirst({ where: { id: topItems[0].productId, tenantId: tenant.id }, select: { name: true } }).catch(() => null)
      if (prod) topProduct = prod.name
    }

    await sendWeeklyReport({
      tenantId: tenant.id,
      to: admin.email, shopName: tenant.name, ownerName: admin.name ?? tenant.name,
      caWeek: salesWeek._sum.total ?? 0, txWeek: salesWeek._count.id ?? 0,
      caLastWeek: salesLastWeek._sum.total ?? 0, topProduct, lowStock: lowStock as number,
    }).catch(() => {})
  }

  console.log(`📊 Rapports hebdo envoyés: ${tenants.length}`)
}

// ─── Alertes stock quotidiennes ──────────────────────────────────────────

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
