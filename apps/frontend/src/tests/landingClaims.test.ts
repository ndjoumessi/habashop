import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, resolve } from 'path'

/**
 * VERROU — affirmations invérifiables sur les surfaces publiques.
 *
 * Contexte (mesuré le 2026-08-06) : la production ne contenait aucune vente de marchand
 * réel — 1 926 des 1 983 ventes venaient des deux tenants de démonstration, 57 de
 * fixtures E2E. La vitrine affirmait pendant ce temps « N°1 en Afrique francophone »,
 * « 500+ Boutiques », « 4,9/5 », « SLA garanti 99,9 % », six compteurs de pays qui se
 * contredisaient, et trois temoignages attribues a des personnes nommees.
 *
 * Ce test relit les SOURCES publiques et échoue si l'une de ces familles revient.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS PROPRIÉTÉS EXIGÉES DU VERROU LUI-MÊME
 *
 * 1. ASSERTION DE COUVERTURE — `describe('couverture')`. Un scanneur dont le `walk()`
 *    casse rend une liste VIDE, donc un vert qui ne garde rien : c'est le motif du
 *    « mock qui ignore ses arguments ». On assert donc un nombre plancher de fichiers,
 *    un volume plancher de texte, ET des SENTINELLES — des chaînes qui doivent être
 *    présentes dans le corpus. Sans sentinelle, lire dix fichiers vides passerait.
 *
 * 2. IL SURVIT À SON PROPRE SCAN — `describe('auto-exclusion')`. Ce fichier contient en
 *    toutes lettres les motifs qu'il interdit (il faut bien les écrire). S'il se scannait
 *    lui-même il serait rouge en permanence, et un verrou qui crie au loup finit désarmé.
 *    La preuve n'est pas « on a mis les tests ailleurs » mais deux assertions : (a) ce
 *    fichier CONTIENT un motif interdit, (b) il n'appartient PAS au corpus scanné.
 *
 * 3. LIMITES CONNUES — voir `describe('limites assumées')` en fin de fichier, où elles
 *    sont écrites en clair plutôt qu'en commentaire, pour qu'on les relise.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SRC = resolve(__dirname, '..')
const FRONTEND = resolve(SRC, '..')

/** Répertoires dont TOUS les fichiers sont des surfaces publiques. */
const PUBLIC_DIRS = [join(SRC, 'components', 'landing')]

/** Surfaces publiques isolées (les autres pages sont derrière l'authentification). */
const PUBLIC_FILES = [
  join(SRC, 'pages', 'LandingPage.tsx'),
  join(SRC, 'pages', 'LoginPage.tsx'),
  join(SRC, 'pages', 'SignupPage.tsx'),
  join(SRC, 'pages', 'Pricing.tsx'),
  join(SRC, 'pages', 'Privacy.tsx'),
  join(FRONTEND, 'index.html'),
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(tsx?|html)$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Retire commentaires et imports AVANT de conclure.
 *
 * ⚠️ Sans ça le verrou serait inutilisable : les fichiers de la refonte citent les
 * affirmations retirées dans leurs commentaires, précisément pour expliquer pourquoi
 * elles sont parties. Un scanneur qui se fait piéger par un commentaire est un scanneur
 * qu'on finit par supprimer. C'est la convention déjà posée par `csvInjection.test.ts`,
 * et elle est exercée à l'envers plus bas (« un motif HORS commentaire est bien vu »).
 */
export function stripNonCopy(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, ' ')          // commentaires HTML
    .replace(/\/\*[\s\S]*?\*\//g, ' ')         // commentaires de bloc JS/CSS (et {/* … */})
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')     // commentaires de ligne (sans casser https://)
    .replace(/^\s*import[^\n]*$/gm, ' ')       // imports
}

interface Rule {
  key: string
  label: string
  /** Vrai si la LIGNE viole la règle. Une fonction, pas une regex : cf. `compteur`. */
  test: (line: string) => boolean
}

const re = (pattern: RegExp) => (line: string) => pattern.test(line)

/** Noms communs qui, associés à un nombre, font une revendication de taille. */
const COUNT_NOUN = /\b(boutiques?|shops?|stores?|tiendas?|negozi|pays|countries|pa[ií]ses|paesi)\b/i

/**
 * Texte RÉELLEMENT VISIBLE d'une ligne : les littéraux de chaîne, plus le texte JSX
 * laissé entre les balises et les accolades.
 *
 * ⚠️ Raisonner sur la ligne BRUTE ne marche pas — mesuré : `faq4_q`, `cta1`, `size={14}`
 * contiennent tous un chiffre qui n'est PAS une affirmation. Un scanneur qui compte les
 * chiffres des identifiants produit 19 faux positifs et se fait désactiver dans la semaine.
 */
export function copyTokens(line: string): string[] {
  const tokens: string[] = []
  const literal = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = literal.exec(line)) !== null) tokens.push(m[1] ?? m[2] ?? '')
  const jsxText = line
    .replace(literal, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/<[^<>]*>/g, ' ')
    .trim()
  if (jsxText) tokens.push(jsxText)
  return tokens
}

