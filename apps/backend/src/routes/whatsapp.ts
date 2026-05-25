import type { FastifyInstance } from 'fastify'
import twilio from 'twilio'
import { CronJob } from 'cron'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

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

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  // Résumé soir tous les jours à 20h00, alerte matin à 8h00
  new CronJob('0 20 * * *', sendEveningReport, null, true, 'Africa/Dakar')
  new CronJob('0 8 * * *', sendMorningStockAlert, null, true, 'Africa/Dakar')
  console.log('⏰ Cron jobs planifiés : résumé 20h + alertes 8h')

  app.post('/api/whatsapp/send-ticket', { preHandler: [authenticate] }, async (request, reply) => {
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
}
