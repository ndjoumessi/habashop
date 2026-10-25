import type { FastifyInstance } from 'fastify'
import { prisma, basePrisma } from '../db'
import { parseInvoiceToken } from '../lib/invoiceLink'
import { invoiceTotals } from '../lib/invoiceTotals'

// Routes publiques (sans authentification).
// IMPORTANT : ne JAMAIS exposer ici de champs sensibles (buyPrice, marges,
// emails clients, etc.) — SELECT explicite uniquement.
export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/public/catalog/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }

    const tenant = await prisma.tenant.findFirst({
      where: { slug, catalogVisible: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        logo: true,
        whatsappPhone: true,
        phone: true,
        currency: true,
        country: true,
        lang: true,
      },
    })

    if (!tenant) {
      return reply.code(404).send({ error: 'Catalogue introuvable' })
    }

    const products = await prisma.product.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        sellPrice: true,
        promotionPrice: true,
        hasPromotion: true,
        promotionEnd: true,
        emoji: true,
        image: true,
        stockQty: true,
        unit: true,
        category: true,
      },
      // En stock d'abord (par stockQty desc), puis alpha sur nom
      orderBy: [{ stockQty: 'desc' }, { name: 'asc' }],
    })

    // Pas de cache CDN : Railway répond <100ms et le commerçant peut changer ses prix /
    // devise / catalogVisible à tout moment. La page est légère, le coût d'un fetch live
    // par visite est négligeable vs l'incohérence qu'introduirait un cache 5min.
    reply.header('Cache-Control', 'public, s-maxage=0, must-revalidate')

    return {
      tenant: {
        ...tenant,
        // Fallback whatsappPhone → phone (numéro principal de la boutique)
        whatsappPhone: tenant.whatsappPhone || tenant.phone || null,
        // On ne renvoie pas le phone "interne" séparément côté public
        phone: undefined,
      },
      products,
    }
  })

  /**
   * `GET /api/public/invoice/:token` — la facture que le client du commerçant ouvre en
   * scannant le QR code imprimé au pied du PDF. Aucune session : ce client n'a pas de
   * compte (`Customer` est une fiche tenue par la boutique, il ne se connecte jamais).
   * Le jeton signé EST l'accès ; `lib/invoiceLink.ts` dit pourquoi il en est la SEULE
   * garde, et pourquoi le plafond par IP n'en est pas un repli.
   */
  app.get('/api/public/invoice/:token', async (req, reply) => {
    const { token } = req.params as { token: string }
    const saleId = parseInvoiceToken(token)
    // Jeton illisible, tronqué ou mal signé → 404, exactement comme une facture
    // inexistante. ⚠️ Jamais 401 : cette page n'a aucune session à expirer, et un 401 sur
    // un chemin public se lirait « jeton périmé » côté client (cf. § Sécurité, « UN 401
    // N'A PAS UN SEUL SENS »). Jamais 403 non plus — un code par cause dirait à un
    // attaquant quelle moitié du jeton il a déjà juste.
    if (!saleId) return reply.code(404).send({ error: 'Facture introuvable' })

    // ⚠️ `basePrisma` (client NON étendu) : la lecture est cross-tenant par NATURE — on
    // découvre la boutique DEPUIS la vente, il n'y a aucun contexte tenant à injecter.
    // S'appuyer sur « le client étendu n'injecte rien hors contexte ALS » serait une
    // justesse empruntée à un invariant distant ; ici le choix est explicite.
    //
    // ⚠️ **AUCUNE condition sur `invoiceNumber`, et c'est un renversement ASSUMÉ du
    // 2026-10-25.** La première version exigeait une facture ÉMISE. Mais le QR vit désormais
    // sur le TICKET DE CAISSE, imprimé à la seconde de la vente — or le numéro n'est attribué
    // qu'à la première génération du PDF, qui pour une vente de passage n'arrive jamais. Le
    // lien aurait donc mené à un 404 dans le cas le plus courant.
    // L'alternative était d'attribuer un numéro à CHAQUE vente : ç'aurait changé le sens de la
    // séquence comptable pour une raison d'affichage. Ici, une vente sans numéro est rendue
    // comme un **REÇU** — le front dérive le mot du champ — et la numérotation garde son sens.
    //
    // ⚠️ `tenant.deletedAt: null` : une boutique fermée cesse de publier. Le client garde
    // le PAPIER, qui est la pièce comptable ; la consultation en ligne est un service de
    // la boutique et s'arrête avec elle.
    const sale = await basePrisma.sale.findFirst({
      where: { id: saleId, tenant: { deletedAt: null } },
      select: {
        invoiceNumber: true, total: true, discountAmount: true, paymentMode: true,
        createdAt: true, status: true, customerId: true,
        cashAmount: true, mobileMoneyAmount: true, cardAmount: true,
        items: { select: { qty: true, unitPrice: true, total: true, product: { select: { name: true } } } },
        // Contact de la boutique : déjà imprimé sur la facture ET déjà public dans le
        // catalogue. Rien d'interne ici — ni `buyPrice`, ni marge, ni caissier, ni
        // référence de prestataire de paiement.
        tenant: {
          select: {
            name: true, address: true, phone: true, email: true,
            currency: true, vatRate: true, lang: true,
            ninea: true, rccm: true, vatNumber: true,
          },
        },
      },
    })
    if (!sale) return reply.code(404).send({ error: 'Facture introuvable' })

    // ⚠️ Le NOM seul — jamais le téléphone, jamais l'e-mail. Le papier porte le nom (c'est
    // ce qui fait reconnaître « sa » facture) ; un lien qui fuiterait ne doit pas, en plus,
    // livrer un numéro joignable. Même règle que la PII bannie des logs Railway.
    const customer = sale.customerId
      ? await basePrisma.customer.findUnique({ where: { id: sale.customerId }, select: { name: true } })
      : null

    // Une facture est personnelle : aucun cache, ni navigateur ni CDN.
    reply.header('Cache-Control', 'no-store')

    // ⚠️ HT et TVA sont CALCULÉS ICI, par la même fonction que le PDF : la page ne refait
    // aucun calcul d'argent. Deux décompositions d'un même TTC divergent au premier cas
    // limite, et c'est l'écran du client qui porterait l'écart.
    const totaux = invoiceTotals(sale.total, Number(sale.tenant.vatRate) || 0)

    return {
      invoiceNumber: sale.invoiceNumber,
      date: sale.createdAt,
      status: sale.status,
      paymentMode: sale.paymentMode,
      total: totaux.totalTTC,
      subtotalHT: totaux.subtotalHT,
      vatAmount: totaux.vatAmount,
      discountAmount: sale.discountAmount,
      cashAmount: sale.cashAmount,
      mobileMoneyAmount: sale.mobileMoneyAmount,
      cardAmount: sale.cardAmount,
      items: sale.items.map((it) => ({
        name: it.product?.name ?? null, qty: it.qty, unitPrice: it.unitPrice, total: it.total,
      })),
      customerName: customer?.name ?? null,
      shop: sale.tenant,
    }
  })
}
