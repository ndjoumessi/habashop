/**
 * MOTEUR — quels jetons de classe du code ATTEIGNABLE n'existent pas dans l'artefact LIVRÉ.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * Tailwind est configuré dans ce dépôt (`tailwind.config.js`, `postcss.config.js`) mais
 * **n'émet RIEN** : `index.css` ne porte aucune directive `@tailwind`. Toute classe
 * utilitaire écrite dans un `className` est donc MORTE tant qu'elle n'est pas écrite à la
 * main dans `index.css` — et rien ne le signale. MESURÉ le 2026-08-06 sur le CSS livré :
 * 0 occurrence de `lg\:grid-cols`, 0 de `grid-cols-1`. `grid grid-cols-2 lg:grid-cols-4`
 * rendait donc 2 colonnes à toute largeur, jamais 4.
 *
 * C'est la famille « LA SOURCE EST VALIDE, L'ARTEFACT EST NUL » : ni tsc, ni la suite, ni
 * la revue ne regardent le produit. D'où une vérification sur `dist/`, comme
 * `verify:sw-routes` et `verify:seo-urls`.
 *
 * ─── CORPUS = TOUT `dist/`, JS COMPRIS ───────────────────────────────────────
 * ⚠️ Ne PAS se limiter à `dist/assets/*.css`. Les blocs `<style>{`…`}</style>` (LoginPage,
 * SubscriptionModal, la landing…) sont compilés dans le **bundle JS** et injectés à
 * l'exécution. En lisant les seuls fichiers `.css`, l'audit a compté 89 jetons absents ;
 * en élargissant au JS livré il en restait 44. Un corpus trop étroit rend un chiffre faux
 * avec l'air d'un fait.
 *
 * ─── LIMITES CONNUES — ce que cette extraction NE VOIT PAS ───────────────────
 * Elles sont écrites ici parce qu'un audit dont on ignore l'angle mort ne se relit pas.
 *
 *   1. JETONS CONSTRUITS À L'EXÉCUTION — `` className={`col-${n}`} ``, `clsx(...)`,
 *      une variable nue. MESURÉ : 105 des 1 321 `className=` du dépôt ont une valeur
 *      dynamique. Invisibles ici, dans les deux sens (ni gardés, ni faux positifs).
 *   2. CLASSES STOCKÉES HORS D'UN `className=` — `ROLE_CONFIG = { cls: 'badge-red' }`
 *      passé plus loin en `className={cfg.cls}`. Le jeton n'est jamais adjacent au mot
 *      `className`, on ne le voit pas.
 *   3. `className` REÇU EN PROP — le jeton vit chez l'appelant, la classe est rendue chez
 *      l'appelé. On voit le site où il est ÉCRIT, pas celui où il est rendu ; suffisant ici,
 *      mais un composant qui compose des classes reçues échappe.
 *   4. OPÉRANDES DE COMPARAISON pris pour des classes — `className={t === 'Mobile' ? …}`.
 *      Traité (les littéraux précédés de `===`/`!==`/`==`/`!=` sont écartés), mais la parade
 *      est syntaxique : une comparaison écrite autrement repasserait.
 *
 * Et une limite du CÔTÉ ARTEFACT : la définition est cherchée par motif textuel, pas par
 * un vrai analyseur CSS. Un jeton qui apparaîtrait par hasard sous la forme `.jeton … {`
 * dans du JS minifié serait compté comme défini (faux négatif). Le sens de l'erreur est
 * donc « on rate un défaut », jamais « on crie au loup » — c'est le sens acceptable pour un
 * verrou qu'on veut voir respecté.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

/* ═══ 1. PÉRIMÈTRE — DÉRIVÉ du graphe d'imports, jamais une liste écrite à la main ═══
   Une liste est fausse dès qu'on ajoute un fichier, et l'assertion de couverture ne le dit
   pas : elle prouve qu'on a lu N fichiers, jamais que N était le bon N.
   ⚠️ Le code MORT ne doit PAS faire rougir le verrou — sinon il crie au loup et se fait
   désarmer. 18 modules shadcn jamais importés portaient à eux seuls 253 jetons absents. */

const EXT = ['.tsx', '.ts', '.jsx', '.js']

function resoudre(spec, depuis, src) {
  let base
  if (spec.startsWith('@/')) base = join(src, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(depuis), spec)
  else return null                                   // paquet npm — hors périmètre
  for (const e of ['', ...EXT, ...EXT.map(x => '/index' + x)]) {
    const p = base + e
    if (existsSync(p) && statSync(p).isFile()) return p
  }
  return null
}

/** Spécificateurs importés : `from '…'`, `import('…')`, `require('…')`. */
function specificateurs(source) {
  const out = []
  for (const m of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) out.push(m[1])
  for (const m of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1])
  for (const m of source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1])
  return out
}

