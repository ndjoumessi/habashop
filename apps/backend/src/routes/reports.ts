import PDFDocument from 'pdfkit'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { getCached } from '../lib/cache'
import { xofToCurrency } from '../lib/currency'

// Rôles autorisés à lire le rapport comptable (lecture seule).
const ALLOWED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT'])

export interface AccountingReport {
  month: string                       // 'YYYY-MM'
  currency: string
  revenue: { total: number; count: number }
  expenses: { total: number; byCategory: { category: string; amountTtc: number }[] }
  payroll: { total: number; projected: boolean } // masse salariale PROJETÉE (effectif actuel)
  resultBeforePayroll: number         // = revenue.total − expenses.total (dépenses RÉELLES)
  resultAfterPayrollEstimate: number  // = resultBeforePayroll − payroll.total (ESTIMATION)
  margin: number | null               // marge avant masse salariale (%) ; null si revenu = 0
  generatedAt: string
}

export interface MonthMeta {
  year: number
  month0: number      // 0-based
  monthStr: string    // 'YYYY-MM'
  start: Date         // inclusif
  end: Date           // exclusif (1er du mois suivant)
  isCurrentMonth: boolean
}

/**
 * Résout le mois cible. `raw` au format 'YYYY-MM' ; défaut = mois courant.
 * Bornes en heure serveur (identique au dashboard `new Date(y, m, 1)` → réconciliation).
 */
export function resolveMonth(raw: string | undefined, now: Date): MonthMeta {
  let year = now.getFullYear()
  let month0 = now.getMonth()
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number)
    if (m >= 1 && m <= 12) { year = y; month0 = m - 1 } // sinon → mois courant (défaut)
  }
  const start = new Date(year, month0, 1)
  const end = new Date(year, month0 + 1, 1)
  const monthStr = `${year}-${String(month0 + 1).padStart(2, '0')}`
  const isCurrentMonth = year === now.getFullYear() && month0 === now.getMonth()
  return { year, month0, monthStr, start, end, isCurrentMonth }
}

/**
 * Met en forme le rapport à partir des agrégats bruts (fonction pure → testable).
 * net = revenu − dépenses RÉELLES. La paie est projetée (Employee.salary) et exposée
 * à part, JAMAIS incluse dans le net (pas de catégorie dépense "Salaires" ni table Payroll).
 *
 * Montants d'entrée en base XOF → convertis en sortie vers `input.currency`
 * (même pattern que le récap paie). XOF/XAF = identité. Les totaux/résultats sont
 * dérivés des composants DÉJÀ convertis → cohérence interne (parties = total,
 * résultat = revenu − dépenses) dans la devise affichée. La marge est un ratio,
 * calculée sur les valeurs XOF (indépendante de la devise, sans dérive d'arrondi).
 */
export function computeReport(input: {
  monthStr: string
  currency: string
  revenueTotal: number
  revenueCount: number
  expenses: { category: string; amountTTC: number | null }[]
  payrollTotal: number
  generatedAt: string
}): AccountingReport {
  const conv = (xof: number) => xofToCurrency(xof, input.currency)

  const catMap = new Map<string, number>()
  for (const e of input.expenses) {
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + (e.amountTTC ?? 0))
  }
  // Tri sur les montants XOF (ordre identique avant/après conversion), puis conversion.
  const byCategory = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amountTtcXOF]) => ({ category, amountTtc: conv(amountTtcXOF) }))
  // Total = somme des catégories CONVERTIES → cohérent avec l'affichage des parts.
  const expensesTotal = byCategory.reduce((s, c) => s + c.amountTtc, 0)
  const revenueTotalConv = conv(input.revenueTotal)
  const payrollTotalConv = conv(input.payrollTotal)
  // Résultat AVANT masse salariale (dépenses réellement enregistrées), en devise affichée.
  const resultBeforePayroll = revenueTotalConv - expensesTotal
  // Résultat APRÈS paie = estimation (masse salariale projetée sur l'effectif actuel).
  const resultAfterPayrollEstimate = resultBeforePayroll - payrollTotalConv
  // Marge AVANT masse salariale : ratio sur valeurs XOF (devise-indépendant).
  const resultBeforePayrollXOF = input.revenueTotal - [...catMap.values()].reduce((s, v) => s + v, 0)
  return {
    month: input.monthStr,
    currency: input.currency,
    revenue: { total: revenueTotalConv, count: input.revenueCount },
    expenses: { total: expensesTotal, byCategory },
    payroll: { total: payrollTotalConv, projected: true },
    resultBeforePayroll,
    resultAfterPayrollEstimate,
    margin: input.revenueTotal > 0 ? (resultBeforePayrollXOF / input.revenueTotal) * 100 : null,
    generatedAt: input.generatedAt,
  }
}

