import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'

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
}
