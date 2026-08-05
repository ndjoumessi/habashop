import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * VERROU TARIFAIRE — côté BACKEND (facturation).
 *
 * Il a existé SIX grilles pour deux formules : `routes/payments.ts`, `routes/billing.ts`,
 * `UpgradePlan.tsx`, `AdminDashboard.tsx`, la vitrine (14 400 / 34 750) et le JSON-LD
 * d'`index.html` (9 900 / 24 900 / 49 900). Conséquences MESURÉES :
 *   • `starter` — attribué à CHAQUE inscription par `routes/auth.ts` — n'existait dans
 *     aucune grille du tunnel : le parcours principal finissait en 400 « Plan invalide » ;
 *   • `billing.ts` avait un repli `?? 24900` qui facturait le prix de `pro` à tout plan
 *     inconnu, en silence ;
 *   • la vitrine allait afficher 8 000 pendant que 9 900 aurait été prélevé.
 *
 * ⚠️ Ce test LIT LES DEUX CÔTÉS. Vérifier l'invariant à un seul endroit ne prouve rien —
 * c'est précisément ce qui a laissé quatre prix diverger : chaque fichier était cohérent
 * avec lui-même. Il compare donc le jumeau backend, le jumeau frontend et la fixture
 * partagée, puis exerce le VRAI tunnel de paiement par `app.inject()`.
 *
 * Propriétés exigées du verrou lui-même : assertion de COUVERTURE (`describe`
 * « couverture »), et survie à son PROPRE scan (`describe` « auto-exclusion »).
 */

const BACKEND = join(__dirname, '..', '..')            // apps/backend
const REPO = join(BACKEND, '..', '..')                 // racine du monorepo
const FIXTURE = join(REPO, 'docs', 'shared-fixtures', 'plan-catalog.json')
const TWIN_BACK = join(BACKEND, 'src', 'lib', 'plans.ts')
const TWIN_FRONT = join(REPO, 'apps', 'frontend', 'src', 'lib', 'plans.ts')

// ⚠️ Lecture à l'EXÉCUTION, jamais `import`. Le contexte de build Docker est
// `apps/backend` seul : un import hors de cette frontière compile en local puis casse
// le déploiement Railway en TS2307 (vécu le 2026-08-05). Un chemin runtime n'est pas
// résolu par tsc → l'image se construit, et le test ne s'exécute simplement pas dedans.
interface FixturePlan {
  id: string; label: string
  monthly: number | null; yearly: number | null
  purchasable: boolean; billable: boolean
}
interface Fixture {
  yearlyMonths: number; xofPerEur: number; defaultPlanOnSignup: string
  aliases: Record<string, string>
  plans: FixturePlan[]
  _expectedEur: Record<string, string>
}
const fixture: Fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'))

vi.mock('../db', () => ({
  prisma: {
    planRequest: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: { user?: unknown; tenantId?: string }) => {
    req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }
    req.tenantId = 'T1'
  },
}))
vi.mock('../services/wave', () => ({
  createWaveCheckout: vi.fn().mockResolvedValue({ checkoutUrl: 'https://pay.test/w', checkoutId: 'w1', status: 'pending' }),
  verifyWaveWebhook: vi.fn(),
}))
vi.mock('../services/orangeMoney', () => ({
  createOMPayment: vi.fn().mockResolvedValue({ paymentUrl: 'https://pay.test/o', payToken: 'o1' }),
  verifyOrangeWebhook: vi.fn(),
}))
vi.mock('../services/email', () => ({ sendUpgradeConfirmation: vi.fn() }))

import { prisma } from '../db'
import { paymentRoutes, resolveCheckout } from '../routes/payments'
import {
  PLANS, PLAN_ALIASES, DEFAULT_PLAN_ON_SIGNUP, YEARLY_MONTHS, XOF_PER_EUR,
  planAmountXOF, resolvePlanId, purchasablePlans, amountEur,
} from '../lib/plans'

/** Mocks typés — `as unknown as Mock` évite le `any` que le cliquet de lint compte. */
const createMock = prisma.planRequest.create as unknown as Mock
const updateMock = prisma.planRequest.update as unknown as Mock

async function buildApp() {
  const app = Fastify()
  app.setValidatorCompiler(validatorCompiler)
  await app.register(paymentRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  createMock.mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'pr1', ...args.data }))
  updateMock.mockResolvedValue({})
})

