import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { prisma } from '../db'
import { signActiveToken } from '../lib/authToken'
import { newDemoTenantId, demoExpiryFrom } from '../lib/demoLifetime'
import { buildDemoDataset, type DemoTx } from '../lib/demoDataset'
import { reserveDemoSlot, releaseDemoSlot, DEMO_QUOTA_EXCEEDED, DEMO_QUOTA_UNAVAILABLE } from '../lib/demoQuota'
import { vatRateOrZero } from '../lib/vatRate'
import { DEFAULT_PLAN_ON_SIGNUP } from '../lib/plans'

/**
 * DÉMO JETABLE EN LIBRE-SERVICE — `POST /api/demo/start`, publique.
 *
 * ⚠️ Le prospect n'entre JAMAIS dans une démo partagée. Il obtient son propre tenant, sans
 * mot de passe publié et sans autre visiteur dedans. C'est ce qui permet de ne pas armer le
 * déclencheur du CLAUDE.md (« le premier prospect envoyé sur la démo ») : `demo1234` reste
 * hors du bundle et `verify:demo-flag` reste intact.
 *
 * ⚠️ Aucune donnée n'est demandée au visiteur ⇒ AUCUNE PII collectée. L'adresse du compte est
 * synthétique et non routable, donc aucun e-mail ne PEUT partir — y compris celui de
 * bienvenue que `register` envoie.
 *
 * ⚠️ `isDemo: true` apporte GRATUITEMENT les deux protections : refus serveur sur tout ce qui
 * coûte ou détruit (`blockDemoTenant`, fail-closed) et exclusion des agrégats de la console
 * Ops (`CLIENT_TENANTS_WHERE` décide par propriété). Ne rien réimplémenter.
 */

/** Locale de la démo. ⚠️ OUEST-africaine — ne pas aligner sur le marché par défaut (CM/XAF). */
const DEMO_COUNTRY = 'SN'
const DEMO_CURRENCY = 'XOF'

export async function demoRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/demo/start', {
    config: {
      rateLimit: {
        // ⚠️ GÉNÉREUX À DESSEIN : CGNAT ouest-africain — une IP est partagée par des
        // visiteurs sans lien. Le vrai garde est le plafond GLOBAL (`demoQuota`).
        max: 20,
        timeWindow: '1 hour',
        errorResponseBuilder: (_req: unknown, context: { ttl?: number }) => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Trop de démos ouvertes depuis cette connexion. Réessayez dans ${Math.max(1, Math.ceil((context.ttl ?? 0) / 60000))} minute(s).`,
          code: DEMO_QUOTA_EXCEEDED,
        }),
      },
    },
  }, async (_request, reply) => {
    const creneau = await reserveDemoSlot()
    if (!creneau.ok) {
      // ⚠️ DEUX refus DISTINCTS. « Le compteur est indisponible » n'est pas « trop de démos
      // aujourd'hui » : les fondre dirait au visiteur une chose fausse, et priverait
      // l'exploitant du signal qui distingue un incident d'un afflux.
      if (creneau.failClosed) {
        return reply.code(503).send({
          error: 'La démonstration est momentanément indisponible. Créez votre boutique — l’essai est gratuit.',
          code: DEMO_QUOTA_UNAVAILABLE,
        })
      }
      return reply.code(429).send({
        error: 'Le nombre de démonstrations ouvertes aujourd’hui est atteint. Créez votre boutique — l’essai est gratuit.',
        code: DEMO_QUOTA_EXCEEDED,
      })
    }

    const now = new Date()
    const tenantId = newDemoTenantId()
    const echeance = demoExpiryFrom(now)

    // ⚠️ Le créneau réservé est RENDU si la création échoue : sans cela le compteur mesure
    // les TENTATIVES et non les démos existantes, et le bouton finit par annoncer « plafond
    // atteint » alors qu'aucune démo n'existe.
    let cree: { tenant: { id: string; name: string; demoExpiresAt: Date | null }; user: { id: string; name: string | null; email: string; role: string } }
    try {
      cree = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          id: tenantId,
          name: 'Boutique de démonstration',
          currency: DEMO_CURRENCY,
          country: DEMO_COUNTRY,
          // ⚠️ DÉRIVÉ du pays, jamais un littéral : c'est la règle qui a rattrapé les
          // 19,25 % camerounais facturés à 18 % par le `@default(18)` du schéma.
          vatRate: vatRateOrZero(DEMO_COUNTRY),
          plan: DEFAULT_PLAN_ON_SIGNUP,
          status: 'trial',
          isActive: true,
          isDemo: true,
          trialEnds: echeance,
          demoExpiresAt: echeance,
        },
      })
      const user = await tx.user.create({
        data: {
          name: 'Visiteur démo',
          // Non routable : rien ne peut partir vers cette adresse.
          email: `demo-${randomUUID()}@demo.local`,
          // Mot de passe ALÉATOIRE, jamais affiché, jamais journalisé — la session passe
          // par le JWT rendu ci-dessous, pas par une connexion ultérieure.
          passwordHash: await bcrypt.hash(randomUUID(), 12),
          role: 'ADMIN',
          tenantId: tenant.id,
        },
      })
      await tx.userTenant.create({ data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' } })
      // ⚠️ DANS la transaction : une démo à moitié peuplée se lit comme un produit cassé.
      // Si ceci lève, tout est annulé et l'appelant reçoit une erreur — jamais un 201.
      // Le pont de type restreint la surface du client à ce que le générateur utilise ;
      // il ne RÉTRÉCIT aucun domaine de valeurs.
      await buildDemoDataset(tx as unknown as DemoTx, { tenantId: tenant.id, cashierId: user.id, now })
        return { tenant, user }
      }, { timeout: 30_000, maxWait: 10_000 })
    } catch (e) {
      await releaseDemoSlot(now)
      throw e
    }
    const { tenant, user } = cree

    const token = signActiveToken(app, { userId: user.id, role: user.role, tenantId: tenant.id })

    return reply.code(201).send({
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        shopName: tenant.name, isPlatformAdmin: false,
      },
      // `demoExpiresAt` voyage jusqu'au front : le bandeau affiche l'échéance SERVEUR,
      // jamais un « 7 jours » recalculé côté client.
      tenant,
    })
  })
}
