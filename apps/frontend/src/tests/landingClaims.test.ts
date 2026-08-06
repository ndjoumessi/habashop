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
const APP = join(SRC, 'App.tsx')

/**
 * ⚠️ LE PÉRIMÈTRE EST DÉRIVÉ, PLUS ÉCRIT À LA MAIN — et c'est la leçon la plus chère de
 * ce chantier.
 *
 * La version précédente scannait `components/landing/` plus cinq fichiers listés en dur.
 * `components/signup/` n'y a JAMAIS figuré. Résultat : le verrou était vert, ses huit
 * sabotages rougissaient correctement, son assertion de couverture affirmait lire 14
 * fichiers — et un QUATRIÈME témoignage fabriqué (« Aminata Koné · Superette Dakar »)
 * était en ligne sur /signup, avec « 500+ boutiques » et « 12 pays ».
 *
 *   Une assertion de couverture prouve qu'on a lu N fichiers.
 *   Elle ne prouve pas que N était le bon N.
 *   Un périmètre faux passe tous les contrôles de PROFONDEUR.
 *
 * Le corpus se calcule donc en deux temps :
 *   1. les routes PUBLIQUES sont extraites d'`App.tsx` — celles de premier niveau dont
 *      l'élément ne passe par aucun composant de garde ;
 *   2. on suit les imports TRANSITIVEMENT depuis chaque composant de route.
 * Une page publique ajoutée demain entre d'elle-même dans le corpus. C'est la seule
 * construction qui aurait attrapé le défaut ci-dessus.
 */

/** Composants qui rendent une route NON publique. */
const GUARDS = /Protected|AdminOnly|RoleRoute|PlatformAdmin/

export interface PublicRoute { path: string; component: string }

/**
 * Routes publiques déclarées par `App.tsx`.
 * On ne lit que les `<Route …/>` de PREMIER niveau : tout ce qui est imbriqué sous
 * `/app` est derrière `ProtectedRoute` par construction.
 */
export function publicRoutes(source = readFileSync(APP, 'utf8')): PublicRoute[] {
  const block = source.slice(source.indexOf('<Routes>'), source.indexOf('</Routes>'))
  const out: PublicRoute[] = []
  for (const line of block.split('\n')) {
    // Premier niveau = 6 espaces d'indentation, et balise auto-fermante sur la ligne.
    const m = /^ {6}<Route\s+path="([^"]+)"\s+element=\{<(\w+)\s*\/>\}\s*\/>/.exec(line)
    if (!m) continue
    if (GUARDS.test(m[2])) continue
    out.push({ path: m[1], component: m[2] })
  }
  return out
}

/** Fichier source d'un composant de route (import statique OU `lazy(() => import(…))`). */
export function componentFile(name: string, source = readFileSync(APP, 'utf8')): string | null {
  const lazyRe = new RegExp(`const\\s+${name}\\s*=\\s*lazy\\(\\s*\\(\\)\\s*=>\\s*import\\(['"]([^'"]+)['"]\\)`)
  const staticRe = new RegExp(`import\\s+${name}\\s+from\\s+['"]([^'"]+)['"]`)
  const spec = (lazyRe.exec(source) ?? staticRe.exec(source))?.[1]
  return spec ? resolveSpec(spec, APP) : null
}

/** Résout un spécifieur d'import vers un fichier de `src/`, ou `null` (paquet externe). */
function resolveSpec(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(fromFile, '..', spec)
  else return null                                  // dépendance npm : hors périmètre
  for (const cand of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return null
}

/** Tous les imports résolus d'un fichier (statiques et dynamiques). */
function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const specs = [
    ...[...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]),
    ...[...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]),
  ]
  return specs.map(sp => resolveSpec(sp, file)).filter((f): f is string => f !== null)
}

