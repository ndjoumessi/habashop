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
import { tierForPoints, LOYALTY_TIERS } from '../lib/loyalty'
import { CLIENT_TYPES } from '../lib/clientType'

// Segments de campagne — UNE source par famille, et la liste valide en DÉCOULE.
// ⚠️ DÉRIVÉS des paliers réels, en minuscules — c'est le vocabulaire du fil (le front
// envoie 'bronze'). Écrits à la main, ils ne correspondaient à RIEN : `tierForPoints` rend
// 'Bronze' (capitalisé) et la comparaison `=== segment` échouait toujours. Les TROIS
// segments de fidélité ciblaient donc 0 destinataire, en silence, depuis leur création.
const TIER_SEGMENTS: readonly string[] = LOYALTY_TIERS.map(t => t.toLowerCase())
const ALL_SEGMENT = 'all'
const VALID_SEGMENTS: readonly string[] = [ALL_SEGMENT, ...TIER_SEGMENTS, ...CLIENT_TYPES]

// Envois sortants via le Twilio plateforme : réservés aux rôles de gestion
const WHATSAPP_SEND_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] as const
export const canSendWhatsApp = (role?: string): boolean => WHATSAPP_SEND_ROLES.includes(role as never)

/**
 * Motifs Twilio actionnables. Cette table vivait DANS le `catch` de `send-ticket`,
 * donc dans un bloc MORT : `sendWhatsApp` ne throw jamais (fire-and-forget). Les
 * codes remontent maintenant par `SendResult.errorCodes`, ce qui la rend atteignable.
 */
export const TWILIO_ERRORS: Record<number, string> = {
  21608: "Ce numéro n'est pas inscrit sur WhatsApp",
  21211: 'Format de numéro invalide',
  21614: 'Numéro non joignable sur WhatsApp',
  63007: 'Canal WhatsApp non disponible',
  63016: 'Message non livrable',
  20003: 'Authentification Twilio échouée',
  21401: 'Numéro expéditeur invalide',
  21606: 'Numéro non activé pour WhatsApp',
}

