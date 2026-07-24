#!/usr/bin/env node
/**
 * Vérifie que CHAQUE règle de cache du service worker livré est ATTEIGNABLE, et que
 * les URL qui comptent tombent sur la règle attendue.
 *
 * Pourquoi ce script existe (mesuré le 2026-07-24, cf.
 * docs/handoff/2026-07-24-chantier-b-cache-pos.md) : une règle `products-cache`
 * (StaleWhileRevalidate, 7 jours, 500 entrées) vivait dans vite.config.ts et
 * N'A JAMAIS TOURNÉ EN PRODUCTION. Elle était enregistrée APRÈS une règle `/api/`
 * plus large, et workbox retourne le PREMIER match (workbox-routing/Router.js,
 * findMatchingRoute). Tout lecteur de la config croyait pourtant lire la politique
 * de cache du catalogue POS.
 *
 * Ni tsc, ni les tests unitaires, ni la revue ne peuvent voir ça : la source est
 * valide, c'est l'ORDRE dans l'artefact généré qui rend le code mort. Même leçon que
 * verify-demo-flag.mjs et que le smoke de version — on inspecte ce qui est LIVRÉ.
 *
 * Usage : node scripts/verify-sw-routes.mjs [dossier-dist]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = process.argv[2] ?? 'dist'
const SW = join(DIST, 'sw.js')

// URL représentatives → nom de cache ATTENDU. Le catalogue POS est le cas qui a mordu.
const EXPECTATIONS = [
  ['https://habashop-production.up.railway.app/api/products', 'api-cache'],
  ['https://habashop-production.up.railway.app/api/sales', 'api-cache'],
  // Origine différente : prouve que la règle ne dépend plus d'un hôte codé en dur
  // (.env.production pointe déjà ailleurs que Railway).
  ['https://api.habashop.com/api/products', 'api-cache'],
  ['https://habashop.vercel.app/assets/charts-a1b2c3d4.js', 'lazy-chunks-cache'],
]

const src = readFileSync(SW, 'utf8')

// ── Extraction des routes DANS L'ORDRE d'enregistrement ──────────────────────────
// Découpe à parenthèses/crochets équilibrés : un motif regex peut contenir des virgules.
function splitTopLevelArgs(s) {
  const out = []
  let depth = 0, start = 0, inRe = false, inStr = null, esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (esc) { esc = false; continue }
    if (c === '\\') { esc = true; continue }
    if (inStr) { if (c === inStr) inStr = null; continue }
    if (inRe) { if (c === '/') inRe = false; continue }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue }
    // Heuristique littéral regex : un '/' qui suit '(' ou ',' ouvre un motif.
    if (c === '/' && /[(,]\s*$/.test(s.slice(Math.max(0, i - 3), i))) { inRe = true; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) { out.push(s.slice(start, i)); start = i + 1 }
  }
  out.push(s.slice(start))
  return out.map(x => x.trim())
}

const routes = []
const NEEDLE = 'registerRoute('
for (let i = src.indexOf(NEEDLE); i !== -1; i = src.indexOf(NEEDLE, i + 1)) {
  let depth = 0, j = i + NEEDLE.length - 1
  for (; j < src.length; j++) {
    if (src[j] === '(') depth++
    else if (src[j] === ')') { depth--; if (depth === 0) break }
  }
  const args = splitTopLevelArgs(src.slice(i + NEEDLE.length, j))
  const cacheName = /cacheName:"([^"]+)"/.exec(args[1] ?? '')?.[1]
  if (!cacheName) continue // NavigationRoute & co. : pas de cache nommé
  routes.push({ pattern: args[0], cacheName })
}

if (!routes.length) {
  console.error(`❌ Aucune route de cache trouvée dans ${SW} — parseur ou build cassé.`)
  process.exit(1)
}

// ── Résolution : premier match gagne (sémantique workbox) ────────────────────────
// Un motif workbox n'est interprétable qu'en l'ÉVALUANT (littéral regex ou petite fonction
// de match). L'entrée est notre PROPRE artefact de build, produit juste avant par vite —
// qui peut l'altérer contrôle déjà le bundle livré, donc l'évaluation n'ouvre aucune surface
// nouvelle. On borne malgré tout la FORME acceptée : littéral regex, ou fonction fléchée
// courte sans appel dangereux. Tout le reste est refusé et signalé, jamais exécuté.
const REGEX_LITERAL = /^\/.*\/[gimsuy]*$/s
const SAFE_ARROW = /^\([^)]*\)\s*=>\s*[^;{}]{1,200}$/s
function matches(pattern, href) {
  const url = new URL(href)
  const isRegex = REGEX_LITERAL.test(pattern)
  const isArrow = SAFE_ARROW.test(pattern) && !/\b(?:require|import|process|eval|Function|globalThis)\b/.test(pattern)
  if (!isRegex && !isArrow) {
    console.error(`❌ Motif de route non reconnu, NON évalué : ${pattern.slice(0, 120)}`)
    console.error('   Étendre le script (formes autorisées) plutôt que de le contourner.')
    process.exit(1)
  }
  try {
    // eslint-disable-next-line no-new-func
    const val = new Function(`return (${pattern})`)()
    if (val instanceof RegExp) return val.test(href)
    if (typeof val === 'function') return !!val({ url, request: { url: href }, sameOrigin: false })
  } catch { /* motif évaluable mais qui lève → traité comme non-match */ }
  return false
}
const resolve = href => routes.find(r => matches(r.pattern, href))?.cacheName ?? null

let failed = false
for (const [href, expected] of EXPECTATIONS) {
  const got = resolve(href)
  if (got === expected) {
    console.log(`✅ ${href} → ${got}`)
  } else {
    failed = true
    console.error(`❌ ${href} → ${got ?? 'AUCUNE règle'} (attendu : ${expected})`)
  }
}

// ── Aucune règle MORTE : chaque cache déclaré doit gagner au moins une fois ───────
// C'est le défaut d'origine : une règle présente dans la config, jamais atteinte.
const winners = new Set(EXPECTATIONS.map(([href]) => resolve(href)).filter(Boolean))
for (const { cacheName } of routes) {
  if (!winners.has(cacheName)) {
    failed = true
    console.error(
      `❌ Règle MORTE : « ${cacheName} » n'est atteinte par aucune URL de référence.\n` +
      `   Soit une règle plus large enregistrée AVANT l'occulte (workbox = premier match),\n` +
      `   soit ce cache mérite une URL de référence dans EXPECTATIONS.`,
    )
  }
}

if (failed) process.exit(1)
console.log(`✅ ${routes.length} règle(s) de cache, toutes atteignables.`)