/** Marche transitive depuis l'entrée. Rend les chemins absolus atteignables. */
export function fichiersAtteignables(src, entree) {
  const vus = new Set()
  const pile = [entree]
  while (pile.length) {
    const f = pile.pop()
    if (vus.has(f)) continue
    vus.add(f)
    const source = readFileSync(f, 'utf8')
    for (const s of specificateurs(source)) {
      const p = resoudre(s, f, src)
      if (p && !vus.has(p)) pile.push(p)
    }
  }
  return [...vus]
}

/** Tous les fichiers de production sous `src/` (hors tests) — pour l'assertion de couverture. */
export function fichiersDeProduction(src) {
  const out = []
  const marche = d => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { if (e !== 'tests' && e !== '__tests__') marche(p) }
      else if (/\.(tsx|ts)$/.test(p) && !/\.test\.|\.d\.ts$/.test(p)) out.push(p)
    }
  }
  marche(src)
  return out
}

/* ═══ 2. EXTRACTION DES JETONS ═══════════════════════════════════════════════ */

/** Un jeton plausible de classe CSS. Écarte les résidus d'interpolation. */
const JETON = /^[A-Za-z][\w:./\\[\]%#!-]*$/

/**
 * Jetons de classe ÉCRITS EN CLAIR dans un `className`.
 * ⚠️ Les littéraux qui sont des OPÉRANDES DE COMPARAISON sont écartés : `ReportsTabs.tsx`
 * écrit `className={onglet === 'Mobile' ? …}` — sans cette règle, `Mobile` et `TRANSIT`
 * remontaient comme deux classes manquantes (faux positifs mesurés).
 */
/**
 * Retire commentaires de ligne et de bloc.
 * ⚠️ Sans ça, un EXEMPLE en JSDoc devient un défaut : `skeleton.tsx` documente son usage par
 * `<Skeleton className="h-4 w-20" />` dans un `/** *​/`, et le scan remontait `h-4` et `w-20`
 * comme deux classes manquantes. Un scanner qui lit les commentaires interdit d'expliquer ce
 * qu'il fait — et il accuse du code qui n'existe pas.
 * (Découpe naïve : une séquence `//` ou `/*` DANS une chaîne serait coupée à tort. Le sens de
 * l'erreur est alors « on voit moins », jamais « on accuse à tort ».)
 */
export function codeSeul(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

export function jetonsDeClasse(brut) {
  const source = codeSeul(brut)
  const out = new Set()
  // Chaque `className=` puis la valeur qui suit : "…" | '…' | {…} (équilibré, 1 niveau utile).
  for (const m of source.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{)/g)) {
    if (m[1] !== undefined || m[2] !== undefined) {
      ajouter(out, m[1] ?? m[2])
      continue
    }
    // Accolade : on lit l'expression jusqu'à sa fermeture, en appariant les délimiteurs.
    let i = m.index + m[0].length, prof = 1
    while (i < source.length && prof > 0) {
      const c = source[i]
      if (c === '{') prof++
      else if (c === '}') prof--
      i++
    }
    scannerExpression(source.slice(m.index + m[0].length, i - 1), out)
  }
  return out
}

/**
 * Littéraux d'une expression `className={…}`, SAUF les opérandes de comparaison.
 *
 * ⚠️ Un GABARIT se traite en DEUX temps, et une version antérieure n'en faisait qu'un :
 *   • ses parties STATIQUES sont des classes (`` `badge ${…}` `` → « badge ») ;
 *   • ses INTERPOLATIONS sont du CODE, à rescanner récursivement — c'est là que vivent
 *     `'badge-green'` et `'badge-red'` dans `` className={`badge ${x ? 'badge-green' : …}`} ``,
 *     motif très courant ici (statuts de commande, modes de paiement, paliers client).
 * Ne faire que le premier temps rendait ces classes INVISIBLES au verrou : un commentaire
 * affirmait qu'elles étaient « rattrapées par les tours suivants de la boucle » — elles ne
 * l'étaient pas, la regex ayant déjà consommé le gabarit entier. Trou trouvé par le test,
 * pas par la relecture.
 */
function scannerExpression(expr, out) {
  for (const l of expr.matchAll(/(===|!==|==|!=)?\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g)) {
    if (l[1]) continue                       // opérande de comparaison — pas une classe
    if (l[4] === undefined) { ajouter(out, l[2] ?? l[3]); continue }
    const { statique, interpolations } = decouperGabarit(l[4])
    ajouter(out, statique)
    for (const inner of interpolations) scannerExpression(inner, out)
  }
}

/** Sépare les parties statiques d'un gabarit de ses `${…}` (appariement, pas une regex). */
function decouperGabarit(gabarit) {
  let statique = '', i = 0
  const interpolations = []
  while (i < gabarit.length) {
    if (gabarit[i] === '$' && gabarit[i + 1] === '{') {
      let prof = 1, debut = i + 2
      i += 2
      while (i < gabarit.length && prof > 0) {
        if (gabarit[i] === '{') prof++
        else if (gabarit[i] === '}') prof--
        i++
      }
      interpolations.push(gabarit.slice(debut, i - 1))
      statique += ' '
    } else statique += gabarit[i++]
  }
  return { statique, interpolations }
}

function ajouter(set, valeur) {
  if (!valeur) return
  for (const t of valeur.split(/\s+/)) {
    if (!t || t.includes('${') || t.includes('$')) continue
    if (JETON.test(t)) set.add(t)
  }
}

/* ═══ 3. DÉFINITION DANS L'ARTEFACT ══════════════════════════════════════════ */

export function corpusLivre(dist) {
  const out = []
  const marche = d => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) marche(p)
      else if (/\.(css|js|html)$/.test(p)) out.push(p)
    }
  }
  marche(dist)
  return { fichiers: out, texte: out.map(f => readFileSync(f, 'utf8')).join('\n') }
}