// ─────────────────────────────────────────────────────────────────────────────
describe('couverture (sans ça, un fichier déplacé rendrait ce test vert et vide)', () => {
  it('lit la fixture partagée ET les DEUX jumeaux', () => {
    for (const f of [FIXTURE, TWIN_BACK, TWIN_FRONT]) {
      expect(existsSync(f), `introuvable : ${f}`).toBe(true)
      expect(readFileSync(f, 'utf8').length).toBeGreaterThan(500)
    }
  })
  it('la fixture décrit bien les trois plans attendus', () => {
    expect(fixture.plans).toHaveLength(3)
    expect(fixture.plans.map(p => p.id)).toEqual(['starter', 'business', 'enterprise'])
    expect(Object.keys(fixture._expectedEur).filter(k => k !== '_comment')).toHaveLength(4)
  })
})

describe('jumeau backend ↔ fixture partagée', () => {
  it('les trois plans coïncident, champ par champ', () => {
    expect(PLANS.map(p => ({ ...p }))).toEqual(
      fixture.plans.map(p => ({
        id: p.id, label: p.label, monthly: p.monthly, yearly: p.yearly,
        purchasable: p.purchasable, billable: p.billable,
      })),
    )
  })
  it('constantes transverses', () => {
    expect(YEARLY_MONTHS).toBe(fixture.yearlyMonths)
    expect(XOF_PER_EUR).toBe(fixture.xofPerEur)
    expect(DEFAULT_PLAN_ON_SIGNUP).toBe(fixture.defaultPlanOnSignup)
    expect(PLAN_ALIASES).toEqual(fixture.aliases)
  })
  it('yearly == monthly × YEARLY_MONTHS (2 mois offerts), règle réelle du code', () => {
    for (const p of PLANS) {
      if (p.monthly === null) { expect(p.yearly).toBeNull(); continue }
      expect(p.yearly).toBe(p.monthly * YEARLY_MONTHS)
    }
  })
  it('contrepartie euro calculée DEPUIS le FCFA, à la parité fixe', () => {
    const fmt = (n: number) => n.toFixed(2).replace('.', ',')
    expect(fmt(amountEur(8000))).toBe(fixture._expectedEur['starter.monthly'])
    expect(fmt(amountEur(80000))).toBe(fixture._expectedEur['starter.yearly'])
    expect(fmt(amountEur(25000))).toBe(fixture._expectedEur['business.monthly'])
    expect(fmt(amountEur(250000))).toBe(fixture._expectedEur['business.yearly'])
  })
})

describe('jumeau backend ↔ jumeau frontend (anti-dérive entre les deux côtés)', () => {
  /** Corps du module, sans l'en-tête de doc qui nomme légitimement l'autre côté. */
  const body = (path: string) => readFileSync(path, 'utf8').slice(readFileSync(path, 'utf8').indexOf('export type PlanId'))

  it('les deux fichiers ont un corps IDENTIQUE', () => {
    expect(body(TWIN_FRONT)).toBe(body(TWIN_BACK))
  })
  it('… et le corps comparé est non vide (sinon on comparerait deux chaînes vides)', () => {
    expect(body(TWIN_BACK).length).toBeGreaterThan(1000)
    expect(body(TWIN_BACK)).toContain('purchasablePlans')
  })
})

describe('alias ascendant `pro` — accepté en lecture, jamais écrit', () => {
  it('résout vers business', () => {
    expect(resolvePlanId('pro')).toBe('business')
    expect(resolvePlanId('PRO')).toBe('business')
    expect(planAmountXOF('pro', 'monthly')).toBe(planAmountXOF('business', 'monthly'))
  })
  it("n'est pas un plan canonique", () => {
    expect(PLANS.map(p => p.id)).not.toContain('pro')
  })
  it('un identifiant inconnu ne retombe sur AUCUN prix (pas de repli à 24 900)', () => {
    expect(resolvePlanId('gold')).toBeNull()
    expect(planAmountXOF('gold', 'monthly')).toBeNull()
    expect(planAmountXOF(undefined, 'monthly')).toBeNull()
  })
})

describe('invariant : le plan attribué à l’inscription DOIT être achetable', () => {
  it('DEFAULT_PLAN_ON_SIGNUP est purchasable', () => {
    const d = PLANS.find(p => p.id === DEFAULT_PLAN_ON_SIGNUP)
    expect(d, 'plan par défaut absent du catalogue').toBeDefined()
    expect(d!.purchasable, 'le plan par défaut n’est pas achetable → 400 au checkout').toBe(true)
    expect(d!.monthly).not.toBeNull()
  })
  it('routes/auth.ts consomme la constante, pas un littéral', () => {
    const auth = readFileSync(join(BACKEND, 'src', 'routes', 'auth.ts'), 'utf8')
    expect(auth).toContain('DEFAULT_PLAN_ON_SIGNUP')
    expect(auth).not.toMatch(/plan:\s*'starter'/)
  })
})

