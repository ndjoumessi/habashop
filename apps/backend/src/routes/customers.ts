import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { CustomerBody } from '../types'
import { prisma } from '../db'
import { writeAudit } from '../lib/writeAudit'
import { authenticate } from '../middleware/authenticate'
import { getTenantId } from '../lib/tenantId'
import { notifyTenant } from './notifications'
import { tierForPoints } from '../lib/loyalty'
import { normalizeClientType } from '../lib/clientType'

// ── Schémas (item 6) ─────────────────────────────────────────────────────────
const ID_PARAMS = z.object({ id: z.string().min(1) })
const CUSTOMER_FIELDS = {
  name:    z.string().optional(),
  type:    z.string().optional(),
  phone:   z.string().nullish(),
  email:   z.string().nullish(),
  address: z.string().nullish(),
  loyaltyPoints: z.coerce.number().optional(),
  totalRevenue:  z.coerce.number().optional(),
  notes:   z.string().nullish(),
}
const CUSTOMER_CREATE = z.object(CUSTOMER_FIELDS).passthrough() // « nom requis » reste géré par le handler
const CUSTOMER_UPDATE = z.object(CUSTOMER_FIELDS).passthrough()
// Ajustement fidélité manuel : points requis (nombre) ; le handler garde ses gardes (0, rôle).
const LOYALTY_BODY = z.object({ points: z.coerce.number(), reason: z.string().nullish() }).passthrough()

/**
 * Fréquence d'achat RÉELLE, dérivée des ventes rattachées (#215).
 *
 * Le front l'écrivait `purchasesPerMonth: 0` en dur — un zéro qui mentait : la fiche d'un
 * grossiste affichait « 0 commandes » au-dessus de ses 19 achats.
 *
 * ⚠️ FENÊTRE GLISSANTE de 90 jours, pas la moyenne de vie du client. C'est un choix, et il
 * est mesuré : sur le tenant démo, la même donnée donne 0 sur 30 jours (trop volatil — une
 * semaine de fermeture suffit à l'annuler), 0,7 sur 90 jours, et 6,3 en moyenne de vie.
 * La moyenne de vie ne DÉCROÎT jamais : un client parti il y a un an afficherait encore
 * « 6 achats/mois », ce qui viderait de son sens le KPI « Rétention » (part des clients
 * à ≥ 3/mois). Un taux doit pouvoir retomber à zéro quand le client cesse de venir — et
 * ce zéro-là, lui, sera CONSTATÉ.
 *
 * ⚠️ Les ventes REMBOURSÉES sont exclues : un achat annulé n'est pas une visite à compter
 * dans une fréquence d'achat. (L'historique, lui, les MONTRE — ce n'est pas la même
 * question : il raconte, celui-ci mesure.)
 *
 * Une décimale conservée : arrondir 0,7 à 1 gonflerait de 43 % la fréquence d'un
 * grossiste qui vient une fois par trimestre.
 */
const PURCHASE_RATE_WINDOW_DAYS = 90

type WithRate<T> = T & { purchasesPerMonth: number }

