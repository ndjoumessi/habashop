import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, resolve, relative } from 'path'
import { PLANS, planAmountXOF } from '@/lib/plans'

/**
 * VERROU — aucun montant de plan écrit à la main, NULLE PART.
 *
 * ─── POURQUOI CELUI-CI REMPLACE LE PRÉCÉDENT ─────────────────────────────────
 * Le bloc « aucun littéral de prix hors de la source unique » de `planCatalog.test.ts`
 * était vert et ne gardait rien. Deux défauts INDÉPENDANTS, chacun suffisant :
 *
 *  1. LA FORME. Il cherchait `\b8000\b`. Toute chaîne destinée à un humain écrit
 *     « 8 000 » — séparateur de milliers — et la version anglaise « 8,000 ». Le motif
 *     recherché n'apparaissait donc dans AUCUNE copie : zéro correspondance possible,
 *     vert garanti. C'est le même aveuglement que le méta-test qui figeait un libellé
 *     sans jamais exercer le rendu.
 *
 *  2. LE PÉRIMÈTRE. `FILES` était une liste ÉCRITE À LA MAIN — la construction que
 *     `landingClaims.test.ts` avait justement abandonnée trois heures plus tôt, après
 *     qu'un périmètre listé eut laissé un quatrième témoignage fabriqué en ligne. Elle
 *     omettait `components/signup/` (le répertoire déjà oublié la fois d'avant) et tout
 *     le backend — où `services/email.ts` envoyait « 24 900 F CFA/mois », le prix d'une
 *     grille disparue, à chaque relance d'essai.
 *
 * ─── CE QUI CHANGE ───────────────────────────────────────────────────────────
 * Plus de liste, plus de graphe : on marche sur TOUT le code de production des trois
 * cibles (web, API, mobile) et on ne juge pas « le nombre 8000 » mais **un nombre
 * PRÉSENTÉ COMME DE L'ARGENT** — collé à un marqueur monétaire ou à une clé du catalogue.
 * Le critère est assez spécifique pour ne pas mordre sur `setTimeout(8000)` : MESURÉ,
 * 35 occurrences sur 425 fichiers de production.
 */

const SRC = resolve(__dirname, '..')
const ROOT = resolve(SRC, '..', '..', '..')

/** Cibles marchées. Aucune n'est un fichier : ce sont des racines, pas une liste. */
const ROOTS = ['apps/frontend/src', 'apps/backend/src', 'mobile/src', 'mobile/app']
  .map(r => join(ROOT, r)).filter(existsSync)

/** Le code de PRODUCTION seul : les tests ne sont pas livrés. */
const SKIP_DIR = /(^|\/)(tests?|__tests__|e2e|node_modules|dist|fixtures)(\/|$)/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (SKIP_DIR.test(full)) return []
    if (statSync(full).isDirectory()) return walk(full)
    return /\.tsx?$/.test(entry) && !/\.test\./.test(entry) ? [full] : []
  })
}

const HTML = join(ROOT, 'apps/frontend/index.html')
const FILES = [...ROOTS.flatMap(walk), HTML]

/** Commentaires et imports retirés : ils citent les anciens prix pour les expliquer. */
const production = (p: string): string => readFileSync(p, 'utf8')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  .replace(/^\s*import[^\n]*$/gm, ' ')

/**
 * ⚠️ ON NORMALISE AVANT DE CHERCHER, JAMAIS L'INVERSE.
 * QUATRE séparateurs de milliers coexistent dans le dépôt, tous MESURÉS :
 *   U+0020 espace nue           — `landingShared.ts`, `signupShared.tsx`
 *   U+202F espace fine insécable — `toLocaleString('fr-FR')`, déjà connu via `adminXof`
 *   U+00A0 espace insécable      — gabarits HTML des e-mails
 *   U+002C virgule               — `toLocaleString('en-US')`, « 8,000 CFA »
 */
const SEPARATORS = /[\s\u202f\u00a0,]/g
const digits = (raw: string): number => Number(raw.replace(SEPARATORS, ''))

/** Un nombre groupé, quel que soit le séparateur. `(?<![\w.])` écarte `mixedAmt2XOF`. */
const GROUPED = String.raw`\d{1,3}(?:[\s\u202f\u00a0,]\d{3})+|\d+`
const MONEY_RULES: { key: string; re: RegExp; group: number }[] = [
  { key: 'marqueur-devise', re: new RegExp(String.raw`(?<![\w.])(${GROUPED})\s*(?:F\s*CFA|FCFA|CFA|XOF|XAF)\b`, 'gi'), group: 1 },
  { key: 'json-ld-price',   re: /"price"\s*:\s*"(\d+)"/g, group: 1 },
  { key: 'cle-catalogue',   re: /\b(?:monthly|yearly)\s*:\s*(\d{3,})\b/g, group: 1 },
]