describe('invariant EXIGÉ : un plan facturable mais NON achetable doit exister', () => {
  // ⚠️ Cette exigence est POSITIVE et volontaire. Sans elle, remettre enterprise dans le
  // self-service (ou le supprimer du catalogue) passerait inaperçu. La distinction
  // « facturable ≠ achetable » est la décision commerciale du 2026-08-06 : un tenant déjà
  // sur enterprise continue d'être facturé — au montant de sa PlanRequest, saisi par
  // l'opérateur — alors que plus personne ne peut l'acheter en libre-service.
  it('enterprise est billable mais pas purchasable', () => {
    const e = PLANS.find(p => p.id === 'enterprise')!
    expect(e.billable).toBe(true)
    expect(e.purchasable).toBe(false)
    expect(e.monthly).toBeNull()
    expect(e.yearly).toBeNull()
  })
  it('au moins un plan est dans ce cas — l’invariant a un sujet', () => {
    expect(PLANS.filter(p => p.billable && !p.purchasable).length).toBeGreaterThanOrEqual(1)
  })
  it('tous les plans achetables ont un prix pour les DEUX périodes', () => {
    for (const p of purchasablePlans()) {
      expect(p.monthly, `${p.id}.monthly`).toBeTypeOf('number')
      expect(p.yearly, `${p.id}.yearly`).toBeTypeOf('number')
    }
  })
})

describe('resolveCheckout — décision pure', () => {
  it('accepte chaque plan achetable, aux deux périodes', () => {
    for (const p of purchasablePlans()) {
      for (const period of ['monthly', 'yearly'] as const) {
        const r = resolveCheckout(p.id, period)
        expect(r.kind).toBe('ok')
        if (r.kind === 'ok') expect(r.amount).toBe(planAmountXOF(p.id, period))
      }
    }
  })
  it('enterprise → quote_only (PAS invalid : c’est un choix commercial)', () => {
    expect(resolveCheckout('enterprise', 'monthly').kind).toBe('quote_only')
    expect(resolveCheckout('enterprise', 'yearly').kind).toBe('quote_only')
  })
  it('alias `pro` accepté, et normalisé vers business', () => {
    const r = resolveCheckout('pro', 'monthly')
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') {
      expect(r.planId).toBe('business')
      expect(r.amount).toBe(planAmountXOF('business', 'monthly'))
    }
  })
  it('plan ou période inconnus → invalid', () => {
    expect(resolveCheckout('gold', 'monthly').kind).toBe('invalid')
    expect(resolveCheckout('starter', 'weekly').kind).toBe('invalid')
    expect(resolveCheckout(undefined, 'monthly').kind).toBe('invalid')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LE PARCOURS RÉEL — un test qui ne fait pas l'appel ne prouve pas que le 400 a disparu.
// ─────────────────────────────────────────────────────────────────────────────
describe('tunnel de paiement — prix AFFICHÉ == prix FACTURÉ, plan par plan, période par période', () => {
  for (const route of ['/api/payments/wave/checkout', '/api/payments/orange/checkout']) {
    for (const p of purchasablePlans()) {
      for (const period of ['monthly', 'yearly'] as const) {
        it(`${route} — ${p.id}/${period} facture ${planAmountXOF(p.id, period)} XOF`, async () => {
          const app = await buildApp()
          const res = await app.inject({ method: 'POST', url: route, payload: { plan: p.id, period } })
          expect(res.statusCode, res.body).toBe(200)
          // Le montant ENREGISTRÉ est celui du catalogue — pas un littéral de route.
          const created = createMock.mock.calls[0][0].data
          expect(created.amount).toBe(planAmountXOF(p.id, period))
          expect(created.plan).toBe(p.id)          // canonique
          expect(created.period).toBe(period)
          expect(JSON.parse(res.body).amount).toBe(planAmountXOF(p.id, period))
        })
      }
    }

    it(`${route} — enterprise → 422 PLAN_QUOTE_ONLY, pas 400, et AUCUNE PlanRequest`, async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'POST', url: route, payload: { plan: 'enterprise', period: 'monthly' } })
      expect(res.statusCode).toBe(422)
      const body = JSON.parse(res.body)
      expect(body.code).toBe('PLAN_QUOTE_ONLY')
      expect(body.contactEmail).toBeTruthy()
      expect(prisma.planRequest.create).not.toHaveBeenCalled()
    })

    it(`${route} — l'ancien défaut est fermé : starter ne renvoie plus 400`, async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'POST', url: route, payload: { plan: 'starter', period: 'monthly' } })
      expect(res.statusCode).not.toBe(400)
      expect(res.statusCode).toBe(200)
    })

    it(`${route} — plan inconnu → 400`, async () => {
      const app = await buildApp()
      const res = await app.inject({ method: 'POST', url: route, payload: { plan: 'gold', period: 'monthly' } })
      expect(res.statusCode).toBe(400)
    })
  }
})