/** Récupère + agrège les données du mois pour un tenant (tenantId vient TOUJOURS du JWT). */
export async function buildAccountingReport(
  db: typeof prisma,
  tenantId: string,
  meta: MonthMeta,
  now: Date,
): Promise<AccountingReport> {
  const [salesAgg, expenses, payrollAgg, tenant] = await Promise.all([
    db.sale.aggregate({
      where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: meta.start, lt: meta.end } },
      _sum: { total: true },
      _count: { id: true },
    }),
    db.expense.findMany({
      where: { tenantId, date: { gte: meta.start, lt: meta.end } },
      select: { category: true, amountTTC: true },
    }),
    db.employee.aggregate({
      where: { tenantId, isActive: true, deletedAt: null },
      _sum: { salary: true },
    }),
    db.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } }),
  ])

  return computeReport({
    monthStr: meta.monthStr,
    currency: tenant?.currency ?? 'XOF',
    revenueTotal: salesAgg._sum.total ?? 0,
    revenueCount: salesAgg._count.id ?? 0,
    expenses,
    payrollTotal: payrollAgg._sum.salary ?? 0,
    generatedAt: now.toISOString(),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapports actionnables v1 — Réappro & Dormants (helpers PURS, testables sans DB)
// ─────────────────────────────────────────────────────────────────────────────
export const DORMANT_DAYS = 60   // fenêtre « aucune vente » (constante ajustable)
export const REORDER_VELOCITY_DAYS = 30

export interface ProductLite {
  id: string; name: string; category: string
  stockQty: number; stockMin: number; buyPrice: number
}
export interface ReorderItem {
  id: string; name: string; category: string
  stock: number; threshold: number; velocity30d: number; suggestedQty: number
}
export interface DormantItem {
  id: string; name: string; category: string
  stock: number; buyPrice: number; immobilizedValue: number
  lastSale: string | null; daysSinceSale: number | null
}

/**
 * À réapprovisionner : MÊME critère que le bandeau Stock (stockQty ≤ stockMin),
 * étendu serveur — classé par vélocité 30j décroissante (top vendeurs en rupture
 * d'abord). suggestedQty = couvrir 30j à la vélocité actuelle − stock (SUGGESTION).
 */
export function computeReorder(products: ProductLite[], velocity30d: Map<string, number>): ReorderItem[] {
  return products
    .filter(p => p.stockQty <= p.stockMin)
    .map(p => {
      const velocity = velocity30d.get(p.id) ?? 0
      return {
        id: p.id, name: p.name, category: p.category,
        stock: p.stockQty, threshold: p.stockMin, velocity30d: velocity,
        suggestedQty: Math.max(0, velocity - p.stockQty),
      }
    })
    .sort((a, b) => b.velocity30d - a.velocity30d || a.stock - b.stock)
}

/**
 * Dormants : AUCUNE vente sur DORMANT_DAYS jours ET stock > 0. Triés par valeur
 * immobilisée (stock × coût d'achat) décroissante.
 */
export function computeDormant(
  products: ProductLite[],
  soldRecent: Set<string>,
  lastSale: Map<string, string | null>,
  now: Date,
): DormantItem[] {
  return products
    .filter(p => p.stockQty > 0 && !soldRecent.has(p.id))
    .map(p => {
      const last = lastSale.get(p.id) ?? null
      const daysSinceSale = last ? Math.floor((now.getTime() - new Date(last).getTime()) / 86_400_000) : null
      return {
        id: p.id, name: p.name, category: p.category,
        stock: p.stockQty, buyPrice: p.buyPrice ?? 0,
        immobilizedValue: p.stockQty * (p.buyPrice ?? 0),
        lastSale: last, daysSinceSale,
      }
    })
    .sort((a, b) => b.immobilizedValue - a.immobilizedValue)
}

/** Construit le rapport inventaire (réappro + dormants) pour un tenant — lecture seule. */
export async function buildInventoryInsights(db: any, tenantId: string, now: Date) {
  const d30 = new Date(now.getTime() - REORDER_VELOCITY_DAYS * 86_400_000)
  const d60 = new Date(now.getTime() - DORMANT_DAYS * 86_400_000)

  const products: ProductLite[] = await db.product.findMany({
    where: { tenantId, isActive: true, deletedAt: null },
    select: { id: true, name: true, category: true, stockQty: true, stockMin: true, buyPrice: true },
  })

  // Vélocité 30j (unités vendues), ventes remboursées exclues.
  const vel = await db.saleItem.groupBy({
    by: ['productId'],
    where: { sale: { tenantId, status: { not: 'refunded' }, createdAt: { gte: d30 } } },
    _sum: { qty: true },
  }).catch(() => [] as { productId: string; _sum: { qty: number | null } }[])
  const velocity30d = new Map<string, number>(vel.map((v: any) => [v.productId, v._sum.qty ?? 0]))

  // Produits ayant une vente dans les 60 derniers jours (→ NON dormants).
  const recent = await db.saleItem.findMany({
    where: { sale: { tenantId, status: { not: 'refunded' }, createdAt: { gte: d60 } } },
    select: { productId: true }, distinct: ['productId'],
  }).catch(() => [] as { productId: string }[])
  const soldRecent = new Set<string>(recent.map((r: any) => r.productId))

  // Dernière vente des candidats dormants (parmi toutes leurs ventes).
  const dormantIds = products.filter(p => p.stockQty > 0 && !soldRecent.has(p.id)).map(p => p.id)
  const lastSale = new Map<string, string | null>()
  if (dormantIds.length) {
    const items = await db.saleItem.findMany({
      where: { productId: { in: dormantIds }, sale: { tenantId, status: { not: 'refunded' } } },
      select: { productId: true, sale: { select: { createdAt: true } } },
      orderBy: { sale: { createdAt: 'desc' } },
    }).catch(() => [] as { productId: string; sale: { createdAt: Date } }[])
    for (const it of items) {
      if (!lastSale.has(it.productId)) lastSale.set(it.productId, new Date(it.sale.createdAt).toISOString())
    }
  }

  return {
    reorder: computeReorder(products, velocity30d),
    dormant: computeDormant(products, soldRecent, lastSale, now),
    dormantDays: DORMANT_DAYS,
    generatedAt: now.toISOString(),
  }
}

export async function reportsRoutes(app: any) {
  // GET /api/reports/accounting?month=YYYY-MM — rapport comptable mensuel du tenant courant.
  app.get('/api/reports/accounting', { preHandler: authenticate }, async (request: any, reply: any) => {
    const role = request.user?.role as string | undefined
    if (!role || !ALLOWED_ROLES.has(role)) {
      return reply.code(403).send({ error: 'Accès refusé' })
    }
    const tenantId = request.tenantId as string
    const now = new Date()
    const meta = resolveMonth(request.query?.month as string | undefined, now)

    // TTL : mois courant court (5 min), mois passés plus long (30 min).
    const ttl = meta.isCurrentMonth ? 300 : 1800
    return getCached(
      // v2 : conversion devise ajoutée → invalide les entrées pré-conversion en cache.
      `reports:accounting:v2:${tenantId}:${meta.monthStr}`,
      ttl,
      () => buildAccountingReport(prisma, tenantId, meta, now),
    )
  })

  // GET /api/reports/inventory — réappro + dormants du tenant courant (à la demande, lecture seule).
  app.get('/api/reports/inventory', { preHandler: authenticate }, async (request: any) => {
    const tenantId = request.tenantId as string  // scope STRICT depuis le JWT
    const now = new Date()
    // Cache court (5 min) : stock/ventes bougent, mais évite le recalcul à chaque ouverture d'onglet.
    return getCached(`reports:inventory:${tenantId}`, 300, () => buildInventoryInsights(prisma, tenantId, now))
  })

  // GET /api/reports/accounting/csv?month=YYYY-MM — CSV détaillé par vente (UTF-8 BOM, séparateur ;).
  app.get('/api/reports/accounting/csv', { preHandler: authenticate }, async (request: any, reply: any) => {
    const role = request.user?.role as string | undefined
    if (!role || !ALLOWED_ROLES.has(role)) return reply.code(403).send({ error: 'Accès refusé' })

    const tenantId = request.tenantId as string
    const now = new Date()
    const meta = resolveMonth(request.query?.month as string | undefined, now)

    const [sales, tenant] = await Promise.all([
      prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: meta.start, lt: meta.end } },
        select: { id: true, createdAt: true, total: true, paymentMode: true, status: true, customerId: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { vatRate: true, posVatIncluded: true } }),
    ])

    // Chargement des noms clients en une requête (évite N+1)
    const custIds = [...new Set(sales.map(s => s.customerId).filter(Boolean))] as string[]
    const custMap = new Map<string, string>()
    if (custIds.length) {
      const custs = await prisma.customer.findMany({
        where: { id: { in: custIds } },
        select: { id: true, name: true },
      })
      custs.forEach(c => custMap.set(c.id, c.name))
    }

    const vatRate = tenant?.vatRate ?? 18
    const posVatIncluded = tenant?.posVatIncluded ?? true
    const calcVat = (total: number) => {
      if (posVatIncluded) {
        const ht = total / (1 + vatRate / 100)
        return { ht, tva: total - ht, ttc: total }
      }
      const tva = total * vatRate / 100
      return { ht: total, tva, ttc: total + tva }
    }

    const SEP = ';'
    const BOM = '﻿'
    const lines: string[] = [
      ['Date', 'Référence', 'Client', 'Mode paiement', 'Montant HT', 'TVA', 'Montant TTC', 'Statut'].join(SEP),
    ]
    for (const s of sales) {
      const { ht, tva, ttc } = calcVat(s.total)
      const date = new Date(s.createdAt).toLocaleDateString('fr-FR')
      const ref  = s.id.slice(-8).toUpperCase()
      const cli  = (s.customerId ? (custMap.get(s.customerId) ?? '') : '').replace(/"/g, '""')
      const mode = s.paymentMode
      const stat = s.status === 'refunded' ? 'Remboursé' : 'Complété'
      lines.push([date, ref, `"${cli}"`, mode, ht.toFixed(2), tva.toFixed(2), ttc.toFixed(2), stat].join(SEP))
    }

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="comptabilite-${meta.monthStr}.csv"`)
    return reply.send(BOM + lines.join('\n'))
  })

  // ── Rapport TVA ──────────────────────────────────────────────────────────────
  // Helpers partagés par les 3 endpoints (JSON / CSV / PDF).
  async function buildVatData(tenantId: string, meta: ReturnType<typeof resolveMonth>) {
    const [sales, tenant] = await Promise.all([
      prisma.sale.findMany({
        where: { tenantId, status: { not: 'refunded' }, createdAt: { gte: meta.start, lt: meta.end } },
        select: { id: true, createdAt: true, total: true, paymentMode: true, customerId: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { vatRate: true, posVatIncluded: true, currency: true } }),
    ])
    const vatRate = tenant?.vatRate ?? 18
    const posVatIncluded = tenant?.posVatIncluded ?? true
    const currency = tenant?.currency ?? 'XOF'

    // Noms clients (batch)
    const custIds = [...new Set(sales.map(s => s.customerId).filter(Boolean))] as string[]
    const custMap = new Map<string, string>()
    if (custIds.length) {
      const custs = await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } })
      custs.forEach(c => custMap.set(c.id, c.name))
    }

    const rows = sales.map(s => {
      const ttc = posVatIncluded ? s.total : s.total + s.total * vatRate / 100
      const ht  = posVatIncluded ? s.total / (1 + vatRate / 100) : s.total
      const tva = ttc - ht
      return {
        id: s.id, date: s.createdAt.toISOString(),
        customerName: s.customerId ? (custMap.get(s.customerId) ?? null) : null,
        paymentMode: s.paymentMode,
        totalHT: ht, tva, totalTTC: ttc,
      }
    })
    const totals = rows.reduce((acc, r) => ({
      totalHT:  acc.totalHT  + r.totalHT,
      tva:      acc.tva      + r.tva,
      totalTTC: acc.totalTTC + r.totalTTC,
      count:    acc.count    + 1,
    }), { totalHT: 0, tva: 0, totalTTC: 0, count: 0 })

    return { month: meta.monthStr, vatRate, posVatIncluded, currency, rows, totals }
  }

  // GET /api/reports/vat?month=YYYY-MM — JSON
  app.get('/api/reports/vat', { preHandler: authenticate }, async (request: any, reply: any) => {
    const role = request.user?.role as string | undefined
    if (!role || !ALLOWED_ROLES.has(role)) return reply.code(403).send({ error: 'Accès refusé' })
    const tenantId = request.tenantId as string
    const meta = resolveMonth(request.query?.month as string | undefined, new Date())
    return buildVatData(tenantId, meta)
  })

  // GET /api/reports/vat/csv?month=YYYY-MM — CSV téléchargeable
  app.get('/api/reports/vat/csv', { preHandler: authenticate }, async (request: any, reply: any) => {
    const role = request.user?.role as string | undefined
    if (!role || !ALLOWED_ROLES.has(role)) return reply.code(403).send({ error: 'Accès refusé' })
    const tenantId = request.tenantId as string
    const meta = resolveMonth(request.query?.month as string | undefined, new Date())
    const { vatRate, rows, totals, month } = await buildVatData(tenantId, meta)

    const SEP = ';'
    const BOM = '﻿'
    const lines = [
      [`Rapport TVA — ${month} (taux ${vatRate} %)`],
      [],
      ['Date', 'Référence', 'Client', 'Mode paiement', 'Montant HT', 'TVA', 'Montant TTC'].join(SEP),
      ...rows.map(r => {
        const date = new Date(r.date).toLocaleDateString('fr-FR')
        const ref  = r.id.slice(-8).toUpperCase()
        const cli  = (r.customerName ?? '').replace(/"/g, '""')
        return [date, ref, `"${cli}"`, r.paymentMode, r.totalHT.toFixed(2), r.tva.toFixed(2), r.totalTTC.toFixed(2)].join(SEP)
      }),
      [],
      ['TOTAL', '', '', '', totals.totalHT.toFixed(2), totals.tva.toFixed(2), totals.totalTTC.toFixed(2)].join(SEP),
    ]

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="tva-${month}.csv"`)
    return reply.send(BOM + lines.map(l => Array.isArray(l) ? l.join(SEP) : l).join('\n'))
  })

  // GET /api/reports/vat/pdf?month=YYYY-MM — PDF pdfkit
  app.get('/api/reports/vat/pdf', { preHandler: authenticate }, async (request: any, reply: any) => {
    const role = request.user?.role as string | undefined
    if (!role || !ALLOWED_ROLES.has(role)) return reply.code(403).send({ error: 'Accès refusé' })
    const tenantId = request.tenantId as string
    const meta = resolveMonth(request.query?.month as string | undefined, new Date())
    const { vatRate, rows, totals, month, currency } = await buildVatData(tenantId, meta)

    const fmt2 = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency

    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    await new Promise<void>((resolve, reject) => {
      doc.on('end', resolve)
      doc.on('error', reject)

      // Header
      doc.fontSize(16).font('Helvetica-Bold').text(`Rapport TVA — ${month}`, { align: 'center' })
      doc.fontSize(10).font('Helvetica').text(`Taux TVA : ${vatRate} %`, { align: 'center' })
      doc.moveDown(1)

      // Totals summary
      doc.fontSize(11).font('Helvetica-Bold').text('Récapitulatif')
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica')
        .text(`Total HT :   ${fmt2(totals.totalHT)}`)
        .text(`TVA collectée : ${fmt2(totals.tva)}`)
        .text(`Total TTC :  ${fmt2(totals.totalTTC)}`)
        .text(`Nombre de ventes : ${totals.count}`)
      doc.moveDown(1)

      if (rows.length > 0) {
        // Column widths
        const W = { date: 70, ref: 70, client: 120, mode: 70, ht: 70, tva: 65, ttc: 75 }
        const startX = 40

        // Table header
        doc.fontSize(9).font('Helvetica-Bold')
        let x = startX
        const y0 = doc.y
        doc.text('Date',        x, y0, { width: W.date }); x += W.date
        doc.text('Référence',   x, y0, { width: W.ref });  x += W.ref
        doc.text('Client',      x, y0, { width: W.client });x += W.client
        doc.text('Mode',        x, y0, { width: W.mode }); x += W.mode
        doc.text('HT',          x, y0, { width: W.ht, align: 'right' });   x += W.ht
        doc.text('TVA',         x, y0, { width: W.tva, align: 'right' });  x += W.tva
        doc.text('TTC',         x, y0, { width: W.ttc, align: 'right' })
        doc.moveDown(0.5)
        doc.moveTo(startX, doc.y).lineTo(startX + 540, doc.y).strokeColor('#ccc').stroke()
        doc.moveDown(0.3)

        // Table rows
        doc.fontSize(8).font('Helvetica')
        for (const r of rows) {
          if (doc.y > 750) { doc.addPage(); doc.y = 40 }
          let rx = startX
          const ry = doc.y
          const date = new Date(r.date).toLocaleDateString('fr-FR')
          const ref  = r.id.slice(-8).toUpperCase()
          const cli  = (r.customerName ?? '—').slice(0, 18)
          doc.text(date,               rx, ry, { width: W.date }); rx += W.date
          doc.text(ref,                rx, ry, { width: W.ref });  rx += W.ref
          doc.text(cli,                rx, ry, { width: W.client });rx += W.client
          doc.text(r.paymentMode,      rx, ry, { width: W.mode }); rx += W.mode
          doc.text(r.totalHT.toFixed(2),  rx, ry, { width: W.ht, align: 'right' });  rx += W.ht
          doc.text(r.tva.toFixed(2),      rx, ry, { width: W.tva, align: 'right' }); rx += W.tva
          doc.text(r.totalTTC.toFixed(2), rx, ry, { width: W.ttc, align: 'right' })
          doc.moveDown(0.6)
        }

        // Totals row
        doc.moveTo(startX, doc.y).lineTo(startX + 540, doc.y).strokeColor('#999').stroke()
        doc.moveDown(0.3)
        let tx = startX
        const ty = doc.y
        doc.fontSize(9).font('Helvetica-Bold')
        doc.text('TOTAL', tx, ty, { width: W.date + W.ref + W.client + W.mode }); tx += W.date + W.ref + W.client + W.mode
        doc.text(totals.totalHT.toFixed(2),  tx, ty, { width: W.ht, align: 'right' });  tx += W.ht
        doc.text(totals.tva.toFixed(2),      tx, ty, { width: W.tva, align: 'right' }); tx += W.tva
        doc.text(totals.totalTTC.toFixed(2), tx, ty, { width: W.ttc, align: 'right' })
      }

      doc.end()
    })

    const pdf = Buffer.concat(chunks)
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="tva-${month}.pdf"`)
    return reply.send(pdf)
  })
}
