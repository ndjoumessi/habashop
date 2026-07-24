import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { SaleBody } from '../types'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { notifyTenant } from './notifications'
import { invalidateTenantCache } from '../lib/cache'
import { getTenantId } from '../lib/tenantId'
import { resolveTierPrice, legitimatePrices, toPricingSet, type PriceTier } from '../utils/pricing'
import { pointsForAmount, tierForPoints, discountForTier, computeLoyaltyDiscount } from '../lib/loyalty'
import { buildInvoicePdf, nextInvoiceNumber } from '../lib/invoicePdf'
import { resolvePaymentSplit } from '../lib/paymentSplit'
import { sendSaleWhatsApp } from '../services/whatsappSend'
import * as pushService from '../services/pushService'

// ── Schémas de validation (item 6) ──────────────────────────────────────────
// Volontairement PERMISSIF pour matcher la tolérance du handler (Number(price)||0,
// items démo hors-catalogue) : on valide types + présence, on coerce les nombres,
// on laisse passer les champs d'item supplémentaires (passthrough) et la validation
// métier (anti-survente, split, total<0) reste dans le handler.
const SALE_ITEM = z.object({
  productId: z.string().min(1),
  qty:       z.coerce.number(),          // décrément stock ; le handler garde l'anti-survente
  price:     z.coerce.number().optional(),
  tierLabel: z.string().nullish(),
}).passthrough()

const SALE_BODY = z.object({
  items:       z.array(SALE_ITEM).min(1, { message: 'Une vente doit contenir au moins un article' }),
  paymentMode: z.string().optional(),
  total:       z.coerce.number(),        // présence requise ; le handler rejette total<0
  discount:    z.object({ amount: z.coerce.number().optional(), type: z.string().nullish() }).nullish(),
  customerId:  z.string().nullish(),
  idempotencyKey: z.string().nullish(),
  // Horodatage client (ISO) : NON vérifiable → sert seulement à honorer un prix offline
  // en cas de divergence (cf. handler + CLAUDE.md § Intégrité prix). Falsifiable = la trace protège.
  clientCreatedAt:   z.string().nullish(),
  cashAmount:        z.coerce.number().optional(),
  mobileMoneyAmount: z.coerce.number().optional(),
  cardAmount:        z.coerce.number().optional(),
  mtnMomoReference:  z.string().nullish(),
  campayReference:   z.string().nullish(),
  paydunyaReference: z.string().nullish(),
}).passthrough()

// Au-delà de ce délai de rejeu (now − clientCreatedAt), une vente est considérée « offline
// rejouée » → en cas de divergence prix on HONORE le montant encaissé (sinon prix serveur).
// ⚠️ clientCreatedAt est falsifiable : ce seuil n'est PAS une garantie de sécurité, la
// protection est la TRACE (priceDivergence) exploitée en audit. Cf. CLAUDE.md.
const REPLAY_THRESHOLD_MS = 90_000

// Fenêtre de PLAUSIBILITÉ d'un catalogue POS en cache — sert à QUALIFIER une divergence,
// jamais à excuser un prix. Le cache POS est le service worker (`api-cache`, NetworkFirst)
// dont les entrées expirent à 24 h ; au-delà, un « tarif précédent » ne peut plus provenir
// d'un catalogue en cache. 2× pour absorber la dérive d'horloge et un terminal resté sur
// une entrée en fin de vie. ⚠️ Borne INDISPENSABLE : sans elle, un prix vieux de 3 mois
// se ferait qualifier « tarif précédent » et l'écran d'audit exonérerait une vraie fraude.
export const STALE_CATALOG_WINDOW_MS = 48 * 60 * 60 * 1000

const REFUND_PARAMS = z.object({ id: z.string().min(1) })
const REFUND_BODY = z.object({
  reason:  z.string().optional(),        // « obligatoire » (non-vide) reste vérifié dans le handler
  restock: z.boolean().optional(),
}).passthrough()

// Remboursement réservé MANAGER + ADMIN (+ SUPER_ADMIN superset) — anti-fraude :
// le caissier ne peut PAS rembourser. Helper pur exporté pour les tests.
export const REFUND_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] as const
export const canRefund = (role?: string): boolean => REFUND_ROLES.includes(role as never)

// Erreur interne pour aborter la transaction quand la course d'idempotence est perdue.
class RefundConflict extends Error {}