/** Fermeture transitive des imports depuis les composants de route publics. */
export function publicCorpusFiles(): { files: string[]; byRoute: Record<string, string | null> } {
  const byRoute: Record<string, string | null> = {}
  const seen = new Set<string>()
  const queue: string[] = []
  for (const r of publicRoutes()) {
    const f = componentFile(r.component)
    byRoute[r.path] = f
    if (f && !seen.has(f)) { seen.add(f); queue.push(f) }
  }
  while (queue.length) {
    const f = queue.shift()!
    for (const dep of importsOf(f)) {
      if (!seen.has(dep)) { seen.add(dep); queue.push(dep) }
    }
  }
  return { files: [...seen], byRoute }
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

/**
 * `index.html` est ajouté explicitement : il porte les métadonnées et le JSON-LD, et
 * aucun import ne mène à lui. C'est la SEULE entrée écrite à la main, et elle est nommée.
 */
const { files: GRAPH_FILES, byRoute: ROUTE_FILE } = publicCorpusFiles()
const FILES = [...GRAPH_FILES, join(FRONTEND, 'index.html')].filter(existsSync)
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
  it('le périmètre est DÉRIVÉ des routes publiques d’App.tsx', () => {
    const routes = publicRoutes()
    // Le parseur voit-il quelque chose de plausible ? (sinon il « couvrirait » zéro route)
    expect(routes.length, 'aucune route publique détectée : le parseur est cassé').toBeGreaterThanOrEqual(6)
    const paths = routes.map(r => r.path)
    expect(paths).toContain('/')
    expect(paths).toContain('/signup')
    // …et exclut-il bien le protégé ? Une liste qui contiendrait /app ne prouverait rien.
    expect(paths).not.toContain('/app')
    expect(paths).not.toContain('/admin')
    expect(paths).not.toContain('/select-shop')
  })

  /**
   * ⚠️ L'ASSERTION QUI AURAIT ATTRAPÉ LE DÉFAUT.
   * `/signup` était déclaré public dans App.tsx et aucun de ses fichiers n'entrait dans
   * le corpus : le verrou lisait 14 fichiers, tous les mauvais pour cette page.
   */
  it('CHAQUE route publique contribue au corpus', () => {
    for (const [path, file] of Object.entries(ROUTE_FILE)) {
      expect(file, `route publique ${path} : composant introuvable dans App.tsx`).not.toBeNull()
      expect(FILES, `route publique ${path} : aucun fichier dans le corpus`).toContain(file)
    }
  })

  it('le graphe descend dans les COMPOSANTS des pages, pas seulement les pages', () => {
    // Contre-preuve de profondeur : ces fichiers ne sont atteignables que transitivement.
    for (const rel of [
      'components/landing/LandingPricing.tsx',
      'components/signup/SignupBranding.tsx',   // ← absent du périmètre écrit à la main
      'lib/plans.ts',
    ]) {
      expect(FILES, `${rel} hors corpus`).toContain(join(SRC, rel))
    }
    expect(FILES.length).toBeGreaterThanOrEqual(20)
  })

  it('lit du texte, pas des fichiers vides', () => {
    const chars = CORPUS.reduce((n, c) => n + c.copy.length, 0)
    expect(chars).toBeGreaterThan(40_000)
    // ⚠️ Seuil par fichier ABAISSÉ à 40 : le corpus dérivé contient désormais de petits
    // modules légitimes (`lib/publicYear.ts` fait 196 caractères une fois les commentaires
    // retirés). Ce que l'assertion garde, c'est qu'aucun fichier ne soit VIDE — un lecteur
    // cassé rendrait des chaînes nulles ; le volume global (40 000) porte le reste.
    for (const { file, copy } of CORPUS) {
      expect(copy.length, `fichier vide après nettoyage : ${file}`).toBeGreaterThan(40)
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

/**
 * MÉTA-RÈGLE — aucun CTA de soumission désactivé sur une route publique.
 *
 * Un bouton `disabled` est un contrôle SANS CONTRASTE : il gronde avant toute erreur, ne
 * dit pas ce qui manque, et n'affiche aucune infobulle au toucher — donc sur mobile il
 * n'explique rien du tout. `/signup` en portait un, libellé « Remplissez tous les champs ».
 *
 * ⚠️ Elle réutilise le GRAPHE de routes publiques déjà calculé plus haut : pas de seconde
 * liste à maintenir. Une page publique ajoutée demain y entre d'elle-même.
 *
 * ─── RAPPORT AVEC `signup.anchor.test.tsx` : ils se COMPLÈTENT, ils ne se recouvrent pas ───
 * Celui-ci lit la SOURCE de toutes les pages publiques et interdit la construction.
 * `signup.anchor.test.tsx` MONTE le composant et prouve le comportement voulu : un clic à
 * vide nomme les champs manquants et n'avance pas. L'un empêche la régression partout,
 * l'autre prouve que le remplacement fonctionne ici. C'est le couple source/comportement
 * déjà employé pour l'injection CSV (`csvInjection` + `csvInjectionBehaviour`).
 * Ne pas supprimer l'un en croyant que l'autre couvre : le méta-test ne clique sur rien,
 * l'ancre ne voit qu'une page.
 */
describe('aucun CTA de soumission désactivé sur une surface publique', () => {
  /** Fichiers du corpus qui contiennent un bouton (les seuls à examiner). */
  const withButtons = CORPUS.filter(c => /<button/i.test(c.copy))

  it('des boutons existent dans le corpus (sinon la règle ne garde rien)', () => {
    expect(withButtons.length, 'aucun <button> trouvé : le corpus ou le filtre est cassé').toBeGreaterThanOrEqual(5)
  })

  /**
   * ⚠️ TOUT `disabled` n'est pas le défaut. Désactiver un bouton PENDANT une requête est
   * correct — c'est ce qui empêche la double soumission, et l'état dure une seconde. Le
   * défaut visé est la désactivation par la VALIDATION : un bouton éteint tant que le
   * formulaire est incomplet, qui n'explique rien et gronde avant toute erreur.
   * Sont donc ignorés : les drapeaux de requête en vol, les sélecteurs CSS `:disabled`,
   * et les déclarations de type (`disabled: boolean`).
   */
  const IN_FLIGHT = /^!?\s*(loading|busy|saving|submitting|pending|isSaving|isLoading)\b/
  function offendingDisabled(line: string): boolean {
    if (!/\bdisabled\b/.test(line)) return false
    if (/:disabled|:not\(:disabled\)/.test(line)) return false          // CSS
    if (/disabled\s*:\s*boolean/.test(line)) return false               // type
    if (/^\s*(export default )?function .*\bdisabled\b/.test(line)) return false  // destructuration
    // Les champs de saisie ne sont pas des CTA : un `<input disabled>` est une donnée
    // non modifiable, pas un bouton qui refuse d'être cliqué.
    if (/<(input|select|textarea)\b/.test(line)) return false
    const expr = /disabled=\{([^}]*)\}/.exec(line)?.[1]?.trim()
    if (expr === undefined) return false
    if (IN_FLIGHT.test(expr)) return false                              // requête en vol
    // Simple RELAIS de prop (`disabled={disabled}`) : la décision appartient à l'appelant,
    // et l'appelant est lui-même dans le corpus, donc lui-même scanné. Exempter ici ne
    // crée pas de trou — le déplacer, oui, et c'est ce que la règle vérifie chez lui.
    if (expr === 'disabled') return false
    return true
  }

  it('aucun CTA désactivé par la VALIDATION sur une route publique', () => {
    const hits: string[] = []
    for (const { file, copy } of withButtons) {
      copy.split('\n').forEach((line, idx) => {
        if (offendingDisabled(line)) hits.push(`${file.replace(FRONTEND + '/', '')}:${idx + 1} → ${line.trim().slice(0, 100)}`)
      })
    }
    expect(hits, 'CTA désactivé par la validation sur une surface publique').toEqual([])
  })

  it('… et la règle distingue bien les deux cas (contre-preuve, dans les deux sens)', () => {
    // Interdit : désactivation par la validation.
    expect(offendingDisabled('  <button type="button" disabled={!step1Valid} onClick={onNext}>')).toBe(true)
    expect(offendingDisabled('  <button disabled={!canSubmit}>')).toBe(true)
    // Autorisé : requête en vol, CSS, type, bouton sain.
    expect(offendingDisabled('  <button onClick={next} disabled={loading}>')).toBe(false)
    expect(offendingDisabled('  <button disabled={isSaving}>')).toBe(false)
    expect(offendingDisabled('  .login-cta:disabled { opacity: .5 }')).toBe(false)
    expect(offendingDisabled('  disabled: boolean')).toBe(false)
    expect(offendingDisabled('  <button type="button" onClick={handleNext}>')).toBe(false)
    expect(offendingDisabled('  <button disabled={disabled}>')).toBe(false)      // relais
    expect(offendingDisabled('  <input disabled={!editable} />')).toBe(false)    // champ
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
      // 6 — La règle « aucun CTA désactivé » voit le jeton `disabled` dans la source :
      //     l'attribut littéral et les props booléennes évidentes. Elle NE voit PAS une
      //     désactivation calculée à plusieurs niveaux d'indirection — un composant maison
      //     qui recevrait `inactive` et poserait `disabled` en interne, un `pointerEvents:
      //     none`, un `aria-disabled`, ou un handler qui ne fait rien. Le comportement
      //     réel de /signup est prouvé ailleurs, par `signup.anchor.test.tsx`.
      'cta-desactive-detecte-par-le-jeton-disabled-pas-par-indirection',
    ]
    expect(LIMITES).toHaveLength(6)
  })
})