/**
 * Le jeton est-il DÉFINI comme sélecteur de classe ?
 * On exige `.jeton` … `{` sans accolade intercalée : `.mb-5 { … }`, `.badge,.pill {`.
 *
 * ⚠️ TOUT caractère non-identifiant d'un nom de classe est ÉCHAPPÉ dans le sélecteur CSS :
 * `mb-1.5` s'écrit `.mb-1\.5`, `lg:grid-cols-4` s'écrit `.lg\:grid-cols-4`. Une première
 * version n'échappait que le point : les QUATRE variantes responsives — pourtant écrites à
 * la main dans `index.css` et bien présentes dans le CSS livré — remontaient comme
 * manquantes, sur 12 sites. Un verrou qui accuse du code correct se fait désarmer aussi
 * sûrement qu'un verrou qui laisse passer. D'où l'antislash OPTIONNEL devant chaque
 * caractère spécial.
 */
export function estDefini(jeton, texte) {
  const motif = [...jeton].map(c =>
    /[A-Za-z0-9_-]/.test(c) ? c : '\\\\?' + c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'),
  ).join('')
  return new RegExp('\\.' + motif + '(?![\\w-])[^{}]{0,160}\\{').test(texte)
}

/* ═══ 4. AUDIT ═══════════════════════════════════════════════════════════════ */

/**
 * ⚠️ EXEMPTION **DÉRIVÉE**, pas une liste : un jeton cité dans `e2e/` est une POIGNÉE, pas
 * un style. `.modal-box.sub-modal` et `.sub-body` sont des sélecteurs Playwright
 * (`e2e/subscriptions-modal.shot.mjs`) — les définir en CSS inventerait une règle, les
 * retirer casserait les captures. Une liste écrite à la main vieillirait ; celle-ci suit
 * les specs.
 */
export function poigneesE2E(dirE2E) {
  if (!existsSync(dirE2E)) return new Set()
  const out = new Set()
  const marche = d => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { if (e !== 'node_modules' && e !== '.auth') marche(p) }
      else if (/\.(mjs|ts|js)$/.test(p)) {
        for (const m of readFileSync(p, 'utf8').matchAll(/\.([a-zA-Z][\w-]*)/g)) out.add(m[1])
      }
    }
  }
  marche(dirE2E)
  return out
}

export function auditer({ src, entree, dist, e2e }) {
  const atteignables = fichiersAtteignables(src, entree)
  const { fichiers: fArtefact, texte } = corpusLivre(dist)
  const poignees = poigneesE2E(e2e)

  const parJeton = new Map()
  for (const f of atteignables) {
    if (!/\.(tsx|jsx)$/.test(f)) continue
    for (const t of jetonsDeClasse(readFileSync(f, 'utf8'))) {
      if (!parJeton.has(t)) parJeton.set(t, new Set())
      parJeton.get(t).add(f)
    }
  }

  const absents = []
  for (const [t, sites] of parJeton) {
    if (poignees.has(t)) continue
    if (estDefini(t, texte)) continue
    absents.push({ jeton: t, sites: [...sites].sort() })
  }
  absents.sort((a, b) => b.sites.length - a.sites.length || a.jeton.localeCompare(b.jeton))

  return {
    nbFichiersAtteignables: atteignables.length,
    nbFichiersArtefact: fArtefact.length,
    octetsArtefact: texte.length,
    nbJetons: parJeton.size,
    absents,
  }
}