async function withPurchaseRate<T extends { id: string }>(tenantId: string, customers: T[]): Promise<WithRate<T>[]> {
  if (customers.length === 0) return []
  const since = new Date(Date.now() - PURCHASE_RATE_WINDOW_DAYS * 86_400_000)
  const grouped = await prisma.sale.groupBy({
    by: ['customerId'],
    where: {
      tenantId,
      customerId: { in: customers.map(c => c.id) },
      createdAt: { gte: since },
      status: { not: 'refunded' },
    },
    _count: { _all: true },
  })
  // ⚠️ PAS de `.catch(() => [])` ici, et c'est délibéré : un agrégat en échec rendrait
  // « 0 achat/mois » pour TOUS les clients — le zéro menteur qu'on vient de retirer,
  // reconstitué par la porte de derrière et cette fois indétectable. Mieux vaut que
  // l'erreur remonte (liste vide côté handler, 404/500 côté détail) : une absence se voit.
  const months = PURCHASE_RATE_WINDOW_DAYS / 30
  const byCustomer = new Map(grouped.map(g => [g.customerId, g._count._all]))
  return customers.map(c => ({
    ...c,
    purchasesPerMonth: Math.round(((byCustomer.get(c.id) ?? 0) / months) * 10) / 10,
  }))
}

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/customers', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    const { search } = request.query as { search?: string }
    try {
      // Mode recherche (sélecteur client POS) : filtre nom/téléphone, limité à 8, enrichi du palier.
      if (search && search.trim().length >= 2) {
        const q = search.trim()
        const matches = await prisma.customer.findMany({
          where: {
            tenantId, deletedAt: null,
            OR: [
              { name:  { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          },
          orderBy: { totalRevenue: 'desc' },
          take: 8,
        })
        const cfg = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { bronzeThreshold: true, silverThreshold: true },
        })
        // Même enrichissement que la liste : sans lui, un client résolu par la recherche
        // porterait un `purchasesPerMonth` absent, que le front replierait sur 0 — le zéro
        // menteur reviendrait par cette porte.
        return withPurchaseRate(tenantId, matches.map(c => ({
          ...c,
          tier: tierForPoints(c.loyaltyPoints ?? 0, cfg?.bronzeThreshold ?? 2000, cfg?.silverThreshold ?? 5000),
        })))
      }
      const customers = await prisma.customer.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      })
      return withPurchaseRate(tenantId, customers)
    } catch (err) {
      console.error('Get customers error:', err)
      return []
    }
  })

  // Détail d'un client (sélecteur POS : résolution après scan QR de la carte fidélité).
  app.get('/api/customers/:id', { preHandler: authenticate }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const customer = await prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    return (await withPurchaseRate(tenantId, [customer]))[0]
  })

  app.post('/api/customers', { preHandler: authenticate, schema: { body: CUSTOMER_CREATE } }, async (request, reply) => {
    const {
      name, type, phone, email, address,
      loyaltyPoints, totalRevenue,
    } = request.body as CustomerBody

    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Le nom est requis' })
    }
    // Palier NORMALISÉ (#215) : le front envoyait le libellé français du <select>, la
    // colonne défaut est 'retail' — deux formats, aucun juge au milieu. Absent = 'retail'
    // (défaut de colonne, rétro-compatible) ; présent mais irrésolvable = 400, jamais un
    // repli silencieux qui rangerait un grossiste au détail.
    const normalizedType = type === undefined || type === null ? 'retail' : normalizeClientType(type)
    if (!normalizedType) {
      return reply.code(400).send({ error: `Type client invalide : ${String(type)}`, code: 'INVALID_CLIENT_TYPE' })
    }
    const tenantId = getTenantId(request)

    try {
      const customer = await prisma.customer.create({
        data: {
          tenantId,
          name:          name?.trim() ?? '',
          type:          normalizedType,
          phone:         phone         ?? '',
          email:         email         ?? '',
          address:       address       ?? '',
          loyaltyPoints: loyaltyPoints ?? 0,
          totalRevenue:  totalRevenue  ?? 0,
        }
      })
      notifyTenant(tenantId, { type: 'new_customer', data: { id: customer.id, name: customer.name } })
      return customer
    } catch (err) {
      console.error('Create customer error:', err)
      return reply.code(500).send({
        error: 'Erreur création client',
        details: (err as Error).message,
      })
    }
  })

  app.put('/api/customers/:id', { preHandler: authenticate, schema: { params: ID_PARAMS, body: CUSTOMER_UPDATE } }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const data = request.body as CustomerBody
    // Même juge qu'à la création. ⚠️ `undefined` reste `undefined` (Prisma ne touche pas
    // au champ) : une modification de téléphone ne doit pas réécrire le palier.
    let normalizedType: string | undefined
    if (data.type !== undefined && data.type !== null) {
      const t = normalizeClientType(data.type)
      if (!t) return reply.code(400).send({ error: `Type client invalide : ${String(data.type)}`, code: 'INVALID_CLIENT_TYPE' })
      normalizedType = t
    }
    try {
      return await prisma.customer.update({
        where: { id, tenantId },
        data: {
          name: data.name,
          type: normalizedType,
          phone: data.phone,
          email: data.email,
          address: data.address,
          // ⚠️ Ce `data:` est une liste EN DUR : ajouter `notes` au zod ne suffisait PAS.
          // Sans cette ligne, la valeur passait la validation puis était jetée ici — le
          // silence exact qu'on ferme. Deux endroits, pas un.
          notes: data.notes,
        }
      })
    } catch (err: any) {
      // Aucun match sur { id, tenantId } (introuvable OU hors du tenant) → 404 cohérent
      // (le handler global mappe aussi P2025 → 404 ; on garde l'isolation sans fuite 500).
      if (err?.code === 'P2025') return reply.code(404).send({ error: 'Client introuvable' })
      return reply.code(500).send({ error: (err as Error).message })
    }
  })

  app.delete('/api/customers/:id', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { userId } = request.user
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const customer = await prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } }) // soft delete
    await writeAudit('DELETE_CUSTOMER', prisma.auditLog.create({
      data: { tenantId, userId, module: 'customers', action: 'DELETE_CUSTOMER', description: JSON.stringify({ id, name: customer.name }) },
    }))
    return reply.code(204).send()
  })

  // Restaurer un client soft-supprimé (ADMIN / SUPER_ADMIN)
  app.patch('/api/customers/:id/restore', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const { userId, role } = request.user
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Admin requis' })
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const customer = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    const restored = await prisma.customer.update({ where: { id }, data: { deletedAt: null } })
    await writeAudit('RESTORE_CUSTOMER', prisma.auditLog.create({
      data: { tenantId, userId, module: 'customers', action: 'RESTORE_CUSTOMER', description: JSON.stringify({ id, name: customer.name }) },
    }))
    return restored
  })

  // ─── HISTORIQUE D'ACHATS ──────────────
  // La donnée existait (`Sale.customerId`) mais AUCUN endpoint ne la servait : les deux
  // tables « Historique des achats » du front lisaient un tableau codé `[]`, donc elles
  // affichaient « aucun achat » à un client qui en avait — cf. #214.
  //
  // ⚠️ Les ventes REMBOURSÉES sont RENVOYÉES, avec leur `status`. Les exclure ferait
  // disparaître un événement réel de l'historique d'un client (« je n'ai jamais rien
  // rendu ») ; c'est une HISTOIRE, pas un agrégat de CA — les agrégats, eux, continuent
  // de les exclure. Le front marque la ligne, il ne la compte pas comme un achat.
  app.get('/api/customers/:id/sales', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    // Scope tenant STRICT sur le CLIENT (comme /loyalty) : sans lui, un id d'un autre
    // tenant renverrait [] — indiscernable d'« aucun achat », donc un oracle silencieux.
    const customer = await prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    const sales = await prisma.sale.findMany({
      // `tenantId` est REDONDANT avec le scope client ci-dessus, et c'est voulu : la
      // requête reste correcte même si l'appelant change (defense-in-depth, cf. § Isolation).
      where: { customerId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50, // même plafond que l'historique fidélité
      select: {
        id: true, total: true, createdAt: true, status: true, invoiceNumber: true,
        // Nombre de LIGNES, pas de quantités cumulées : la colonne « Articles » de
        // l'écran compte des lignes partout ailleurs (cf. la liste des commandes).
        _count: { select: { items: true } },
      },
    })
    return sales.map(s => ({
      id: s.id,
      total: s.total,
      createdAt: s.createdAt,
      status: s.status,
      invoiceNumber: s.invoiceNumber,
      items: s._count.items,
    }))
  })

  // ─── LOYALTY ──────────────────────────
  app.get('/api/customers/:id/loyalty', { preHandler: authenticate }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    // Scope tenant STRICT (fini le findUnique global = faille d'isolation).
    const customer = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    const points = customer.loyaltyPoints ?? 0
    // Seuils de palier CONFIGURABLES par tenant (pour le calcul + l'affichage front).
    const cfg = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        pointsPerAmount: true, bronzeThreshold: true, silverThreshold: true,
        bronzeDiscount: true, silverDiscount: true, goldDiscount: true,
        enableLoyalty: true, name: true, currency: true,
      },
    })
    const bronzeThreshold = cfg?.bronzeThreshold ?? 2000
    const silverThreshold = cfg?.silverThreshold ?? 5000
    const history = await prisma.loyaltyTransaction.findMany({
      where: { customerId: id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, points: true, type: true, reason: true, saleId: true, createdAt: true },
    }).catch(() => [])
    const tier = tierForPoints(points, bronzeThreshold, silverThreshold)
    return {
      points,
      tier,
      history,
      // Renvoyés pour que le front/mobile affiche progression/seuils/remises avec les valeurs du tenant.
      pointsPerAmount: cfg?.pointsPerAmount ?? 1000,
      bronzeThreshold,
      silverThreshold,
      // Loyalty v2 : remises par palier (0 = désactivé / non configuré).
      bronzeDiscount: cfg?.bronzeDiscount ?? 0,
      silverDiscount: cfg?.silverDiscount ?? 0,
      goldDiscount:   cfg?.goldDiscount   ?? 0,
    }
  })

  // ── Carte fidélité numérique (scope tenant strict, tout rôle authentifié) ──
  app.get('/api/customers/:id/loyalty-card', { preHandler: authenticate }, async (request, reply) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    const customer = await prisma.customer.findFirst({ where: { id, tenantId }, select: { id: true, name: true, loyaltyPoints: true, totalRevenue: true } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    const cfg = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true, currency: true, enableLoyalty: true, bronzeThreshold: true, silverThreshold: true,
        pointsPerAmount: true, bronzeDiscount: true, silverDiscount: true, goldDiscount: true,
      },
    })
    const points = customer.loyaltyPoints ?? 0
    const bronzeThreshold = cfg?.bronzeThreshold ?? 2000
    const silverThreshold = cfg?.silverThreshold ?? 5000
    const tier = tierForPoints(points, bronzeThreshold, silverThreshold)
    const nextTier = tier === 'Gold' ? null : tier === 'Silver' ? 'Gold' : 'Silver'
    const nextThreshold = tier === 'Bronze' ? bronzeThreshold : tier === 'Silver' ? silverThreshold : null
    return {
      customerId: customer.id,
      customerName: customer.name,
      tier,
      points,
      bronzeThreshold,
      silverThreshold,
      nextTier,
      pointsToNext: nextThreshold ? Math.max(0, nextThreshold - points) : 0,
      shopName: cfg?.name ?? 'HabaShop',
      currency: cfg?.currency ?? 'XOF',
      enableLoyalty: !!cfg?.enableLoyalty,
      // totalRevenue = base XOF (convertir côté client) ; pointsPerAmount = devise tenant (PAS de conversion).
      totalRevenue: customer.totalRevenue ?? 0,
      pointsPerAmount: cfg?.pointsPerAmount ?? 1000,
      bronzeDiscount: cfg?.bronzeDiscount ?? 5,
      silverDiscount: cfg?.silverDiscount ?? 10,
      goldDiscount: cfg?.goldDiscount ?? 15,
    }
  })

  app.post('/api/customers/:id/loyalty', { preHandler: authenticate, schema: { params: ID_PARAMS, body: LOYALTY_BODY } }, async (request, reply) => {
    const { role } = request.user
    // Ajustement manuel de points = levier de remise → réservé aux rôles de gestion
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(role ?? '')) {
      return reply.code(403).send({ error: 'Accès refusé — rôle MANAGER ou ADMIN requis' })
    }
    const { id } = request.params as { id: string }
    const { points, reason } = request.body as { points: number; reason?: string }
    if (typeof points !== 'number' || !Number.isFinite(points) || points === 0) {
      return reply.code(400).send({ error: 'points doit être un entier non nul' })
    }
    const tenantId = getTenantId(request)
    const customer = await prisma.customer.findFirst({ where: { id, tenantId } })
    if (!customer) return reply.code(404).send({ error: 'Client introuvable' })
    // Ajustement manuel : mute le solde + trace dans l'historique (même source de vérité).
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.customer.update({ where: { id }, data: { loyaltyPoints: { increment: points } } })
      await tx.loyaltyTransaction.create({
        data: { tenantId, customerId: id, points, type: points >= 0 ? 'earn' : 'reverse', reason: reason ?? 'manual' },
      })
      return u
    })
    return { points: updated.loyaltyPoints, tier: tierForPoints(updated.loyaltyPoints) }
  })
}
