#!/usr/bin/env node
/**
 * Inspecte le `dist/` LIVRÉ et échoue si l'URL publique n'y est pas correctement posée.
 *
 * Pourquoi une garde sur l'artefact, en plus du méta-test sur les sources. Mesuré : quand
 * `VITE_APP_URL` n'est pas définie, Vite **ne remplace pas** — il livre le littéral
 * `%VITE_APP_URL%` dans le `canonical`, `og:url` et le JSON-LD. Un canonical cassé est PIRE
 * qu'une URL périmée : Google désindexe. Aucun test de source ne peut voir ça, puisque la
 * source est correcte — c'est l'ENVIRONNEMENT DE BUILD qui manque. Même famille que
 * `verify-sw-routes` (ordre des règles dans le `sw.js` livré) et `verify-demo-flag`.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const FICHIERS = ['index.html', 'sitemap.xml', 'robots.txt']

let echecs = 0
const ko = (m) => { console.error(`❌ ${m}`); echecs++ }

if (!existsSync(DIST)) {
  console.error('❌ dist/ absent — lancer `npm run build` d’abord.')
  process.exit(1)
}

for (const nom of FICHIERS) {
  const f = join(DIST, nom)
  if (!existsSync(f)) { ko(`${nom} manquant de dist/ (gen-seo a-t-il tourné ?)`); continue }
  const contenu = readFileSync(f, 'utf-8')

  // 1. Aucun marqueur non substitué. `%VITE_...%` (Vite) ou `{{...}}` (gabarits gen-seo).
  const restes = [...contenu.matchAll(/%VITE_[A-Z0-9_]*%|\{\{[A-Z_]+\}\}/g)].map(m => m[0])
  if (restes.length) ko(`${nom} : marqueur(s) NON substitué(s) → ${[...new Set(restes)].join(', ')}`)

  // 2. Une URL absolue doit être présente : un sitemap sans <loc> absolu ne sert à rien.
  if (!/https?:\/\/[a-z0-9.-]+/i.test(contenu)) ko(`${nom} : aucune URL absolue — fichier vide de sens`)
}

if (echecs) {
  console.error(`\n${echecs} problème(s). L’URL publique n’est pas correctement posée dans dist/.`)
  process.exit(1)
}
console.log(`✅ ${FICHIERS.length} fichier(s) SEO livrés, aucun marqueur non substitué.`)
