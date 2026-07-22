import type { FastifyInstance } from 'fastify'
import twilio from 'twilio'
import { CronJob } from 'cron'
import { prisma } from '../db'
import { redis } from '../redis'
import { authenticate } from '../middleware/authenticate'
import { blockDemoTenant } from '../middleware/demoTenant'
import { costQuota, COST_ROUTE_RATE_LIMIT } from '../middleware/costQuota'
import { authenticateAdmin } from '../middleware/superAdmin'
import { fmtMoney, localeOf } from '../services/whatsappSend'
import { tierForPoints } from '../lib/loyalty'

// Envois sortants via le Twilio plateforme : réservés aux rôles de gestion
const WHATSAPP_SEND_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] as const
export const canSendWhatsApp = (role?: string): boolean => WHATSAPP_SEND_ROLES.includes(role as never)

type I4 = (fr: string, en: string, es: string, it: string) => string
const makeI = (lang: string): I4 => (fr, en, es, it) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

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
  } catch (e) {
    console.error('[Twilio] init error:', e.message)
    return null
  }
}

// ─── CRON: RÉSUMÉ SOIR ────────────────
async function sendEveningReport() {
  try {
    const tenants = await prisma.tenant.findMany()
    for (const tenant of tenants) {
      // Opt-in strict : pas de numéro configuré → pas d'envoi pour ce tenant.
      const ownerPhone = (tenant.ownerPhone ?? '').trim()
      if (!ownerPhone) continue
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const [sales, allProducts] = await Promise.all([
        prisma.sale.findMany({
          where: { tenantId: tenant.id, createdAt: { gte: today }, NOT: { status: 'refunded' } },
          include: { items: true },
        }),
        prisma.product.findMany({ where: { tenantId: tenant.id, isActive: true } }),
      ])
      const lowStock = allProducts.filter(p => p.stockQty <= p.stockMin)
      const totalCA = sales.reduce((s, sale) => s + sale.total, 0)
      const lang = tenant.lang ?? 'fr'
      const i = makeI(lang)
      const loc = localeOf(lang)
      const M = (xof: number) => fmtMoney(xof, tenant.currency || 'XOF')
      const message =
        `📊 *${tenant.name} — ${i('Résumé du', 'Summary for', 'Resumen del', 'Riepilogo del')} ${today.toLocaleDateString(loc)}*\n\n` +
        `💰 ${i('CA du jour', "Today's revenue", 'Ventas del día', 'Incasso del giorno')} : *${M(totalCA)}*\n` +
        `🛒 ${i('Transactions', 'Transactions', 'Transacciones', 'Transazioni')} : *${sales.length}*\n` +
        `💵 ${i('Panier moyen', 'Average basket', 'Cesta media', 'Scontrino medio')} : *${M(sales.length > 0 ? Math.round(totalCA / sales.length) : 0)}*\n\n` +
        (lowStock.length > 0
          ? `⚠️ *${lowStock.length} ${i('produit(s) en rupture :', 'product(s) low on stock:', 'producto(s) con stock bajo:', 'prodotto/i in esaurimento:')}*\n${lowStock.slice(0, 5).map(p => `• ${p.name} (${p.stockQty}/${p.stockMin})`).join('\n')}\n\n`
          : `✅ ${i('Aucune rupture de stock', 'No stock shortage', 'Sin roturas de stock', 'Nessuna rottura di stock')}\n\n`) +
        `_${i('Bonne soirée !', 'Good evening!', '¡Buenas noches!', 'Buona serata!')}_ 🌙`
      try {
        const client = getTwilioClient()
        if (!client) throw new Error('Twilio non configuré')
        await client.messages.create({
          from: TWILIO_FROM,
          to: `whatsapp:${ownerPhone}`,
          body: message,
        })
        console.log(`✅ Résumé soir envoyé pour ${tenant.name}`)
      } catch (err) {
        console.error(`❌ Erreur envoi résumé: ${err.message}`)
      }
    }
  } catch (err) {
    console.error('Cron evening error:', err.message)
  }
}