export async function saleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/sales', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    const { limit = 50, offset = 0, priceDivergence } = request.query as { limit?: number; offset?: number; priceDivergence?: string }
    // Filtre d'AUDIT : `?priceDivergence=true` → ventes dont un prix soumis ≠ prix catalogue
    // (le détail submitted/catalog vit sur chaque SaleItem, renvoyé via include). Rend la trace
    // exploitable dès l'API (l'UI propriétaire suivra) — pas un journal write-only.
    const divergenceOnly = priceDivergence === 'true' || priceDivergence === '1'
    return prisma.sale.findMany({
      where: { tenantId, ...(divergenceOnly ? { priceDivergence: true } : {}) },
      // cashier.name : requis par l'audit des écarts de prix (« question au caissier »).
      include: { items: { include: { product: true } }, cashier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    })
  })

  app.post('/api/sales', { preHandler: authenticate, schema: { body: SALE_BODY } }, async (request, reply) => {
    const { userId } = request.user
    const { items, paymentMode, total, discount, customerId, mtnMomoReference, campayReference, paydunyaReference } = request.body as SaleBody

    if (!items?.length) {
      return reply.code(400).send({ error: 'Une vente doit contenir au moins un article' })
    }
    if (total == null || total < 0) {
      return reply.code(400).send({ error: 'Le total ne peut pas être négatif' })
    }
    // Après les validations : `getTenantId` peut lever, l'ordre des sorties reste identique à l'existant.
    const tenantId = getTenantId(request)

    const body = request.body as SaleBody
    const manualDiscount = Number(discount?.amount) || 0

    // Horodatage client (offline) : sert UNIQUEMENT à décider quel prix FACTURER en cas de
    // divergence (honorer le montant encaissé offline vs prix serveur en ligne). ⚠️ NON
    // VÉRIFIABLE — un client peut le falsifier. La protection anti-fraude n'est PAS cette
    // branche mais la TRACE (submittedPrice/catalogPrice/priceDivergence), écrite dans les
    // DEUX cas → audit a posteriori. Cf. CLAUDE.md § Intégrité prix.
    const clientCreatedAt = String((request.body as SaleBody)?.clientCreatedAt ?? '').trim()
    const replayMs = clientCreatedAt ? (Date.now() - Date.parse(clientCreatedAt)) : 0
    const honorClientPrice = Number.isFinite(replayMs) && replayMs > REPLAY_THRESHOLD_MS

    // ── Config tenant (fidélité + TVA POS + WhatsApp/devise pour l'après-vente) ──
    const tCfg = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        enableLoyalty: true, pointsPerAmount: true, bronzeThreshold: true, silverThreshold: true,
        bronzeDiscount: true, silverDiscount: true, goldDiscount: true,
        vatRate: true, posVatIncluded: true,
        name: true, currency: true, lang: true, enableAutoWhatsApp: true,
      },
    })
    const loyaltyOn = !!tCfg?.enableLoyalty

    // ── Idempotence : clé envoyée par le client (body ou header Idempotency-Key) ──
    // Pas de clé → comportement historique inchangé (rétro-compat).
    const idempotencyKey =
      String((request.body as SaleBody)?.idempotencyKey ?? request.headers['idempotency-key'] ?? '').trim() || null
    if (idempotencyKey) {
      // Renvoi en double (retry/resync) : la vente existe déjà → renvoyée SANS re-créer.
      const existing = await prisma.sale.findFirst({ where: { tenantId, idempotencyKey } })
      if (existing) return existing
    }

    // ── Pré-fetch produits : TOUS les tarifs serveur (détail/demi-gros/gros) + tier/promo
    //    + stock/nom. Le prix de base est désormais SERVEUR-autoritaire (cf. intégrité ci-dessous). ──
    const productIds = items.map((i: any) => i.productId)
    const productsList = await prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
      select: {
        id: true, name: true, stockQty: true,
        sellPrice: true, semiWholesalePrice: true, wholesalePrice: true,
        hasPromotion: true, promotionPrice: true, priceTiers: true,
        // Tarifs PRÉCÉDENTS : servent uniquement à qualifier une divergence (jamais à facturer).
        previousPricing: true, pricingChangedAt: true,
      },
    })
    const productMap = new Map(productsList.map(p => [p.id, p]))

    // ── Garde anti-survente (AVANT tx). Produit absent du map = démo/hors-catalogue → toléré. ──
    for (const item of items) {
      const p = productMap.get(item.productId)
      if (p && p.stockQty < item.qty) {
        return reply.code(400).send({
          error: `Stock insuffisant pour ${p.name} — disponible : ${p.stockQty}, demandé : ${item.qty}`,
          code: 'INSUFFICIENT_STOCK',
          productId: p.id,
          available: p.stockQty,
        })
      }
    }

    // ── INTÉGRITÉ PRIX (A/E) : le prix de base est SERVEUR-autoritaire. On accepte le prix
    //    soumis SEULEMENT s'il correspond à un point de tarif serveur légitime (détail / demi-gros
    //    / gros, chacun résolu via palier+promo à cette quantité) → pas besoin du clientType.
    //    Sinon = DIVERGENCE (prix arbitraire, ex. caissier forgeant la requête) : en ligne on
    //    FACTURE le prix serveur détail ; offline (honorClientPrice) on honore le montant encaissé.
    //    Dans TOUS les cas de divergence : TRACE (submitted/catalog) + flag pour l'audit. ──
    type ItemRow = { productId: string; qty: number; unitPrice: number; total: number; tierLabel: string | null; submittedPrice?: number; catalogPrice?: number; staleCatalogAt?: Date | null }
    let anyDivergence = false
    const itemsData: ItemRow[] = items.map((item: any): ItemRow => {
      const submitted = Number(item.price) || 0
      const p = productMap.get(item.productId)
      if (!p) {
        // Hors-catalogue (démo) : rien à comparer → prix soumis conservé, sans trace.
        return { productId: item.productId, qty: item.qty, unitPrice: submitted, total: submitted * item.qty, tierLabel: item.tierLabel ?? null }
      }
      const tiers = Array.isArray(p.priceTiers) ? (p.priceTiers as unknown as PriceTier[]) : null
      const promo = { active: !!p.hasPromotion, price: p.promotionPrice }
      const retail = resolveTierPrice(item.qty, p.sellPrice, tiers, promo) // référence catalogue (détail)
      // Ensemble des prix LÉGITIMES = chaque tarif défini, résolu via palier/promo à cette qté.
      const legit = legitimatePrices(item.qty, { ...p, priceTiers: tiers })
      if (legit.has(Math.round(submitted))) {
        // Prix soumis = un tarif serveur légitime → autorisé, facturé tel quel (pas de trace).
        return { productId: item.productId, qty: item.qty, unitPrice: submitted, total: submitted * item.qty, tierLabel: item.tierLabel ?? null }
      }
      // DIVERGENCE : prix soumis hors de tout tarif serveur.
      anyDivergence = true
      const charged = honorClientPrice ? submitted : retail.price
      const tierLabel = honorClientPrice ? (item.tierLabel ?? null) : (retail.tierLabel ?? null)
      // ── QUALIFICATION (n'influence RIEN de ce qui est facturé) : le prix soumis était-il un
      //    tarif catalogue LÉGITIME avant le dernier changement de prix, assez récemment pour
      //    qu'un catalogue POS en cache l'explique ? Entièrement serveur-autoritaire : instantané
      //    écrit par nos routes d'écriture + date serveur, aucune donnée fournie par le client
      //    (≠ clientCreatedAt, falsifiable). Les DEUX conditions sont requises — la fenêtre seule
      //    n'excuse rien, l'appartenance seule laisserait passer un prix arbitrairement ancien.
      //    Non concluant ⇒ null ⇒ comportement historique (« à regarder »), jamais une innocence.
      let staleCatalogAt: Date | null = null
      const changedAt = p.pricingChangedAt
      if (changedAt && Date.now() - changedAt.getTime() <= STALE_CATALOG_WINDOW_MS) {
        const prev = toPricingSet(p.previousPricing as Record<string, unknown> | null)
        if (prev && legitimatePrices(item.qty, prev).has(Math.round(submitted))) staleCatalogAt = changedAt
      }
      console.warn(`[sales][integrity] divergence prix ${p.id} par user ${userId}: soumis=${submitted} catalogue=${retail.price} → facturé=${charged}${honorClientPrice ? ' (offline honoré)' : ''}${staleCatalogAt ? ' [tarif précédent]' : ''}`)
      return {
        productId: item.productId, qty: item.qty,
        unitPrice: charged, total: charged * item.qty, tierLabel,
        submittedPrice: submitted, catalogPrice: retail.price, // TRACE (audit)
        staleCatalogAt,                                        // QUALIFICATION (audit)
      }
    })

    // ── Total SERVEUR-autoritaire (D) : Σ lignes facturées − remise, TVA selon mode (C), − fidélité. ──
    const chargedSubtotal = itemsData.reduce((s, it) => s + it.total, 0)
    const subAfterDiscount = Math.max(0, chargedSubtotal - manualDiscount)
    const vatIncluded = tCfg?.posVatIncluded ?? true // TTC (défaut) = TVA extraite (total inchangé) ; HT = ajoutée
    const vatRate = Math.max(0, Number(tCfg?.vatRate) || 0)
    const gross = vatIncluded ? subAfterDiscount : Math.round(subAfterDiscount * (1 + vatRate / 100))

    // ── Loyalty v2 : remise auto selon le palier du client lié (plafonnée 50%), sur le gross SERVEUR ──
    let loyaltyDiscount = 0
    if (customerId && loyaltyOn) {
      const cust = await prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { loyaltyPoints: true } })
      const tier = tierForPoints(cust?.loyaltyPoints ?? 0, tCfg?.bronzeThreshold ?? undefined, tCfg?.silverThreshold ?? undefined)
      const pct = discountForTier(tier, tCfg?.bronzeDiscount ?? undefined, tCfg?.silverDiscount ?? undefined, tCfg?.goldDiscount ?? undefined)
      loyaltyDiscount = computeLoyaltyDiscount(gross, pct, manualDiscount)
    }
    const finalTotal = Math.max(0, gross - loyaltyDiscount)

    // ── Ventilation paiement (sur le total NET serveur après remise fidélité) ──
    const split = resolvePaymentSplit(paymentMode ?? 'cash', finalTotal, body)
    if ('error' in split) {
      const msg = split.error === 'MIXED_NEEDS_TWO'
        ? 'Un paiement mixte requiert au moins 2 modes'
        : 'La somme des paiements doit égaler le total'
      return reply.code(400).send({ error: msg, code: split.error })
    }

    let newSale
    try {
      newSale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          tenantId,
          cashierId: userId,
          total: finalTotal,             // NET serveur = Σ lignes − remise − fidélité (Modèle A)
          paymentMode,
          discountAmount: discount?.amount ?? 0,
          discountType: discount?.type ?? null,
          customerId: customerId ?? null,
          idempotencyKey,
          loyaltyDiscount: loyaltyDiscount,
          priceDivergence: anyDivergence, // flag d'audit (détail sur SaleItem)
          cashAmount: split.cashAmount,
          mobileMoneyAmount: split.mobileMoneyAmount,
          cardAmount: split.cardAmount,
          mtnMomoReference: mtnMomoReference ?? null,
          campayReference: campayReference ?? null,
          paydunyaReference: paydunyaReference ?? null,
        },
      })

      for (const it of itemsData) {
        await tx.saleItem.create({ data: { saleId: newSale.id, ...it } })
        await tx.product.update({
          where: { id: it.productId },
          data: { stockQty: { decrement: it.qty } },
        })
      }

      if (customerId) {
        // Points fidélité = floor(NET payé TTC après remises / pointsPerAmount tenant).
        const pts = loyaltyOn ? pointsForAmount(finalTotal, tCfg?.pointsPerAmount ?? undefined) : 0
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalRevenue: { increment: finalTotal },
            ...(pts > 0 ? { loyaltyPoints: { increment: pts } } : {}),
          },
        })
        if (pts > 0) {
          await tx.loyaltyTransaction.create({
            data: { tenantId, customerId, saleId: newSale.id, points: pts, type: 'earn', reason: 'sale' },
          })
        }
      }

      return newSale
      })
    } catch (e: any) {
      // Course concurrente : même clé insérée en parallèle → violation d'unicité (P2002).
      // L'appel perdant récupère et renvoie la vente gagnante → 1 SEULE vente créée.
      if (idempotencyKey && e?.code === 'P2002') {
        const existing = await prisma.sale.findFirst({ where: { tenantId, idempotencyKey } })
        if (existing) return existing
      }
      throw e
    }

    // Les agrégats analytics dépendent des ventes → on purge le cache du tenant.
    invalidateTenantCache(tenantId).catch(() => {})

    notifyTenant(tenantId, { type: 'new_sale', data: { id: newSale.id, total: finalTotal, paymentMode, itemCount: Array.isArray(items) ? items.length : 0 } })
    // Push « paiement reçu » → ADMIN, pour les encaissements ÉLECTRONIQUES uniquement
    // (mobile money / carte). On exclut 'cash' pour ne pas spammer à chaque vente comptoir.
    // Les flux MTN/Campay/PayDunya aboutissent tous à un POST /api/sales (leurs webhooks ne
    // font que réconcilier) → ce point couvre les 3 fournisseurs sans toucher leur code.
    if (paymentMode && paymentMode !== 'cash') {
      void pushService.sendPaymentReceived(tenantId, finalTotal, paymentMode)
    }
    try {
      const ids = (items ?? []).map((i) => i.productId)
      const sold = await prisma.product.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, name: true, stockQty: true, stockMin: true },
      })
      const low = sold.filter((p) => p.stockQty <= p.stockMin)
      if (low.length) {
        notifyTenant(tenantId, { type: 'low_stock', data: { products: low.map((p) => ({ id: p.id, name: p.name, stockQty: p.stockQty })) } })
        // Push « rupture de stock » → MANAGER + ADMIN (fire-and-forget, un par produit bas).
        for (const p of low) void pushService.sendStockAlert(tenantId, p.name, p.stockQty)
      }
    } catch { /* non bloquant */ }

    // ── WhatsApp auto (reçu après vente) — async NON BLOQUANT : n'échoue jamais la vente ──
    if (tCfg?.enableAutoWhatsApp && customerId) {
      void (async () => {
        try {
          const [cust, saleItems] = await Promise.all([
            prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { name: true, phone: true } }),
            prisma.saleItem.findMany({ where: { saleId: newSale.id }, select: { qty: true, total: true, product: { select: { name: true } } } }),
          ])
          if (cust?.phone) {
            await sendSaleWhatsApp(
              { id: newSale.id, total: finalTotal, paymentMode: paymentMode ?? 'cash', createdAt: newSale.createdAt },
              saleItems, cust,
              { id: tenantId, name: tCfg.name, currency: tCfg.currency, lang: tCfg.lang, enableLoyalty: tCfg.enableLoyalty, pointsPerAmount: tCfg.pointsPerAmount, enableAutoWhatsApp: tCfg.enableAutoWhatsApp },
            )
          }
        } catch { /* fail silent — déjà géré dans le service */ }
      })()
    }

    return newSale
  })

  // ── Remboursement TOTAL d'une vente ──
  // RBAC manager/admin · motif requis · idempotent (409 si déjà remboursé) ·
  // restock optionnel (pré-coché côté UI) · entrée d'audit · vente CONSERVÉE
  // (status='refunded' → exclue du CA). Wave/Orange = suivi only (mouvement réel externe).
  app.post('/api/sales/:id/refund', { preHandler: authenticate, schema: { params: REFUND_PARAMS, body: REFUND_BODY } }, async (request, reply) => {
    const { userId, role } = request.user
    if (!canRefund(role)) {
      return reply.code(403).send({ error: 'Seuls un manager ou un administrateur peuvent rembourser une vente' })
    }
    // Après le RBAC : `getTenantId` peut lever, l'ordre des sorties reste identique à l'existant.
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const { reason, restock } = (request.body ?? {}) as { reason?: string; restock?: boolean }

    const cleanReason = (reason ?? '').trim()
    if (!cleanReason) {
      return reply.code(400).send({ error: 'Le motif du remboursement est obligatoire' })
    }
    const doRestock = restock !== false // défaut ON (case pré-cochée)

    const sale = await prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: true },
    })
    if (!sale) return reply.code(404).send({ error: 'Vente introuvable' })
    if (sale.status === 'refunded') {
      return reply.code(409).send({ error: 'Cette vente a déjà été remboursée' })
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Garde d'idempotence ATOMIQUE : seul l'appel qui passe status completed→refunded
        // gagne (count=1) ; un appel concurrent voit count=0 → 409.
        const upd = await tx.sale.updateMany({
          where: { id, tenantId, status: { not: 'refunded' } },
          data: {
            status: 'refunded',
            refundedAt: new Date(),
            refundedBy: userId,
            refundReason: cleanReason,
            restocked: doRestock,
          },
        })
        if (upd.count === 0) throw new RefundConflict()

        if (doRestock) {
          for (const it of sale.items) {
            // updateMany = pas d'exception si le produit a été supprimé entre-temps
            await tx.product.updateMany({
              where: { id: it.productId, tenantId },
              data: { stockQty: { increment: it.qty } },
            })
          }
        }

        // Symétrie avec la création de vente : retire le revenu + les points fidélité
        // gagnés sur cette vente (somme des 'earn' liés au saleId) dans la même transaction.
        if (sale.customerId) {
          const earned = await tx.loyaltyTransaction.aggregate({
            where: { saleId: sale.id, tenantId, type: 'earn' },
            _sum: { points: true },
          })
          const pts = earned._sum.points ?? 0
          await tx.customer.updateMany({
            where: { id: sale.customerId, tenantId },
            data: {
              totalRevenue: { decrement: sale.total },
              ...(pts > 0 ? { loyaltyPoints: { decrement: pts } } : {}),
            },
          })
          if (pts > 0) {
            await tx.loyaltyTransaction.create({
              data: { tenantId, customerId: sale.customerId, saleId: sale.id, points: -pts, type: 'reverse', reason: 'refund' },
            })
          }
        }

        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            module: 'sales',
            action: 'REFUND_SALE',
            severity: 'warning',
            description: JSON.stringify({
              saleId: sale.id,
              total: sale.total,
              paymentMode: sale.paymentMode,
              reason: cleanReason,
              restock: doRestock,
            }),
          },
        })
      })
    } catch (e) {
      if (e instanceof RefundConflict) {
        return reply.code(409).send({ error: 'Cette vente a déjà été remboursée' })
      }
      throw e
    }

    // CA / agrégats dépendent des ventes (status) → purge cache tenant.
    invalidateTenantCache(tenantId).catch(() => {})
    notifyTenant(tenantId, { type: 'sale_refunded', data: { id: sale.id, total: sale.total, restock: doRestock } })

    return { ok: true, id: sale.id, status: 'refunded', restocked: doRestock }
  })

  // ── Facture PDF d'une vente (à la demande, non stockée ; numéro figé en DB) ──
  // RBAC : tout rôle authentifié. Scope tenant strict.
  app.get('/api/sales/:id/invoice', { preHandler: authenticate }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }

    const sale = await prisma.sale.findFirst({
      where: { id, tenantId },
      include: { items: { include: { product: { select: { name: true } } } } },
    })
    if (!sale) return reply.code(404).send({ error: 'Vente introuvable' })

    const [tenant, customer] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, address: true, phone: true, email: true, currency: true, vatRate: true, lang: true, ninea: true, rccm: true, vatNumber: true } }),
      sale.customerId ? prisma.customer.findFirst({ where: { id: sale.customerId, tenantId }, select: { name: true, phone: true } }) : Promise.resolve(null),
    ])
    if (!tenant) return reply.code(404).send({ error: 'Boutique introuvable' })

    // Numéro : attribué à la 1ʳᵉ demande puis figé (idempotent). Séquence = COUNT non-null + 1.
    let invoiceNumber = sale.invoiceNumber
    if (!invoiceNumber) {
      const year = new Date(sale.createdAt).getFullYear()
      const assign = async (): Promise<string> => {
        const count = await prisma.sale.count({ where: { tenantId, invoiceNumber: { not: null } } })
        const num = nextInvoiceNumber(count, year)
        await prisma.sale.update({ where: { id: sale.id }, data: { invoiceNumber: num } })
        return num
      }
      try {
        invoiceNumber = await assign()
      } catch (e: any) {
        if (e?.code === 'P2002') {
          // Course concurrente : soit cette vente a déjà reçu un numéro, soit le numéro
          // calculé a été pris par une autre vente → on relit / réessaie une fois.
          const fresh = await prisma.sale.findFirst({ where: { id: sale.id, tenantId }, select: { invoiceNumber: true } })
          invoiceNumber = fresh?.invoiceNumber ?? (await assign())
        } else throw e
      }
    }

    const pdf = await buildInvoicePdf({ ...sale, invoiceNumber }, tenant, customer)
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="facture-${invoiceNumber}.pdf"`)
      .send(pdf)
  })
}
