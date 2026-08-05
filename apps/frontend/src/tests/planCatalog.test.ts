import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
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

describe('aucun littéral de prix hors de la source unique', () => {
  const walk = (dir: string): string[] => {
    const out: string[] = []
    for (const e of readdirSync(dir)) {
      const full = join(dir, e)
      if (statSync(full).isDirectory()) out.push(...walk(full))
      else if (/\.tsx?$/.test(e)) out.push(full)
    }
    return out
  }
  const FILES = [
    ...walk(join(SRC, 'components', 'landing')),
    join(SRC, 'pages', 'UpgradePlan.tsx'),
    join(SRC, 'pages', 'AdminDashboard.tsx'),
    join(SRC, 'pages', 'Pricing.tsx'),
    join(SRC, 'pages', 'LandingPage.tsx'),
    join(FRONTEND, 'index.html'),
  ].filter(existsSync)

  /** Retire commentaires HTML/JS et imports — les commentaires citent les anciens prix. */
  const stripped = (p: string) => readFileSync(p, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/^\s*import[^\n]*$/gm, ' ')

  const FORBIDDEN = [9900, 24900, 49900, 249000, 499000, 14400, 34750]
  // ⚠️ Les prix COURANTS sont interdits ici aussi : la seule exception est `index.html`,
  // dont le JSON-LD ne peut pas importer de module JS — il porte donc les montants en
  // clair. Cette exception est NOMMÉE, pour qu'on ne l'élargisse pas par inadvertance.
  const CURRENT = [8000, 25000, 80000, 250000]

  it('les fichiers scannés existent et sont non vides', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(10)
    for (const f of FILES) expect(stripped(f).length, f).toBeGreaterThan(200)
  })

  it('aucun ANCIEN prix nulle part', () => {
    const hits: string[] = []
    for (const f of FILES) {
      stripped(f).split('\n').forEach((line, idx) => {
        for (const n of FORBIDDEN) {
          if (new RegExp(`\\b${n}\\b`).test(line)) hits.push(`${f.replace(FRONTEND + '/', '')}:${idx + 1} → ${n}`)
        }
      })
    }
    expect(hits).toEqual([])
  })

  it('aucun prix COURANT en dur, sauf le JSON-LD d’index.html (exception nommée)', () => {
    const hits: string[] = []
    for (const f of FILES) {
      if (f.endsWith('index.html')) continue
      stripped(f).split('\n').forEach((line, idx) => {
        for (const n of CURRENT) {
          if (new RegExp(`\\b${n}\\b`).test(line)) hits.push(`${f.replace(FRONTEND + '/', '')}:${idx + 1} → ${n}`)
        }
      })
    }
    expect(hits).toEqual([])
  })

  it('… et le JSON-LD d’index.html reste ALIGNÉ sur le catalogue', () => {
    const html = readFileSync(join(FRONTEND, 'index.html'), 'utf8')
    const offers = [...html.matchAll(/"name":\s*"(Starter|Business)"[\s\S]{0,120}?"price":\s*"(\d+)"/g)]
    expect(offers.length, 'offres Starter/Business absentes du JSON-LD').toBe(2)
    for (const [, name, price] of offers) {
      expect(Number(price)).toBe(planAmountXOF(name.toLowerCase(), 'monthly'))
    }
    // Enterprise est sur devis : aucune Offer avec prix ne doit exister pour lui.
    expect(/"name":\s*"Enterprise"[\s\S]{0,120}?"price"/.test(html)).toBe(false)
  })

  it('… le scan sait mordre (contre-preuve, dans les deux sens)', () => {
    const sabotage = '      { name: "Starter", xof: 9900 },'
    expect(FORBIDDEN.some(n => new RegExp(`\\b${n}\\b`).test(sabotage))).toBe(true)
    const sain = '      xof: planAmountXOF(plan.id, period),'
    expect([...FORBIDDEN, ...CURRENT].some(n => new RegExp(`\\b${n}\\b`).test(sain))).toBe(false)
    // Et il ne se fait pas berner par un commentaire qui cite l'ancien prix.
    expect(stripped('/dev/null'.replace('/dev/null', TWIN_FRONT))).not.toContain('24900')
  })
})

describe('auto-exclusion : le verrou survit à son propre scan', () => {
  const SELF = join(SRC, 'tests', 'planCatalog.test.ts')
  it('ce fichier contient bien des montants interdits (sinon la preuve est vide)', () => {
    const self = readFileSync(SELF, 'utf8')
    expect(/\b24900\b/.test(self)).toBe(true)
    expect(/\b8000\b/.test(self)).toBe(true)
  })
  it("n'appartient PAS au corpus scanné", () => {
    expect(SELF).toContain('/src/tests/')
    expect(SELF.includes('/components/landing/')).toBe(false)
    expect(SELF.includes('/pages/')).toBe(false)
  })
})

describe('limites assumées', () => {
  it('les documente', () => {
    const LIMITES = [
      // 1 — `index.html` porte les prix en clair : son JSON-LD ne peut pas importer de
      //     module. L'alignement est vérifié par une assertion dédiée, pas par le scan.
      'json-ld-index-html-en-dur-mais-verifie',
      // 2 — Ce fichier juge la SOURCE et les constantes ; le RENDU est vérifié dans
      //     `planCatalogRender.test.tsx`.
      'rendu-verifie-ailleurs',
      // 3 — Un montant assemblé à l'exécution (8*1000) échapperait au scan.
      'montant-assemble-a-l-execution-non-vu',
      // 4 — La cohérence avec ce que le PRESTATAIRE prélève réellement n'est pas
      //     vérifiable ici : elle l'est côté backend, SDK mocké.
      'montant-preleve-cote-prestataire-non-verifiable-ici',
    ]
    expect(LIMITES).toHaveLength(4)
  })
})
