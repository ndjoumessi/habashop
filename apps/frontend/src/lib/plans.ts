/**
 * CATALOGUE DES PLANS — source unique côté FRONTEND.
 *
 * ⚠️ JUMEAU À L'IDENTIQUE de `apps/backend/src/lib/plans.ts`. Les deux sont exercés
 * contre `docs/shared-fixtures/plan-catalog.json`, lu à l'EXÉCUTION par les tests
 * (`readFileSync`, jamais `import` — le contexte Docker du backend est `apps/backend`
 * seul, un import hors de cette frontière casse le déploiement en TS2307).
 *
 * Ce module remplace QUATRE grilles qui avaient divergé pour deux formules :
 *   routes/payments.ts   pro 24 900 / enterprise 49 900
 *   routes/billing.ts    idem, plus un repli `?? 24900` qui facturait le prix de `pro`
 *                        à n'importe quel plan inconnu
 *   UpgradePlan.tsx      idem, côté client
 *   AdminDashboard.tsx   starter 9 900 · pro 24 900 · business 24 900 · enterprise 49 900
 * pendant que la vitrine affichait 14 400 / 34 750 et le JSON-LD 9 900 / 24 900 / 49 900.
 *
 * ⚠️ `starter` n'existait dans AUCUNE de ces grilles côté tunnel de paiement, alors que
 * `routes/auth.ts` l'attribue à CHAQUE inscription : le CTA principal du produit menait
 * à un 400 « Plan invalide ». Un plan attribué par défaut DOIT être achetable.
 */

/** Identifiants canoniques. `pro` n'en fait plus partie : c'est un alias de lecture. */
export type PlanId = 'starter' | 'business' | 'enterprise'
export type BillingPeriod = 'monthly' | 'yearly'

export interface Plan {
  id: PlanId
  label: string
  /** Prix mensuel en XOF. `null` = aucun tarif public (devis). */
  monthly: number | null
  /** Prix annuel en XOF = monthly × YEARLY_MONTHS. `null` = devis. */
  yearly: number | null
  /** Vendable en SELF-SERVICE : affiché avec un prix ET accepté par le tunnel. */
  purchasable: boolean
  /** Facturable : un tenant peut être dessus et être facturé. ≠ purchasable. */
  billable: boolean
}

/** 10 mois payés pour 12 → « 2 mois offerts ». Règle déjà présente dans le code. */
export const YEARLY_MONTHS = 10

/** Parité FIXE franc CFA / euro. Jamais un taux de marché. */
export const XOF_PER_EUR = 655.957

/** Plan attribué à l'inscription (`routes/auth.ts`). Doit être `purchasable`. */
export const DEFAULT_PLAN_ON_SIGNUP: PlanId = 'starter'

/**
 * Alias ascendants : acceptés EN LECTURE (tenants existants, PlanRequest en cours,
 * webhooks en vol), plus jamais écrits.
 *
 * ⚠️ Mesuré en production le 2026-08-06 : AUCUN tenant n'est sur `pro` (starter ×2,
 * business ×2) et la table `PlanRequest` est VIDE. Le renommage est donc un no-op en
 * base — l'alias ne sert qu'au code et aux requêtes déjà parties.
 */
export const PLAN_ALIASES: Record<string, PlanId> = { pro: 'business' }

export const PLANS: readonly Plan[] = [
  { id: 'starter',    label: 'Starter',    monthly:  8000, yearly:  80000, purchasable: true,  billable: true },
  { id: 'business',   label: 'Business',   monthly: 25000, yearly: 250000, purchasable: true,  billable: true },
  { id: 'enterprise', label: 'Enterprise', monthly:  null, yearly:   null, purchasable: false, billable: true },
]

/** Résout un identifiant reçu (alias compris) vers un identifiant canonique. */
export function resolvePlanId(raw: unknown): PlanId | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase()
  if (PLAN_ALIASES[key]) return PLAN_ALIASES[key]
  return PLANS.some(p => p.id === key) ? (key as PlanId) : null
}

export function getPlan(raw: unknown): Plan | null {
  const id = resolvePlanId(raw)
  return id ? PLANS.find(p => p.id === id) ?? null : null
}

/** Plans vendables en self-service (vitrine + tunnel). */
export function purchasablePlans(): Plan[] {
  return PLANS.filter(p => p.purchasable)
}

/**
 * Montant en XOF pour un couple plan/période, ou `null` si le plan n'a pas de tarif
 * public (devis).
 *
 * ⚠️ AUCUN REPLI. `billing.ts` avait `?? PLAN_PRICES[plan]?.monthly ?? 24900` : un plan
 * inconnu se faisait facturer le prix de `pro`, en silence. Une absence de tarif doit
 * rester une absence — c'est l'appelant qui décide quoi en faire.
 */
export function planAmountXOF(raw: unknown, period: BillingPeriod): number | null {
  const plan = getPlan(raw)
  if (!plan) return null
  return period === 'yearly' ? plan.yearly : plan.monthly
}

/** Contrepartie euro, calculée DEPUIS le FCFA à la parité fixe, arrondie au centime. */
export function amountEur(xof: number): number {
  return Math.round((xof / XOF_PER_EUR) * 100) / 100
}