interface Hit { file: string; line: number; amount: number; text: string; key: string }

function moneyHits(file: string): Hit[] {
  const src = production(file)
  const out: Hit[] = []
  for (const { key, re, group } of MONEY_RULES) {
    for (const m of src.matchAll(re)) {
      const amount = digits(m[group])
      if (!Number.isFinite(amount)) continue
      out.push({
        file: relative(ROOT, file),
        line: src.slice(0, m.index).split('\n').length,
        amount, text: m[0].trim(), key,
      })
    }
  }
  return out
}

/**
 * DEUX exemptions, NOMMÉES — et il n'y en a pas une de plus.
 *
 *  • `lib/plans.ts` (les deux jumeaux) EST la source. Lui interdire les montants
 *    reviendrait à interdire au catalogue de contenir des prix.
 *  • `index.html` porte son JSON-LD en clair : aucun `<script type="application/ld+json">`
 *    ne peut importer un module. Son alignement est vérifié séparément, pas exempté.
 */
const isSource = (f: string) => /^apps\/(frontend|backend)\/src\/lib\/plans\.ts$/.test(f)
const isHtml   = (f: string) => f === 'apps/frontend/index.html'

const ALL_HITS = FILES.flatMap(moneyHits)

describe('couverture (un walk cassé rendrait ce test vert et vide)', () => {
  it('les trois cibles sont marchées, et le corpus est large', () => {
    expect(ROOTS.length, 'une racine a disparu').toBe(4)
    expect(FILES.length).toBeGreaterThanOrEqual(300)
    for (const f of FILES) expect(production(f).length, f).toBeGreaterThan(0)
  })

  it('le corpus couvre les TROIS cibles, pas seulement le frontend', () => {
    const covered = (p: string) => FILES.some(f => relative(ROOT, f).startsWith(p))
    // ⚠️ C'est la frontière que le verrou précédent n'a jamais franchie.
    expect(covered('apps/backend/src'), 'backend hors périmètre').toBe(true)
    expect(covered('mobile/src'), 'mobile hors périmètre').toBe(true)
    expect(covered('apps/frontend/src'), 'frontend hors périmètre').toBe(true)
  })

  it('des montants SONT trouvés (sinon toutes les règles sont vacantes)', () => {
    expect(ALL_HITS.length, 'aucun montant : le détecteur ne détecte rien').toBeGreaterThanOrEqual(8)
    expect(ALL_HITS.some(h => isSource(h.file)), 'le catalogue lui-même n’est pas vu').toBe(true)
  })

  it('le détecteur voit les QUATRE séparateurs, pas seulement les chiffres collés', () => {
    // ⚠️ Construites par POINT DE CODE, pas tapées : un éditeur qui normalise les espaces
    // rendrait ce cas vert pour la mauvaise raison (et eslint interdit l'espace irrégulier
    // en littéral — l'interdiction est saine, elle ne doit pas coûter la couverture).
    const formes = ['8000 XOF', '8 000 F CFA', `8\u202f000 F CFA`, `8\u00a0000 FCFA`, '8,000 CFA']
    for (const f of formes) {
      const m = MONEY_RULES[0].re.exec(f)
      MONEY_RULES[0].re.lastIndex = 0
      expect(m, `forme non vue : ${JSON.stringify(f)}`).not.toBeNull()
      expect(digits(m![1]), f).toBe(8000)
    }
  })
})

