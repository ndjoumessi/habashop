import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import {
  PLANS, PLAN_ALIASES, DEFAULT_PLAN_ON_SIGNUP, YEARLY_MONTHS, XOF_PER_EUR,
  planAmountXOF, resolvePlanId, amountEur,
} from '@/lib/plans'

/**
 * VERROU TARIFAIRE — côté FRONTEND (affichage).
 *
 * Pendant du backend (`apps/backend/src/tests/planCatalog.test.ts`). Les deux lisent la
 * MÊME fixture `docs/shared-fixtures/plan-catalog.json` et le jumeau de l'autre côté :
 * faire bouger un seul côté fait rougir l'autre. C'est l'exigence centrale — vérifier
 * l'invariant à un seul endroit ne prouve rien, chaque fichier était cohérent avec
 * lui-même quand quatre prix divergeaient.
 *
 * Le rendu, lui, est exercé dans `planCatalogRender.test.tsx` (le JSX exige un fichier
 * `.tsx` ; le séparer évite de transformer ce scan de sources en test de composant).
 */

const SRC = resolve(__dirname, '..')                    // apps/frontend/src
const FRONTEND = resolve(SRC, '..')                     // apps/frontend
const REPO = resolve(FRONTEND, '..', '..')              // racine
const FIXTURE = join(REPO, 'docs', 'shared-fixtures', 'plan-catalog.json')
const TWIN_FRONT = join(SRC, 'lib', 'plans.ts')
const TWIN_BACK = join(REPO, 'apps', 'backend', 'src', 'lib', 'plans.ts')

// Lecture à l'EXÉCUTION (readFileSync), jamais `import` : convention du dépôt pour toute
// fixture partagée — un chemin runtime n'est pas résolu par tsc, donc rien ne casse un
// build dont le contexte ne contient pas `docs/`.
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

describe('couverture (un fichier déplacé rendrait ce test vert et vide)', () => {
  it('lit la fixture ET les DEUX jumeaux', () => {
    for (const f of [FIXTURE, TWIN_FRONT, TWIN_BACK]) {
      expect(existsSync(f), `introuvable : ${f}`).toBe(true)
      expect(readFileSync(f, 'utf8').length).toBeGreaterThan(500)
    }
    expect(fixture.plans).toHaveLength(3)
  })
})

describe('jumeau frontend ↔ fixture partagée', () => {
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
  it('la grille arrêtée : Starter 8 000, Business 25 000, Enterprise sur devis', () => {
    expect(planAmountXOF('starter', 'monthly')).toBe(8000)
    expect(planAmountXOF('business', 'monthly')).toBe(25000)
    expect(planAmountXOF('enterprise', 'monthly')).toBeNull()
  })
  it('annuel = mensuel × 10 (2 mois offerts) — règle réelle du code, pas inventée', () => {
    expect(planAmountXOF('starter', 'yearly')).toBe(8000 * YEARLY_MONTHS)
    expect(planAmountXOF('business', 'yearly')).toBe(25000 * YEARLY_MONTHS)
    expect(YEARLY_MONTHS).toBe(10)
  })
  it('euro calculé DEPUIS le FCFA à la parité fixe, arrondi au centime', () => {
    const fmt = (n: number) => n.toFixed(2).replace('.', ',')
    expect(fmt(amountEur(8000))).toBe('12,20')      // 8000/655,957  = 12,1959…
    expect(fmt(amountEur(25000))).toBe('38,11')     // 25000/655,957 = 38,1122…
    expect(fmt(amountEur(80000))).toBe('121,96')
    expect(fmt(amountEur(250000))).toBe('381,12')
    expect(fmt(amountEur(8000))).toBe(fixture._expectedEur['starter.monthly'])
    expect(fmt(amountEur(250000))).toBe(fixture._expectedEur['business.yearly'])
  })
})

describe('jumeau frontend ↔ jumeau backend (anti-dérive entre les deux côtés)', () => {
  const body = (path: string) => {
    const s = readFileSync(path, 'utf8')
    return s.slice(s.indexOf('export type PlanId'))
  }
  it('les deux fichiers ont un corps IDENTIQUE', () => {
    expect(body(TWIN_FRONT)).toBe(body(TWIN_BACK))
  })
  it('… et le corps comparé est non vide', () => {
    expect(body(TWIN_FRONT).length).toBeGreaterThan(1000)
    expect(body(TWIN_FRONT)).toContain('purchasablePlans')
  })
})

describe('invariants du catalogue', () => {
  it('le plan attribué à l’inscription est ACHETABLE', () => {
    const d = PLANS.find(p => p.id === DEFAULT_PLAN_ON_SIGNUP)!
    expect(d.purchasable).toBe(true)
    expect(d.monthly).not.toBeNull()
  })
  it('EXIGÉ : un plan facturable mais NON achetable existe (enterprise, sur devis)', () => {
    const quoteOnly = PLANS.filter(p => p.billable && !p.purchasable)
    expect(quoteOnly.map(p => p.id)).toEqual(['enterprise'])
    expect(quoteOnly[0].monthly).toBeNull()
  })
  it('`pro` est un alias de lecture, jamais un plan canonique', () => {
    expect(resolvePlanId('pro')).toBe('business')
    expect(PLANS.map(p => p.id)).not.toContain('pro')
  })
  it('un plan inconnu ne retombe sur AUCUN prix', () => {
    expect(planAmountXOF('gold', 'monthly')).toBeNull()
  })
})

/**
 * ⚠️ LE BLOC « aucun littéral de prix » A ÉTÉ DÉPLACÉ dans `planPriceLiterals.test.ts`,
 * et RÉÉCRIT — il ne gardait rien.
 *
 *  • Il cherchait `\b8000\b` quand toute chaîne visible écrit « 8 000 » (et « 8,000 » en
 *    anglais) : le motif n'apparaissait dans AUCUNE copie, donc vert par construction.
 *  • Son `FILES` était une liste ÉCRITE À LA MAIN — la construction que `landingClaims`
 *    venait d'abandonner. Elle omettait `components/signup/` et tout le backend, où
 *    `services/email.ts` envoyait « 24 900 F CFA/mois » à chaque relance d'essai.
 *
 * Le remplaçant marche sur les trois cibles (web, API, mobile) sans aucune liste, et juge
 * un nombre PRÉSENTÉ COMME DE L'ARGENT plutôt qu'une suite de chiffres.
 *
 * Ce fichier garde ce qu'il prouve vraiment : la cohérence du catalogue et de ses jumeaux.
 */
