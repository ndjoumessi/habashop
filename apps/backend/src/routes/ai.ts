import type { FastifyInstance } from 'fastify'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/ai/analyze', { preHandler: authenticate }, async (request, reply) => {
    const { type, lang } = request.body as any
    const { tenantId } = request.user

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return reply.code(503).send({ error: 'Clé API Anthropic non configurée' })

    try {
      const [products, sales, expenses, employees] = await Promise.all([
        prisma.product.findMany({ where: { tenantId, isActive: true, deletedAt: null }, take: 50 }),
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
    const { tenantId } = request.user

    if (!singleMsg?.trim() && (!msgHistory || msgHistory.length === 0)) {
      return reply.code(400).send({ error: 'message ou messages requis' })
    }

    try {
      const [products, sales, employees, expenses] = await Promise.all([
        prisma.product.findMany({ where: { tenantId, isActive: true, deletedAt: null }, take: 30 }),
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
}