describe('aucun littéral de prix hors de la source unique', () => {
  const ROUTES = join(BACKEND, 'src', 'routes')
  const FILES = ['payments.ts', 'billing.ts', 'admin.ts', 'auth.ts', 'subscriptions.ts']
    .map(f => join(ROUTES, f)).filter(existsSync)

  /** Retire commentaires et imports : les commentaires CITENT les anciens prix exprès. */
  const stripped = (p: string) => readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/^\s*import[^\n]*$/gm, ' ')

  // Anciens prix + prix courants : AUCUN ne doit apparaître ailleurs que dans lib/plans.ts.
  const FORBIDDEN = [9900, 24900, 49900, 249000, 499000, 14400, 34750, 8000, 25000, 80000, 250000]

  it('les fichiers scannés existent et sont non vides', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(4)
    for (const f of FILES) expect(stripped(f).length).toBeGreaterThan(500)
  })

  it('aucun montant de plan en dur dans les routes', () => {
    const hits: string[] = []
    for (const f of FILES) {
      stripped(f).split('\n').forEach((line, idx) => {
        for (const n of FORBIDDEN) {
          if (new RegExp(`\\b${n}\\b`).test(line)) hits.push(`${f.split('/src/')[1]}:${idx + 1} → ${n} · ${line.trim().slice(0, 90)}`)
        }
      })
    }
    expect(hits).toEqual([])
  })

  it('… et le scan sait mordre (contre-preuve)', () => {
    const sabotage = "  const amount = PLAN_PRICES[plan]?.monthly ?? 24900"
    expect(FORBIDDEN.some(n => new RegExp(`\\b${n}\\b`).test(sabotage))).toBe(true)
    const sain = "  const amount = planAmountXOF(plan.id, period) ?? 0"
    expect(FORBIDDEN.some(n => new RegExp(`\\b${n}\\b`).test(sain))).toBe(false)
  })
})

describe('auto-exclusion : le verrou survit à son propre scan', () => {
  const SELF = join(BACKEND, 'src', 'tests', 'planCatalog.test.ts')
  it('ce fichier contient bien des montants interdits (sinon la preuve est vide)', () => {
    const self = readFileSync(SELF, 'utf8')
    expect(/\b24900\b/.test(self)).toBe(true)
    expect(/\b49900\b/.test(self)).toBe(true)
  })
  it("n'appartient PAS au corpus scanné — il serait rouge en permanence", () => {
    const ROUTES = join(BACKEND, 'src', 'routes')
    expect(SELF.startsWith(ROUTES)).toBe(false)
    expect(SELF).toContain('/src/tests/')
  })
})

describe('limites assumées', () => {
  it('les documente', () => {
    const LIMITES = [
      // 1 — Le scan de littéraux couvre les ROUTES de facturation, pas tout `src/`.
      //     Un montant en dur dans un service ou un e-mail passerait.
      'scan-limite-aux-routes-de-facturation',
      // 2 — Il juge la SOURCE : un montant assemblé à l'exécution (8*1000) échappe.
      'montant-assemble-a-l-execution-non-vu',
      // 3 — Il ne dit rien du montant réellement PRÉLEVÉ par le prestataire : le SDK est
      //     mocké. On prouve ce qu'on ENVOIE, pas ce que Wave encaisse.
      'montant-preleve-cote-prestataire-non-verifiable-ici',
      // 4 — Aucun tenant n'est aujourd'hui sur enterprise (mesuré le 2026-08-06). La
      //     résolution du montant d'un enterprise EXISTANT via sa PlanRequest n'est donc
      //     pas exercée sur des données réelles, seulement par construction.
      'facturation-enterprise-existant-non-exercee-sur-donnees-reelles',
    ]
    expect(LIMITES).toHaveLength(4)
  })
})
