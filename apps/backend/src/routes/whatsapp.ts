import type { FastifyInstance } from 'fastify'
import { CronJob } from 'cron'
import { prisma } from '../db'
import { redis } from '../redis'
import { authenticate } from '../middleware/authenticate'
import { blockDemoTenant } from '../middleware/demoTenant'
import { sendWhatsApp, isTwilioConfigured, twilioVersion } from '../lib/spend/twilioClient'
import { redactPhone, redactError } from '../lib/redactPhone'
import { costQuota } from '../middleware/costQuota'
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
// ⚠️ Plus de client Twilio local : tout envoi passe par `lib/spend/twilioClient`,
// qui résout démo/statut/quota depuis le tenantId. Verrouillé par le méta-test
// `spendGuardAllowlist.test.ts`.

// ─── CRON: RÉSUMÉ SOIR ────────────────
async function sendEveningReport() {
  try {
    // Skip COMPLET des boutiques de démo : le cron n'a pas de requête, donc aucune
    // garde de route ne s'y applique — c'est ici que ça se joue (la garde du client
    // reste le filet de sécurité).
    const tenants = await prisma.tenant.findMany({ where: { isDemo: false } })
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
      // `ownerPhone` vient de `Tenant` : le titulaire EST le commerçant → flux `owner`.
      const res = await sendWhatsApp({ tenantId: tenant.id, to: ownerPhone, body: message, audience: 'owner' })
      if (res.sent > 0) console.log(`✅ Résumé soir envoyé pour ${tenant.name}`)
      else if (res.denied) console.warn(`⏭️  Résumé soir ignoré (${res.code}) pour ${tenant.name}`)
    }
  } catch (err) {
    console.error('Cron evening error:', redactError(err))
  }
}