describe('aucun montant de plan écrit à la main', () => {
  const CATALOG = new Set(
    PLANS.flatMap(p => [p.monthly, p.yearly]).filter((n): n is number => typeof n === 'number'),
  )

  it('hors du catalogue et du JSON-LD, AUCUN montant de plan n’apparaît en clair', () => {
    const faute = ALL_HITS
      .filter(h => !isSource(h.file) && !isHtml(h.file))
      .filter(h => CATALOG.has(h.amount))
      .map(h => `${h.file}:${h.line} → ${h.amount} (${h.key}) ${JSON.stringify(h.text)}`)
    expect(faute).toEqual([])
  })

  it('AUCUN prix d’une grille abandonnée, où que ce soit', () => {
    const OLD = new Set([9900, 24900, 49900, 249000, 499000, 14400, 34750])
    const faute = ALL_HITS
      .filter(h => OLD.has(h.amount))
      .map(h => `${h.file}:${h.line} → ${h.amount} ${JSON.stringify(h.text)}`)
    expect(faute).toEqual([])
  })

  it('le JSON-LD d’index.html reste ALIGNÉ sur le catalogue', () => {
    const html = readFileSync(HTML, 'utf8')
    const offers = [...html.matchAll(/"name":\s*"(Starter|Business)"[\s\S]{0,120}?"price":\s*"(\d+)"/g)]
    expect(offers.length, 'offres Starter/Business absentes du JSON-LD').toBe(2)
    for (const [, name, price] of offers) {
      expect(Number(price), name).toBe(planAmountXOF(name.toLowerCase(), 'monthly'))
    }
    expect(/"name":\s*"Enterprise"[\s\S]{0,120}?"price"/.test(html), 'Enterprise est sur devis').toBe(false)
  })

  it('… et le texte visible d’index.html cite les mêmes montants que le catalogue', () => {
    // La FAQ de la page est du HTML nu, hors JSON-LD : elle passe par le même contrôle.
    const cités = moneyHits(HTML).filter(h => h.key === 'marqueur-devise').map(h => h.amount)
    expect(cités.length).toBeGreaterThanOrEqual(2)
    for (const n of cités) expect(CATALOG.has(n), `montant hors catalogue : ${n}`).toBe(true)
  })
})

/**
 * ⚠️ RÈGLE DE SABOTAGE — la forme est COPIÉE depuis un fichier de production, jamais
 * retapée. Un sabotage écrit de mémoire hérite des hypothèses du détecteur, et les deux
 * tombent ensemble : c'est très exactement ce qui a laissé le verrou précédent vert
 * pendant qu'il cherchait un motif que personne n'écrivait.
 */
describe('le scan mord — contre-épreuve à la forme COPIÉE', () => {
  /** Le séparateur réellement présent dans une chaîne visible du dépôt. */
  const separateurReel = (): string => {
    const src = readFileSync(join(ROOT, 'apps/frontend/index.html'), 'utf8')
    const m = /8(.)000\s*F\s*CFA/.exec(src)
    expect(m, 'aucune chaîne « 8?000 F CFA » à copier dans index.html').not.toBeNull()
    return m![1]
  }

  it('la forme copiée est bien un séparateur, pas un chiffre', () => {
    const sep = separateurReel()
    expect(sep, `séparateur inattendu U+${sep.codePointAt(0)!.toString(16)}`).toMatch(/[\s\u202f\u00a0]/)
  })

  it('un littéral à la forme RÉELLE du dépôt est détecté', () => {
    const sabotage = `    pay_body: 'Starter 8${separateurReel()}000 F CFA par mois',`
    const m = MONEY_RULES[0].re.exec(sabotage)
    MONEY_RULES[0].re.lastIndex = 0
    expect(m, 'le sabotage à la forme réelle passe au travers').not.toBeNull()
    expect(digits(m![1])).toBe(8000)
  })

  it('l’ANCIEN motif `\\b8000\\b` ne l’aurait PAS vu — la preuve du défaut', () => {
    const sabotage = `Starter 8${separateurReel()}000 F CFA par mois`
    expect(/\b8000\b/.test(sabotage), 'l’ancien motif mordait : le diagnostic est faux').toBe(false)
    expect(MONEY_RULES[0].re.test(sabotage)).toBe(true)
    MONEY_RULES[0].re.lastIndex = 0
  })

  it('… et il ne mord pas sur ce qui n’est pas de l’argent', () => {
    for (const sain of ['setTimeout(fn, 8000)', 'const mixedAmt2XOF = 0', 'width: 25000']) {
      for (const { re } of MONEY_RULES) { expect(re.test(sain), sain).toBe(false); re.lastIndex = 0 }
    }
  })
})

describe('limites assumées', () => {
  it('les documente', () => {
    const LIMITES = [
      // 1 — Un montant assemblé à l'exécution (`8 * 1000`, concaténation de fragments)
      //     échappe au scan : on lit du texte, pas une sémantique.
      'montant-assemble-a-l-execution-non-vu',
      // 2 — Le scan ignore les tests et les fixtures : ils ne sont pas livrés. Un prix
      //     faux dans un test reste possible, et resterait sans effet en production.
      'tests-et-fixtures-hors-perimetre-volontairement',
      // 3 — `index.html` est vérifié par alignement, pas par interdiction : son JSON-LD
      //     ne peut pas importer de module. C'est la seule surface où un littéral vit.
      'json-ld-verifie-par-alignement-pas-interdit',
      // 4 — Ce que le PRESTATAIRE prélève réellement n'est pas vérifiable ici.
      'montant-preleve-cote-prestataire-non-verifiable-ici',
    ]
    expect(LIMITES).toHaveLength(4)
  })
})