/** « 500+ », « 12 », « + 140 » : une quantité nue, sans autre mot. */
const BARE_QUANTITY = /^\s*\+?\s*\d[\d\s.,]*\+?\s*$/
/**
 * « 150+ pays », « 8+ pays africains », « + 140 autres pays » : quantité PROCHE du nom.
 * La tolérance de deux mots intercalés n'est pas cosmétique — « 140 autres pays » et
 * « 150 more countries » étaient la formulation réellement employée.
 */
const QUANTITY_THEN_NOUN = /\d[\d\s.,]*\+?\s*(?:[\p{L}']+\s+){0,2}(boutiques?|shops?|stores?|tiendas?|negozi|pays|countries|pa[ií]ses|paesi)\b/iu

/**
 * ⚠️ Le compteur ne peut PAS être une simple adjacence « nombre + nom ».
 * La contre-preuve l'a montré du premier coup : la violation d'origine s'écrivait
 *     { v: '500+', l: i('Boutiques', 'Shops', …) }
 * — le nombre et le nom vivent dans DEUX littéraux DISTINCTS, et une regex d'adjacence
 * passe à côté de l'affirmation qu'elle est censée interdire. Trois voies, donc :
 *   A. un littéral qui n'est QU'une quantité augmentée (« 500+ ») — ça ne veut rien dire
 *      d'autre que « plus de N de quelque chose », quelle que soit l'étiquette ;
 *   B. une quantité accolée au nom dans le même texte (« plus de 150 pays ») ;
 *   C. une quantité nue ET un nom, dans deux fragments de la MÊME ligne — le cas ci-dessus,
 *      et aussi « + 140 {i('autres pays', …)} », où le nombre est du texte JSX.
 */
const isCounter = (line: string): boolean => {
  const tokens = copyTokens(line)
  if (tokens.some(t => /^\s*\d[\d\s.,]*\+\s*$/.test(t))) return true            // A
  if (tokens.some(t => QUANTITY_THEN_NOUN.test(t))) return true                 // B
  const hasQuantity = tokens.some(t => BARE_QUANTITY.test(t))
  const hasNoun = tokens.some(t => COUNT_NOUN.test(t))
  return hasQuantity && hasNoun                                                 // C
}

/**
 * Familles interdites. Les motifs sont volontairement LARGES : sur une page publique,
 * un faux positif se corrige en reformulant, un faux négatif se publie.
 */
export const FORBIDDEN: Rule[] = [
  {
    key: 'superlatif',
    label: 'superlatif non étayé (n°1, leader, le meilleur, le plus populaire)',
    test: re(/\bn\s?[°º]\s?1\b|\bnumber one\b|\bleader\b|\bl[ea] meilleur\b|\bthe best\b|\ble plus populaire\b|\bmost popular\b|\bm[áa]s popular\b|\bpi[ùu] popolare\b/i),
  },
  {
    key: 'compteur',
    label: 'compteur de boutiques ou de pays',
    test: isCounter,
  },
  {
    key: 'note',
    label: 'note sur 5 / avis agrégés',
    test: re(/\b\d[.,]\d\s*\/\s*5\b|aggregateRating|ratingValue|reviewCount/i),
  },
  {
    key: 'sla',
    label: 'engagement de disponibilité (SLA)',
    test: re(/\bSLA\b/i),
  },
  {
    key: 'temoignage',
    label: 'bloc témoignage (structure ou personne nommée)',
    // On interdit l'ÉCHAFAUDAGE (le seul signal fiable côté source) plus les trois
    // personnes qui avaient été inventées. Cf. « limites assumées ».
    test: re(/t[eé]moignage|testimonial|test\d_(name|quote|role)|Mamadou\s+Diallo|Fatou\s+Kon[ée]|Ibrahim\s+Tour[ée]/i),
  },
]

function collectFiles(): string[] {
  const files = [...PUBLIC_FILES.filter(f => existsSync(f))]
  for (const dir of PUBLIC_DIRS) files.push(...walk(dir))
  return files
}

const FILES = collectFiles()
const CORPUS = FILES.map(f => ({ file: f, copy: stripNonCopy(readFileSync(f, 'utf8')) }))

/** Toutes les violations, fichier par fichier, avec la ligne fautive. */
function violations(rule: Rule): string[] {
  const hits: string[] = []
  for (const { file, copy } of CORPUS) {
    copy.split('\n').forEach((line, idx) => {
      if (rule.test(line)) hits.push(`${file.replace(FRONTEND + '/', '')}:${idx + 1} → ${line.trim().slice(0, 120)}`)
    })
  }
  return hits
}

describe('couverture du scan (sans ça, un walk cassé passerait au vert)', () => {
  it('lit les surfaces publiques attendues', () => {
    // 10 composants de landing + 5 pages + index.html au moment de l'écriture.
    expect(FILES.length).toBeGreaterThanOrEqual(14)
    for (const f of PUBLIC_FILES) expect(FILES).toContain(f)
  })

  it('lit du texte, pas des fichiers vides', () => {
    const chars = CORPUS.reduce((n, c) => n + c.copy.length, 0)
    expect(chars).toBeGreaterThan(40_000)
    for (const { file, copy } of CORPUS) {
      expect(copy.length, `fichier vide après nettoyage : ${file}`).toBeGreaterThan(200)
    }
  })

  it('trouve des SENTINELLES du contenu réel (le corpus est bien la vitrine courante)', () => {
    const all = CORPUS.map(c => c.copy).join('\n')
    // Le H1 de la refonte, le badge de recommandation, le JSON-LD — et la preuve que la
    // grille tarifaire est bien branchée sur le CATALOGUE partagé.
    // ⚠️ La sentinelle était `starter: 8000`, qui vivait dans `landingShared.ts` : elle a
    // sauté quand la grille a migré vers `lib/plans.ts`. Une sentinelle doit désigner
    // quelque chose de STABLE du corpus, pas une valeur qu'on prévoit de déplacer.
    // ⚠️ Une sentinelle doit désigner du CONTENU, pas un import : `stripNonCopy` retire
    // justement les imports (première tentative : `from '@/lib/plans'`, invisible).
    expect(all).toContain("réseau s'arrête")
    expect(all).toContain('Recommandé')
    expect(all).toContain('Des prix en Franc CFA')
    expect(all).toContain('FAQPage')
  })
})

describe('affirmations interdites sur les surfaces publiques', () => {
  for (const rule of FORBIDDEN) {
    it(`aucun ${rule.label}`, () => {
      expect(violations(rule), `${rule.key} — occurrences trouvées`).toEqual([])
    })
  }
})

describe('contre-preuve : les règles détectent bien ce qu’elles prétendent', () => {
  const fire = (rule: string, text: string) =>
    FORBIDDEN.find(r => r.key === rule)!.test(stripNonCopy(text))

  it('détecte les superlatifs', () => {
    expect(fire('superlatif', "badge: 'N°1 en Afrique francophone'")).toBe(true)
    expect(fire('superlatif', "tag: 'LE PLUS POPULAIRE'")).toBe(true)
    expect(fire('superlatif', "t: 'Nous sommes leader du marché'")).toBe(true)
    expect(fire('superlatif', "sub: 'Pour les commerces en croissance'")).toBe(false)
  })

  it('détecte les compteurs de boutiques et de pays', () => {
    expect(fire('compteur', "{ v: '500+', l: 'Boutiques' }")).toBe(true)
    expect(fire('compteur', "trust: 'et 8+ pays africains'")).toBe(true)
    expect(fire('compteur', "'+ 140 autres pays'")).toBe(true)
    expect(fire('compteur', "proof: '150+ countries'")).toBe(true)
    expect(fire('compteur', "{ v: '12', l: i('Pays', 'Countries', 'Países', 'Paesi') }")).toBe(true)
    expect(fire('compteur', "+ 140 {i('autres pays', 'more countries', 'otros países', 'altri paesi')}")).toBe(true)
    // Ne doit PAS mordre sur les limites de plan, la maquette produit, ni les CHIFFRES
    // D'IDENTIFIANT (`faq4_q`, `cta1`, `size={14}`) — 19 faux positifs mesurés sans ça.
    expect(fire('compteur', "feat: 'Stock · 500 produits'")).toBe(false)
    expect(fire('compteur', "demo: '3 ventes en attente de synchro'")).toBe(false)
    expect(fire('compteur', "faq4_q: 'Puis-je gérer plusieurs boutiques ?',")).toBe(false)
    expect(fire('compteur', "cta1: 'Créer ma boutique',")).toBe(false)
    expect(fire('compteur', '<Store size={14} strokeWidth={2} color="var(--text3)" />')).toBe(false)
    expect(fire('compteur', 'content="… pour les boutiques et superettes d\'Afrique. Essai gratuit 14 jours."')).toBe(false)
  })

  it('détecte les notes sur 5 et les avis agrégés', () => {
    expect(fire('note', "<strong>4,9/5</strong>")).toBe(true)
    expect(fire('note', '"aggregateRating": { "ratingValue": "4.8" }')).toBe(true)
    expect(fire('note', "parité fixe 655,957")).toBe(false)
  })

  it('détecte les engagements de disponibilité', () => {
    expect(fire('sla', "feat_sla: 'SLA garanti 99,9 %'")).toBe(true)
    expect(fire('sla', "feat: 'Accompagnement au démarrage'")).toBe(false)
  })

  it('détecte les blocs témoignage et les personnes nommées', () => {
    expect(fire('temoignage', "test1_name: 'Mamadou Diallo'")).toBe(true)
    expect(fire('temoignage', "testimonials_label: 'TÉMOIGNAGES'")).toBe(true)
    expect(fire('temoignage', "role: 'Épicerie · Abidjan'")).toBe(false)
  })

  it('ignore un motif interdit placé DANS un commentaire, mais pas hors commentaire', () => {
    const enCommentaire = "// on a retiré « 500+ Boutiques » le 2026-08-06\nconst x = 1"
    const horsCommentaire = "const badge = '500+ Boutiques'"
    const compteur = FORBIDDEN.find(r => r.key === 'compteur')!.test
    expect(compteur(stripNonCopy(enCommentaire))).toBe(false)
    expect(compteur(stripNonCopy(horsCommentaire))).toBe(true)
  })

  it('ne casse pas les URL en retirant les commentaires de ligne', () => {
    expect(stripNonCopy("const u = 'https://habashop.vercel.app'")).toContain('https://habashop.vercel.app')
  })
})

describe('auto-exclusion : le scanneur survit à son propre scan', () => {
  const SELF = join(SRC, 'tests', 'landingClaims.test.ts')

  it('ce fichier contient bien des motifs interdits (sinon la preuve suivante est vide)', () => {
    const self = readFileSync(SELF, 'utf8')
    const fired = FORBIDDEN.filter(r => r.test(self)).map(r => r.key)
    // Les cinq familles sont citées en toutes lettres dans les contre-preuves ci-dessus.
    expect(fired.sort()).toEqual(['compteur', 'note', 'sla', 'superlatif', 'temoignage'])
  })

  it("n'est PAS dans le corpus scanné — il serait rouge en permanence", () => {
    expect(FILES).not.toContain(SELF)
    expect(FILES.some(f => f.includes(`${'src'}/tests/`))).toBe(false)
  })
})

describe('limites assumées (à relire avant de faire confiance à ce verrou)', () => {
  it('les documente', () => {
    const LIMITES = [
      // 1 — Portée. Seules les surfaces PUBLIQUES sont scannées. Une affirmation fausse
      //     ajoutée dans un écran authentifié (Réglages, Abonnements, e-mails du backend,
      //     `mobile/`) n'est pas vue ici.
      'perimetre-pages-publiques-uniquement',
      // 2 — Une personne nommée n'est PAS détectable en général. On interdit
      //     l'échafaudage (« témoignage », « testimonial », `testN_name`) et les trois
      //     noms inventés. Un nouveau témoignage écrit sans ce vocabulaire passerait.
      'personne-nommee-non-detectable-en-general',
      // 3 — Le verrou juge la SOURCE, pas le RENDU. Une chaîne assemblée à l'exécution
      //     (`${n}+ pays`) échappe au motif. Même limite que tout test qui grep du source.
      'chaine-assemblee-a-l-execution-non-vue',
      // 4 — Il ne dit RIEN de la véracité d'une affirmation qui ne tombe dans aucune des
      //     cinq familles. « Import CSV » et « offline sur le web » étaient faux sans
      //     être ni superlatifs, ni chiffrés : c'est une relecture qui les a trouvés.
      'verite-hors-des-cinq-familles-non-couverte',
      // 5 — Les images (og-image.webp, captures) ne sont pas inspectées.
      'contenu-des-images-non-inspecte',
    ]
    expect(LIMITES).toHaveLength(5)
  })
})