/** Message actionnable pour un code Twilio, ou `null` si le code est inconnu. */
export function twilioErrorMessage(code?: number): string | null {
  return (code !== undefined && TWILIO_ERRORS[code]) || null
}

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
      const res = await sendWhatsApp({ tenantId: tenant.id, to: ownerPhone, body: message, owner: { kind: 'merchant', country: tenant.country }, flow: 'transactional' })
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
      const res = await sendWhatsApp({ tenantId: tenant.id, to: ownerPhone, body: message, owner: { kind: 'merchant', country: tenant.country }, flow: 'transactional' })
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

    // Le numéro vient du CORPS DE REQUÊTE → tiers, pays inconnu. Aucune
    // pré-transformation ici : le goulot `sendWhatsApp` est la seule autorité.

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
    console.log('📱 Envoi WhatsApp vers:', redactPhone(phone))
    console.log('📤 From:', TWILIO_FROM)

    try {
      const res = await sendWhatsApp({ tenantId: request.tenantId, to: phone, body, owner: { kind: 'customer' }, flow: 'transactional' })
      if (res.denied) return reply.code(res.code === 'QUOTA_EXCEEDED' ? 429 : 403).send({ error: res.message, code: res.code })
      // Refus de résolution : message EXPLICITE, jamais un 503 générique qui laisse
      // croire à une panne Twilio alors que le numéro n'est simplement pas exploitable.
      if (res.refused?.length) {
        return reply.code(422).send({
          error: 'Numéro non exploitable — un format international (+indicatif) est requis',
          code:  res.refused[0].reason,
        })
      }
      // Échec d'ENVOI : le motif Twilio remonte par la valeur de retour. Un 503
      // générique laisserait croire à une panne serveur là où le numéro n'est
      // simplement pas inscrit sur WhatsApp — le caissier ne peut rien en faire.
      if (res.sent === 0) {
        const code = res.errorCodes?.[0]
        const mapped = twilioErrorMessage(code)
        return reply.code(mapped ? 502 : 503).send({
          error: mapped ?? 'Envoi WhatsApp impossible',
          ...(code !== undefined ? { code } : {}),
        })
      }
      console.log('✅ WhatsApp envoyé, SID:', res.sids[0])
      return reply.send({ success: true, sid: res.sids[0] })
    } catch (err) {
      // Chemin résiduel : `sendWhatsApp` ne throw pas (contrat fire-and-forget), donc
      // seule une erreur de CONSTRUCTION du message peut arriver ici. Les échecs
      // d'ENVOI passent désormais par `res.errorCodes` au-dessus.
      console.error('❌ Erreur send-ticket:', redactError(err))
      return reply.code(500).send({ error: "Erreur lors de l'envoi" })
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

    try {
      if (!isTwilioConfigured()) return reply.code(503).send({ error: 'Service WhatsApp non configuré' })
      // Numéro reçu du CORPS DE REQUÊTE → tiers. L'ancien `replace(/^0/, '')`
      // transformait 0622123456 en +622123456, numéro INDONÉSIEN valide donc livrable.

      // ⚠️ C'était `lang === 'fr' ? [FR] : [EN]` — un commerçant espagnol ou italien
      // recevait son alerte de rupture en ANGLAIS. Table exhaustive sur les 4 langues,
      // repli FRANÇAIS (langue par défaut du produit), pas anglais.
      const ALERT_COPY = {
        fr: { title: 'Alerte Stock',  head: 'Rupture critique :',  cta: 'Commander immédiatement pour éviter la rupture.' },
        en: { title: 'Stock Alert',   head: 'Critical stock:',     cta: 'Order immediately to avoid stockout.' },
        es: { title: 'Alerta Stock',  head: 'Stock crítico:',      cta: 'Pedir de inmediato para evitar la rotura.' },
        it: { title: 'Avviso Scorte', head: 'Scorte critiche:',    cta: 'Ordinare subito per evitare la rottura di stock.' },
      } as const
      type AlertLang = keyof typeof ALERT_COPY
      const isAlertLang = (v: unknown): v is AlertLang => typeof v === 'string' && v in ALERT_COPY

      let body = ''
      if (alertType === 'low_stock') {
        const c = ALERT_COPY[isAlertLang(lang) ? lang : 'fr']
        const lignes = (data.products ?? [])
          .map((p: { name: string; stock: number; threshold: number }) => `• ${p.name} — Stock: ${p.stock}/${p.threshold}`)
          .join('\n')
        body = `⚠️ *HabaShop — ${c.title}*\n\n🔴 *${c.head}*\n${lignes}\n\n📦 ${c.cta}`
      }

      if (!body) return reply.code(400).send({ error: 'alertType inconnu' })

      // `phone` (corps de requête) est optionnel et non validé ici ; un `undefined` est
      // déjà géré gracieusement en aval (recipients vides → 503). `?? ''` satisfait le
      // typage sans changer ce comportement (`''` est filtré comme `undefined`).
      const res = await sendWhatsApp({ tenantId: request.tenantId, to: phone ?? '', body, owner: { kind: 'customer' }, flow: 'transactional' })
      if (res.denied) return reply.code(res.code === 'QUOTA_EXCEEDED' ? 429 : 403).send({ error: res.message, code: res.code })
      // Refus de résolution : message EXPLICITE, jamais un 503 générique qui laisse
      // croire à une panne Twilio alors que le numéro n'est simplement pas exploitable.
      if (res.refused?.length) {
        return reply.code(422).send({
          error: 'Numéro non exploitable — un format international (+indicatif) est requis',
          code:  res.refused[0].reason,
        })
      }
      if (res.sent === 0) return reply.code(503).send({ error: 'Envoi WhatsApp impossible' })
      return { success: true, sid: res.sids[0] }
    } catch (err) {
      console.error('Twilio alert error:', redactError(err))
      return reply.code(503).send({ error: (err as Error).message })
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
    const res = await sendWhatsApp({ tenantId: request.tenantId, to: phones, body: message, owner: { kind: 'customer' }, flow: 'marketing' })
    if (res.denied) return reply.code(res.code === 'QUOTA_EXCEEDED' ? 429 : 403).send({ error: res.message, code: res.code })

    // `refused` = destinataires écartés faute d'E.164 certain. Remonté pour que
    // l'UI le dise, au lieu d'un « envoyé » qui masque les silencieux.
    return { sent: res.sent, failed: res.failed ?? 0, refused: res.refused ?? [] }
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

    // ⚠️ DÉRIVÉE, jamais ré-écrite : c'était une TROISIÈME liste tenue à la main, et elle
    // contenait encore 'semi' après que `typeSegments` a été lié à CLIENT_TYPES. Un segment
    // qui franchit cette porte sans être traité plus bas tombe dans le `else`, lequel
    // sélectionnait TOUS les clients : « 0 destinataire en silence » serait devenu
    // « toute la base en silence », sur un canal FACTURÉ. Trois listes qui doivent
    // s'accorder finissent toujours par diverger — il n'y en a plus qu'une source.
    if (!VALID_SEGMENTS.includes(segment)) return reply.code(400).send({ error: 'Segment invalide', code: 'INVALID_SEGMENT' })

    // Rate-limit : 1 campagne/heure/tenant. RÉSERVE-PUIS-LIBÈRE (finding [3]) : on
    // incrémente d'abord — ce qui bloque une 2e campagne concurrente — mais on LIBÈRE
    // le créneau si la campagne finit par n'envoyer aucun message (segment vide, tous
    // non résolvables, Twilio absent, quota refusé). Le créneau ne doit se consommer
    // que sur un envoi RÉEL.
    //
    // TTL : `expire` n'est (re)posé que sur la transition à 1. Un `decr` ramenant à 0
    // laisse une clé « 0 » avec son TTL d'origine — inoffensif : `0` ne déclenche
    // jamais le rejet `> 1`, et la campagne suivante ré-arme la fenêtre en repassant
    // par 1. On ne réinitialise donc jamais le TTL à tort, et aucun TTL périmé ne bloque.
    const rlKey = `rl:campaign:${tenantId}`
    let slotTaken = false
    if (redis) {
      const count = await redis.incr(rlKey).catch(() => null)
      if (count === 1) await redis.expire(rlKey, 3600).catch(() => {})
      if (count !== null && count > 1) {
        // Cette tentative est rejetée : elle ne prend pas le créneau (déjà tenu par la
        // campagne en cours). On rend son propre incrément pour ne pas gonfler le compteur.
        await redis.decr(rlKey).catch(() => {})
        return reply.code(429).send({ error: 'Une campagne maximum par heure. Réessayez plus tard.' })
      }
      slotTaken = count !== null
    }
    // Rend le créneau réservé si, au final, rien n'est parti.
    const releaseSlot = async (): Promise<void> => {
      if (slotTaken && redis) await redis.decr(rlKey).catch(() => {})
    }

    // Résolution du segment → liste de numéros de téléphone
    const tierSegments = TIER_SEGMENTS
    // ⚠️ Liés à l'ENUM CANONIQUE (#215), pas ré-écrits à la main : la branche ci-dessous
    // filtre `type: segment` en base, donc un segment qui n'est pas une valeur canonique ne
    // matche RIEN — en silence. C'était le cas de `'semi'` (le canonique est
    // `'semi-wholesale'`, `'semi'` appartient au vocabulaire de `Sale.clientType`, qui
    // désigne un tarif de vente, pas un palier client) : une campagne sur ce segment
    // partait vers 0 destinataire sans lever quoi que ce soit. Lier la liste à
    // `CLIENT_TYPES` rend cette divergence impossible plutôt que de la corriger une fois.
    const typeSegments: readonly string[] = CLIENT_TYPES

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
      customers = all.filter(c => tierForPoints(c.loyaltyPoints, bronzeT, silverT).toLowerCase() === segment)
    } else if (typeSegments.includes(segment)) {
      customers = await prisma.customer.findMany({
        where: { tenantId, deletedAt: null, phone: { not: null }, type: segment },
        select: { phone: true, loyaltyPoints: true },
      })
    } else if (segment === ALL_SEGMENT) {
      customers = await prisma.customer.findMany({
        where: { tenantId, deletedAt: null, phone: { not: null } },
        select: { phone: true, loyaltyPoints: true },
      })
    } else {
      // ⚠️ Inatteignable tant que VALID_SEGMENTS reste dérivée — et c'est le but : « tous
      // les clients » doit être DEMANDÉ explicitement, jamais le repli d'un segment que
      // personne n'a traité. Un futur segment ajouté à la liste sans branche s'arrête ici
      // au lieu d'arroser toute la base.
      await releaseSlot()
      return reply.code(400).send({ error: `Segment non résolu : ${segment}`, code: 'UNRESOLVED_SEGMENT' })
    }

    // ⚠️ Numéros de CLIENTS : aucune donnée ne permet de deviner leur pays. On passe le
    // BRUT au goulot. L'ancien `.map(p => p.startsWith('+') ? p : '+' + p.replace(/^0/,''))`
    // collait un `+` ICI, donc en AMONT du garde — qui aurait alors reçu un `+622123456`
    // déjà « international » et l'aurait accepté comme numéro indonésien valide.
    // Une pré-transformation amont ne contourne pas seulement le goulot : elle le trompe.
    const phones = customers.map(c => c.phone!).filter(Boolean)

    // ⚠️ Le quota compte des MESSAGES, pas des requêtes : une campagne de N destinataires
    // réserve N unités AVANT la boucle. Si ça ne rentre pas, l'envoi entier est refusé
    // (message nommant le restant et le requis) plutôt que tronqué à mi-cible.
    const res = await sendWhatsApp({ tenantId, to: phones, body: message, owner: { kind: 'customer' }, flow: 'marketing' })
    if (res.denied) {
      await releaseSlot() // refus quota/statut : aucun message parti → créneau rendu
      return reply.code(res.code === 'QUOTA_EXCEEDED' ? 429 : 403).send({
        error: res.message, code: res.code, recipientCount: phones.length,
      })
    }
    const sent = res.sent
    const failed = res.failed ?? 0
    // Twilio absent, segment vide, tous non résolvables → rien n'est parti : créneau rendu.
    if (sent === 0) await releaseSlot()

    // Enregistre la campagne (idempotent — une seule ligne par envoi)
    await prisma.campaign.create({
      data: { tenantId, sentBy: userId, message, segment, recipientCount: phones.length, sentCount: sent, failedCount: failed },
    }).catch(() => {})

    return { sent, failed, recipientCount: phones.length }
  })
}