// ─── CRON: ALERTE MATIN ───────────────
async function sendMorningStockAlert() {
  try {
    // Idem cron soir : les boutiques de démo sont exclues à la source.
    const tenants = await prisma.tenant.findMany({ where: { isDemo: false } })
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
      // `ownerPhone` vient de `Tenant` : le titulaire EST le commerçant → flux `owner`.
      const res = await sendWhatsApp({ tenantId: tenant.id, to: ownerPhone, body: message, audience: 'owner' })
      if (res.sent > 0) console.log(`✅ Alerte matin envoyée pour ${tenant.name}`)
      else if (res.denied) console.warn(`⏭️  Alerte matin ignorée (${res.code}) pour ${tenant.name}`)
    }
  } catch (err) {
    console.error('Cron morning error:', redactError(err))
  }
}

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  // Résumé soir tous les jours à 20h00, alerte matin à 8h00
  new CronJob('0 20 * * *', sendEveningReport, null, true, 'Africa/Dakar')
  new CronJob('0 8 * * *', sendMorningStockAlert, null, true, 'Africa/Dakar')
  console.log('⏰ Cron jobs planifiés : résumé 20h + alertes 8h')

  app.post('/api/whatsapp/send-ticket', { preHandler: [authenticate, blockDemoTenant, costQuota('whatsapp')] }, async (request, reply) => {
    const { phone, items, total, paymentMode, discount, reference } = request.body as { phone?: string; items?: any[]; total?: number; paymentMode?: string; discount?: number; reference?: string }

    if (!phone?.trim()) {
      return reply.code(400).send({ error: 'Numéro de téléphone requis' })
    }

    if (!isTwilioConfigured()) {
      console.error('❌ Twilio non configuré (SID/TOKEN/FROM)')
      return reply.code(503).send({
        error:   'Service WhatsApp non disponible',
        details: 'Variables TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN manquantes dans Railway',
      })
    }

    // ⚠️ Numéro transmis BRUT au client d'envoi : c'est lui qui met en E.164 (avec le
    // pays du tenant) puis en adresse `whatsapp:`. Le pré-formater ici court-circuiterait
    // la normalisation — un numéro déjà préfixé « + » est considéré international et
    // n'est plus rattachable à son pays.
    const waPhone = phone.trim()

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

    // ⚠️ Numéro CLIENT : caviardé avant journalisation (CLAUDE.md § PII).
    console.log('📱 Envoi WhatsApp vers:', redactPhone(waPhone))
    console.log('📤 From:', TWILIO_FROM)

    try {
      const res = await sendWhatsApp({ tenantId: request.tenantId, to: waPhone, body, audience: 'customer' })
      if (res.denied) return reply.code(res.code === 'QUOTA_EXCEEDED' ? 429 : 403).send({ error: res.message, code: res.code })
      // Écarté ≠ panne : le numéro n'a pas pu être résolu en E.164 sûr (il faut le
      // format international). Un 503 ferait croire à une indisponibilité Twilio.
      if ((res.skipped ?? 0) > 0 && res.sent === 0) {
        return reply.code(400).send({
          error: 'Numéro non reconnu — saisissez-le au format international (ex. +221771234567)',
          code:  'PHONE_NOT_INTERNATIONAL',
        })
      }
      if (res.sent === 0) return reply.code(503).send({ error: 'Envoi WhatsApp impossible' })
      console.log('✅ WhatsApp envoyé, SID:', res.sids[0])
      // `to` = l'adresse RÉELLEMENT remise à Twilio, pas la saisie : c'est ce qu'un
      // support rapproche du journal Twilio quand un client dit n'avoir rien reçu.
      return reply.send({ success: true, sid: res.sids[0], to: res.sentTo[0] })
    } catch (err) {
      console.error('❌ Twilio error code:', err.code)
      console.error('❌ Twilio error msg:', redactError(err))

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
    const configured = isTwilioConfigured()
    return reply.send({
      configured,
      sid_set:         !!(process.env.TWILIO_ACCOUNT_SID ?? '').trim(),
      token_set:       !!(process.env.TWILIO_AUTH_TOKEN  ?? '').trim(),
      from:            TWILIO_FROM,
      twilio_version:  twilioVersion(),
      status:          configured ? '✅ Ready' : '❌ Not configured',
    })
  })

  app.post('/api/whatsapp/send-alert', { preHandler: [authenticate, blockDemoTenant, costQuota('whatsapp')] }, async (request, reply) => {
    if (!canSendWhatsApp((request.user as any)?.role)) {
      return reply.code(403).send({ error: 'Accès refusé — rôle MANAGER ou ADMIN requis' })
    }
    const { phone, alertType, data, lang } = request.body as { phone?: string; alertType?: string; data?: any; lang?: string }

    // Garde de nullité alignée sur `send-ticket` : sans elle, `phone.trim()` plus bas
    // lève un TypeError que le catch transforme en 503 « service indisponible »,
    // faisant lire une panne Twilio là où il y a une requête malformée.
    if (!phone?.trim()) {
      return reply.code(400).send({ error: 'Numéro de téléphone requis' })
    }

    try {
      if (!isTwilioConfigured()) return reply.code(503).send({ error: 'Service WhatsApp non configuré' })
      // ⚠️ Numéro BRUT → le client d'envoi normalise. L'ancien `replace(/^0/, '')`
      // retirait le zéro de tête pour TOUS les pays : faux pour CI/BJ/CG qui le
      // conservent (`0701234567` devenait `+701234567`, rejeté par Twilio).
      const formattedPhone = phone.trim()

      let body = ''
      if (alertType === 'low_stock') {
        body = lang === 'fr'
          ? `⚠️ *HabaShop — Alerte Stock*\n\n🔴 *Rupture critique :*\n${(data.products ?? []).map((p) => `• ${p.name} — Stock: ${p.stock}/${p.threshold}`).join('\n')}\n\n📦 Commander immédiatement pour éviter la rupture.`
          : `⚠️ *HabaShop — Stock Alert*\n\n🔴 *Critical stock:*\n${(data.products ?? []).map((p) => `• ${p.name} — Stock: ${p.stock}/${p.threshold}`).join('\n')}\n\n📦 Order immediately to avoid stockout.`
      }

      if (!body) return reply.code(400).send({ error: 'alertType inconnu' })

      // Numéro fourni par l'appelant : rien ne prouve que c'est celui du commerçant
      // (`Tenant.ownerPhone` n'est pas consulté) → traité comme un tiers.
      const res = await sendWhatsApp({ tenantId: request.tenantId, to: formattedPhone, body, audience: 'customer' })
      if (res.denied) return reply.code(res.code === 'QUOTA_EXCEEDED' ? 429 : 403).send({ error: res.message, code: res.code })
      if ((res.skipped ?? 0) > 0 && res.sent === 0) {
        return reply.code(400).send({
          error: 'Numéro non reconnu — saisissez-le au format international (ex. +221771234567)',
          code:  'PHONE_NOT_INTERNATIONAL',
        })
      }
      if (res.sent === 0) return reply.code(503).send({ error: 'Envoi WhatsApp impossible' })
      return { success: true, sid: res.sids[0], to: res.sentTo[0] }
    } catch (err) {
      console.error('Twilio alert error:', redactError(err))
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
  app.post('/api/whatsapp/broadcast', { preHandler: [authenticate, blockDemoTenant, costQuota('whatsapp')] }, async (request, reply) => {
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

    // Le quota est réservé pour les N destinataires AVANT le premier envoi : soit tout
    // part, soit rien (pas de diffusion tronquée à mi-liste).
    const res = await sendWhatsApp({ tenantId: request.tenantId, to: phones, body: message, audience: 'customer' })
    if (res.denied) return reply.code(res.code === 'QUOTA_EXCEEDED' ? 429 : 403).send({ error: res.message, code: res.code })

    return { sent: res.sent, failed: res.failed ?? 0, skipped: res.skipped ?? 0 }
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
  app.post('/api/marketing/whatsapp/campaign', { preHandler: [authenticate, blockDemoTenant, costQuota('whatsapp')] }, async (request: any, reply: any) => {
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

    // ⚠️ Numéros BRUTS → le client d'envoi normalise (même règle que toutes les autres
    // surfaces d'envoi). L'ancien `replace(/^0/, '')` divergeait de `broadcast` et
    // cassait les numéros ivoiriens/béninois, qui conservent leur zéro de tête.
    const phones = customers.map(c => c.phone!).filter(Boolean).map(p => p.trim())

    // ⚠️ Le quota compte des MESSAGES, pas des requêtes : une campagne de N destinataires
    // réserve N unités AVANT la boucle. Si ça ne rentre pas, l'envoi entier est refusé
    // (message nommant le restant et le requis) plutôt que tronqué à mi-cible.
    const res = await sendWhatsApp({ tenantId, to: phones, body: message, audience: 'customer' })
    if (res.denied) {
      return reply.code(res.code === 'QUOTA_EXCEEDED' ? 429 : 403).send({
        error: res.message, code: res.code, recipientCount: phones.length,
      })
    }
    const sent = res.sent
    const failed = res.failed ?? 0
    // Destinataires écartés faute de numéro international : ni envoyés, ni en échec
    // Twilio. Non stockés en colonne dédiée (ce serait une migration, hors de cette
    // surface) mais DÉDUCTIBLES de la ligne : recipientCount − sentCount − failedCount.
    const skipped = res.skipped ?? 0

    // Enregistre la campagne (idempotent — une seule ligne par envoi)
    await prisma.campaign.create({
      data: { tenantId, sentBy: userId, message, segment, recipientCount: phones.length, sentCount: sent, failedCount: failed },
    }).catch(() => {})

    return { sent, failed, skipped, recipientCount: phones.length }
  })
}
