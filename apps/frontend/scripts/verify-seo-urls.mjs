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

// ─────────────────────────────────────────────────────────────────────────────
// 3. Le HTML LIVRÉ est-il encore PARSABLE là où le SEO se joue ?
//
// ⚠️ MESURÉ EN PRODUCTION le 2026-08-06 : un commentaire explicatif posé À L'INTÉRIEUR
// de `<meta name="keywords" … >`, entre `name` et `content`, a transformé le commentaire
// en SUITE D'ATTRIBUTS BIDON — `content` valait `null` dans le DOM et le mot-clé était
// perdu. La même faute, le même jour, avait rendu un bloc `application/ld+json` invalide,
// ce qui aurait fait cesser à Google la lecture de TOUT le schéma Organization.
//
// Aucune de ces deux régressions n'est visible pour `tsc`, les tests ou la revue : la
// source « a l'air » correcte, c'est la GRAMMAIRE du document livré qui est cassée. C'est
// la même famille que l'ordre des règles du service worker — on inspecte l'ARTEFACT.
const html = join(DIST, 'index.html')
if (!existsSync(html)) ko('index.html manquant de dist/')
else {
  const doc = readFileSync(html, 'utf-8')

  // (a) aucun commentaire ouvert À L'INTÉRIEUR d'une balise
  const dansBalise = [...doc.matchAll(/<(meta|link|script|title)[^>]*<!--/gi)].map(m => m[1])
  if (dansBalise.length) {
    ko(`index.html : commentaire HTML DANS une balise <${[...new Set(dansBalise)].join('>, <')}> — `
      + `les attributs qui suivent sont perdus`)
  }

  // (b) chaque <meta name=…> doit porter un `content` non vide
  for (const m of doc.matchAll(/<meta\s+name="([^"]+)"([\s\S]*?)\/?>/g)) {
    if (!/content="[^"]+"/.test(m[2])) ko(`index.html : <meta name="${m[1]}"> sans content exploitable`)
  }

  // (c) chaque bloc JSON-LD doit être du JSON VALIDE
  const blocs = [...doc.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  if (!blocs.length) ko('index.html : aucun bloc application/ld+json — le balisage a disparu')
  blocs.forEach((b, i) => {
    try { JSON.parse(b[1]) } catch (e) { ko(`index.html : bloc ld+json n°${i + 1} INVALIDE — ${e.message}`) }
  })
}

if (echecs) {
  console.error(`\n${echecs} problème(s). Le SEO livré dans dist/ n’est pas exploitable.`)
  process.exit(1)
}
console.log(`✅ ${FICHIERS.length} fichier(s) SEO livrés, aucun marqueur non substitué, `
  + `index.html parsable (meta + JSON-LD).`)