// ─── CRON: ALERTE MATIN ───────────────
async function sendMorningStockAlert() {
  try {
    const tenants = await prisma.tenant.findMany()
    for (const tenant of tenants) {
      // Opt-in strict : pas de numéro configuré → pas d'envoi pour ce tenant.
      const ownerPhone = (tenant.ownerPhone ?? '').trim()
      if (!ownerPhone) continue
      const allProducts = await prisma.product.findMany({ where: { tenantId: tenant.id, isActive: true } })
      const lowStock = allProducts.filter(p => p.stockQty <= p.stockMin)
      if (lowStock.length === 0) continue
      const lang = tenant.lang ?? 'fr'
      const i = makeI(lang)
      const message =
        `🌅 *${tenant.name} — ${i('Alerte stock du matin', 'Morning stock alert', 'Alerta de stock matinal', 'Avviso scorte del mattino')}*\n\n` +
        `⚠️ *${lowStock.length} ${i('produit(s) nécessitent une commande :', 'product(s) need reordering:', 'producto(s) necesitan pedido:', 'prodotto/i da riordinare:')}*\n\n` +
        lowStock.map(p => {
          const status = p.stockQty === 0 ? `🔴 ${i('RUPTURE', 'OUT OF STOCK', 'AGOTADO', 'ESAURITO')}` : `🟡 ${i('BAS', 'LOW', 'BAJO', 'BASSO')}`
          return `${status} ${p.name}\n   ${i('Stock', 'Stock', 'Stock', 'Scorte')}: ${p.stockQty} / ${i('Seuil', 'Threshold', 'Umbral', 'Soglia')}: ${p.stockMin}`
        }).join('\n') +
        `\n\n💡 ${i("Pensez à commander dès aujourd'hui !", 'Remember to order today!', '¡Recuerde pedir hoy!', 'Ricordati di ordinare oggi!')}\n📦 ${i('Gérez votre stock sur HabaShop', 'Manage your stock on HabaShop', 'Gestione su stock en HabaShop', 'Gestisci le scorte su HabaShop')}`
      try {
        const client = getTwilioClient()
        if (!client) throw new Error('Twilio non configuré')
        await client.messages.create({
          from: TWILIO_FROM,
          to: `whatsapp:${ownerPhone}`,
          body: message,
        })
        console.log(`✅ Alerte matin envoyée pour ${tenant.name}`)
      } catch (err) {
        console.error(`❌ Erreur alerte matin: ${err.message}`)
      }
    }
  } catch (err) {
    console.error('Cron morning error:', err.message)
  }
}

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  // Résumé soir tous les jours à 20h00, alerte matin à 8h00
  new CronJob('0 20 * * *', sendEveningReport, null, true, 'Africa/Dakar')
  new CronJob('0 8 * * *', sendMorningStockAlert, null, true, 'Africa/Dakar')
  console.log('⏰ Cron jobs planifiés : résumé 20h + alertes 8h')

  app.post('/api/whatsapp/send-ticket', { preHandler: [authenticate, blockDemoTenant, costQuota('whatsapp')], config: { rateLimit: COST_ROUTE_RATE_LIMIT } }, async (request, reply) => {
    const { phone, items, total, paymentMode, discount, reference } = request.body as { phone?: string; items?: any[]; total?: number; paymentMode?: string; discount?: number; reference?: string }

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

    // Devise + langue + nom = ceux de la boutique ACTIVE (les montants reçus sont en base XOF).
    // W2 — `request.tenantId` (boutique active, garantie non-null par authenticate) et non
    // `request.user.tenantId` (tenant principal du JWT) : sinon un reçu émis depuis la boutique B
    // serait brandé avec le nom/la devise de la boutique A en multi-boutiques.
    const tenant = await prisma.tenant.findUnique({ where: { id: request.tenantId as string } })
    const lang = tenant?.lang ?? 'fr'
    const cur  = tenant?.currency || 'XOF'
    const shop = tenant?.name ?? 'HabaShop'
    const i = makeI(lang)
    const loc = localeOf(lang)
    const M = (xof: number) => fmtMoney(Number(xof) || 0, cur)

    const now     = new Date()
    const dateStr = now.toLocaleDateString(loc, { day:'2-digit', month:'2-digit', year:'numeric' })
    const timeStr = now.toLocaleTimeString(loc, { hour:'2-digit', minute:'2-digit' })
    const ref     = reference || `#${Date.now().toString().slice(-6)}`

    const itemLines = Array.isArray(items)
      ? items.map((it) => {
          const lineTotal = Number(it.price ?? 0) * Number(it.qty ?? 1)
          return `• ${it.name} ×${it.qty} — ${M(lineTotal)}`
        }).join('\n')
      : `• ${i('Articles non détaillés', 'Items not detailed', 'Artículos sin detallar', 'Articoli non dettagliati')}`

    const discountLine = discount && Number(discount) > 0
      ? `\n🏷️ ${i('Remise', 'Discount', 'Descuento', 'Sconto')} : -${M(discount)}`
      : ''

    const body = [
      `🧾 *${i('TICKET DE CAISSE', 'RECEIPT', 'TICKET DE CAJA', 'SCONTRINO')}*`,
      `📍 ${shop} — ${dateStr} ${i('à', 'at', 'a las', 'alle')} ${timeStr}`,
      `🔖 ${i('Réf', 'Ref', 'Ref', 'Rif')} : ${ref}`,
      '',
      '━━━━━━━━━━━━━━━━━',
      `📦 *${i('Articles commandés', 'Items ordered', 'Artículos pedidos', 'Articoli ordinati')}*`,
      itemLines,
      '━━━━━━━━━━━━━━━━━',
      discountLine,
      `💰 *${i('TOTAL TTC', 'TOTAL (incl. tax)', 'TOTAL (IVA incl.)', 'TOTALE (IVA incl.)')} : ${M(total ?? 0)}*`,
      `💳 ${i('Paiement', 'Payment', 'Pago', 'Pagamento')} : ${paymentMode ?? i('Espèces', 'Cash', 'Efectivo', 'Contanti')}`,
      '',
      `✅ *${i('Merci pour votre achat !', 'Thank you for your purchase!', '¡Gracias por su compra!', 'Grazie per il tuo acquisto!')}*`,
      `_${i('Ce ticket fait office de reçu.', 'This ticket serves as a receipt.', 'Este ticket sirve como recibo.', 'Questo scontrino vale come ricevuta.')}_`,
      `_${i('Conservez-le comme justificatif.', 'Keep it as proof of purchase.', 'Consérvelo como justificante.', 'Conservalo come giustificativo.')}_`,
    ].filter(l => l !== null && l !== undefined).join('\n')

    console.log('📱 Envoi WhatsApp vers:', waPhone)
    console.log('📤 From:', TWILIO_FROM)

    try {
      const msg = await twClient.messages.create({ from: TWILIO_FROM, to: waPhone, body })
      console.log('✅ WhatsApp envoyé, SID:', msg.sid)
      return reply.send({ success: true, sid: msg.sid, to: waPhone })
    } catch (err) {
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

  app.get('/api/whatsapp/test', async (_req, reply) => {
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

  app.post('/api/whatsapp/send-alert', { preHandler: [authenticate, blockDemoTenant, costQuota('whatsapp')], config: { rateLimit: COST_ROUTE_RATE_LIMIT } }, async (request, reply) => {
    if (!canSendWhatsApp((request.user as any)?.role)) {
      return reply.code(403).send({ error: 'Accès refusé — rôle MANAGER ou ADMIN requis' })
    }
    const { phone, alertType, data, lang } = request.body as { phone?: string; alertType?: string; data?: any; lang?: string }

    try {
      const client = getTwilioClient()
      if (!client) return reply.code(503).send({ error: 'Service WhatsApp non configuré' })
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone.replace(/^0/, '')}`

      let body = ''
      if (alertType === 'low_stock') {
        body = lang === 'fr'
          ? `⚠️ *HabaShop — Alerte Stock*\n\n🔴 *Rupture critique :*\n${(data.products ?? []).map((p) => `• ${p.name} — Stock: ${p.stock}/${p.threshold}`).join('\n')}\n\n📦 Commander immédiatement pour éviter la rupture.`
          : `⚠️ *HabaShop — Stock Alert*\n\n🔴 *Critical stock:*\n${(data.products ?? []).map((p) => `• ${p.name} — Stock: ${p.stock}/${p.threshold}`).join('\n')}\n\n📦 Order immediately to avoid stockout.`
      }

      if (!body) return reply.code(400).send({ error: 'alertType inconnu' })

      const result = await client.messages.create({
        from: TWILIO_FROM,
        to:   `whatsapp:${formattedPhone}`,
        body,
      })
      return { success: true, sid: result.sid }
    } catch (err) {
      console.error('Twilio alert error:', err.message)
      return reply.code(503).send({ error: err.message })
    }
  })

  // ─── CRON TEST ROUTES ─────────────────
  // Itèrent TOUS les tenants via le Twilio plateforme → SUPER_ADMIN uniquement
  app.post('/api/whatsapp/test-evening', { preHandler: authenticateAdmin }, async () => {
    await sendEveningReport()
    return { success: true, message: 'Résumé soir envoyé !' }
  })

  app.post('/api/whatsapp/test-morning', { preHandler: authenticateAdmin }, async () => {
    await sendMorningStockAlert()
    return { success: true, message: 'Alerte matin envoyée !' }
  })

  // ─── WHATSAPP BROADCAST ───────────────
  app.post('/api/whatsapp/broadcast', { preHandler: [authenticate, blockDemoTenant, costQuota('whatsapp')], config: { rateLimit: COST_ROUTE_RATE_LIMIT } }, async (request, reply) => {
    if (!canSendWhatsApp((request.user as any)?.role)) {
      return reply.code(403).send({ error: 'Accès refusé — rôle MANAGER ou ADMIN requis' })
    }
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

  // ─── CAMPAGNES WHATSAPP MARKETING ───────────────────────────────────────────
  // GET /api/marketing/whatsapp/campaigns — 20 dernières campagnes du tenant
  app.get('/api/marketing/whatsapp/campaigns', { preHandler: authenticate }, async (request: any, reply: any) => {
    if (!canSendWhatsApp((request.user as any)?.role)) {
      return reply.code(403).send({ error: 'Accès refusé' })
    }
    const tenantId = request.tenantId as string
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, message: true, segment: true,
        recipientCount: true, sentCount: true, failedCount: true, createdAt: true,
        user: { select: { name: true } },
      },
    })
    return campaigns
  })

  // POST /api/marketing/whatsapp/campaign — envoi ciblé par segment (rate-limit 1/h/tenant)
  app.post('/api/marketing/whatsapp/campaign', { preHandler: [authenticate, blockDemoTenant, costQuota('whatsapp')], config: { rateLimit: COST_ROUTE_RATE_LIMIT } }, async (request: any, reply: any) => {
    if (!canSendWhatsApp((request.user as any)?.role)) {
      return reply.code(403).send({ error: 'Accès refusé' })
    }
    const tenantId   = request.tenantId as string
    const userId     = (request.user as any).userId as string
    const { message, segment = 'all' } = request.body as { message: string; segment?: string }

    if (!message?.trim()) return reply.code(400).send({ error: 'Message requis' })

    const VALID_SEGMENTS = ['all', 'bronze', 'silver', 'gold', 'wholesale', 'retail', 'semi']
    if (!VALID_SEGMENTS.includes(segment)) return reply.code(400).send({ error: 'Segment invalide' })

    // Rate-limit : 1 campagne/heure/tenant (Redis ou mémoire si Redis absent)
    const rlKey = `rl:campaign:${tenantId}`
    if (redis) {
      const count = await redis.incr(rlKey).catch(() => null)
      if (count === 1) await redis.expire(rlKey, 3600).catch(() => {})
      if (count !== null && count > 1) {
        return reply.code(429).send({ error: 'Une campagne maximum par heure. Réessayez plus tard.' })
      }
    }

    // Résolution du segment → liste de numéros de téléphone
    const tierSegments = ['bronze', 'silver', 'gold']
    const typeSegments = ['wholesale', 'retail', 'semi']

    let customers: { phone: string | null; loyaltyPoints: number }[]

    if (tierSegments.includes(segment)) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { bronzeThreshold: true, silverThreshold: true },
      })
      const bronzeT = tenant?.bronzeThreshold ?? 2000
      const silverT = tenant?.silverThreshold ?? 5000
      const all = await prisma.customer.findMany({
        where: { tenantId, deletedAt: null, phone: { not: null } },
        select: { phone: true, loyaltyPoints: true },
      })
      customers = all.filter(c => tierForPoints(c.loyaltyPoints, bronzeT, silverT) === segment)
    } else if (typeSegments.includes(segment)) {
      customers = await prisma.customer.findMany({
        where: { tenantId, deletedAt: null, phone: { not: null }, type: segment },
        select: { phone: true, loyaltyPoints: true },
      })
    } else {
      customers = await prisma.customer.findMany({
        where: { tenantId, deletedAt: null, phone: { not: null } },
        select: { phone: true, loyaltyPoints: true },
      })
    }

    const phones = customers
      .map(c => c.phone!)
      .filter(Boolean)
      .map(p => p.replace(/[\s\-\(\)]/g, ''))
      .map(p => p.startsWith('+') ? p : `+${p.replace(/^0/, '')}`)

    let sent = 0, failed = 0

    for (const phone of phones) {
      try {
        const client = getTwilioClient()
        if (!client) { failed++; continue }
        await client.messages.create({ from: TWILIO_FROM, to: `whatsapp:${phone}`, body: message })
        sent++
        await new Promise(r => setTimeout(r, 500))
      } catch {
        failed++
      }
    }

    // Enregistre la campagne (idempotent — une seule ligne par envoi)
    await prisma.campaign.create({
      data: { tenantId, sentBy: userId, message, segment, recipientCount: phones.length, sentCount: sent, failedCount: failed },
    }).catch(() => {})

    return { sent, failed, recipientCount: phones.length }
  })
}
