#!/usr/bin/env node
/**
 * Bascule du dépôt vers un domaine propre — PÉRIMÈTRE DÉRIVÉ, RÉÉCRITURES ANCRÉES.
 *
 *   node scripts/migrer-domaine.mjs --to https://app.mondomaine.com          # simulation
 *   node scripts/migrer-domaine.mjs --to https://app.mondomaine.com --appliquer
 *
 * ⚠️ **Pourquoi pas un `sed -i` sur le dépôt.** Le littéral vit à 57 endroits, et la plupart ne
 * doivent PAS bouger : `lib/appUrl.ts` raconte en commentaire que « le littéral était recopié à
 * 17 endroits », `admin.ts` porte une adresse e-mail FACTICE, les 22 specs E2E lisent
 * `process.env.X ?? défaut` et se surchargent, et la documentation d'audit DATE l'hôte
 * historique. Une réécriture aveugle rendrait ces phrases FAUSSES — en se déclarant réussie.
 *
 * Deux mécaniques, pour deux angles morts différents :
 *
 *  1. **RÉÉCRITURES ANCRÉES** — chaque substitution nomme sa ligne exacte et **exige de la
 *     trouver une fois et une seule**. Sans cette assertion, une ancre devenue inexacte fait un
 *     no-op silencieux et le script affiche « ✓ » sans avoir rien changé : c'est comme ça qu'un
 *     compteur est resté faux pendant 4 PR dans ce dépôt.
 *
 *  2. **PÉRIMÈTRE DÉRIVÉ** — la liste des fichiers concernés n'est jamais écrite à la main :
 *     elle vient de `git grep`. Tout fichier portant le littéral qui n'est ni réécrit ni
 *     **exempté par une raison NOMMÉE** fait **ÉCHOUER** le script. Un périmètre écrit à la main
 *     est faux dès qu'on ajoute un fichier, et l'ajout ne se signale pas tout seul.
 *
 * ⚠️ Ce script ne touche **que le dépôt**. Les variables (`FRONTEND_URL`, `VITE_APP_URL`,
 * `EXPO_PUBLIC_APP_URL`, `CORS_EXTRA_ORIGINS`) vivent sur Railway, Vercel et EAS : elles
 * DÉCIDENT en production, ce fichier n'est que leur repli. Cf. docs/handoff/2026-08-12.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const lire = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined }
const APPLIQUER = args.includes('--appliquer')

const DEPUIS = (lire('--from') ?? 'https://habashop.vercel.app').replace(/\/+$/, '')
const VERS = (lire('--to') ?? '').trim().replace(/\/+$/, '')

if (!VERS) {
  console.error('❌ --to <https://nouveau-domaine> requis.')
  console.error('   ex : node scripts/migrer-domaine.mjs --to https://app.mondomaine.com')
  process.exit(2)
}
if (!/^https:\/\/[a-z0-9.-]+$/.test(VERS)) {
  console.error(`❌ --to doit être une origine https sans chemin ni barre finale — reçu « ${VERS} ».`)
  process.exit(2)
}

const hoteDepuis = DEPUIS.replace(/^https?:\/\//, '')
const hoteVers = VERS.replace(/^https?:\/\//, '')

// ── 1. LES RÉÉCRITURES — une ancre par ligne, chacune vérifiée ──────────────────────────
/** @type {{f: string, old: string, new: string, pourquoi: string}[]} */
const REECRITURES = [
  // Les quatre défauts `DEFAULT_APP_URL`. Leur ÉGALITÉ est verrouillée par les méta-tests
  // (appUrlSource / appUrlStatic / appUrl mobile) : en oublier un fait rougir la suite, fort.
  { f: 'apps/backend/src/lib/appUrl.ts',
    old: `export const DEFAULT_APP_URL = '${DEPUIS}'`, new: `export const DEFAULT_APP_URL = '${VERS}'`,
    pourquoi: 'repli des liens de TOUS les e-mails transactionnels (17 sites autrefois)' },
  { f: 'apps/frontend/src/lib/appUrl.ts',
    old: `export const DEFAULT_APP_URL = '${DEPUIS}'`, new: `export const DEFAULT_APP_URL = '${VERS}'`,
    pourquoi: 'liens user-facing du front (Privacy ×4, PublicCatalog ×2)' },
  { f: 'apps/frontend/scripts/gen-seo.mjs',
    old: `export const DEFAULT_APP_URL = '${DEPUIS}'`, new: `export const DEFAULT_APP_URL = '${VERS}'`,
    pourquoi: 'sitemap.xml et robots.txt — produits au build, HORS pipeline Vite' },
  { f: 'mobile/src/lib/appUrl.ts',
    old: `export const DEFAULT_APP_URL = '${DEPUIS}'`, new: `export const DEFAULT_APP_URL = '${VERS}'`,
    pourquoi: 'pied du ticket imprimé et du ticket WhatsApp — partent chez le CLIENT' },

  // Les valeurs d'environnement versionnées. ⚠️ NÉCESSAIRES, jamais SUFFISANTES : c'est la
  // plateforme qui décide. Si VITE_APP_URL manque au build, Vite livre « %VITE_APP_URL% ».
  { f: 'apps/frontend/.env',
    old: `VITE_APP_URL=${DEPUIS}`, new: `VITE_APP_URL=${VERS}`,
    pourquoi: 'repli du build front (fichier SUIVI par git) — canonical et og:url' },
  { f: 'apps/backend/.env.example',
    old: `FRONTEND_URL=${DEPUIS}`, new: `FRONTEND_URL=${VERS}`,
    pourquoi: 'exemple servant de référence au réglage Railway' },

  // Surfaces applicatives qui portent le littéral en dur.
  { f: 'apps/frontend/src/components/settings/SectionCatalog.tsx',
    old: `: '${DEPUIS}'`, new: `: '${VERS}'`,
    pourquoi: "repli sans `window` — l'URL de catalogue proposée au commerçant" },
  { f: 'apps/frontend/src/pages/Integrations.tsx',
    old: `endpoint:'${hoteDepuis}',`, new: `endpoint:'${hoteVers}',`,
    pourquoi: 'console Ops — endpoint DÉCLARÉ de la carte Vercel' },
  { f: 'apps/frontend/src/pages/Integrations.tsx',
    old: `pingUrl:'${DEPUIS}'`, new: `pingUrl:'${VERS}'`,
    pourquoi: 'console Ops — URL réellement SONDÉE (elle doit viser le front vivant)' },

  // Contractuel et fiche store.
  { f: 'legal/terms.html',
    old: `<a href="${DEPUIS}">${hoteDepuis}</a>`, new: `<a href="${VERS}">${hoteVers}</a>`,
    pourquoi: "CGU — le service est DÉSIGNÉ par cette URL dans un contrat" },
  { f: 'legal/mentions-legales.html',
    old: `<a href="${DEPUIS}">${hoteDepuis}</a>`, new: `<a href="${VERS}">${hoteVers}</a>`,
    pourquoi: "mentions légales — l'adresse du service y est une mention OBLIGATOIRE" },
  { f: 'mobile/assets/feature_graphic.svg',
    old: hoteDepuis, new: hoteVers,
    pourquoi: '⚠️ URL CUITE dans le visuel Play Store 1024×500 — à RE-RENDRE et RE-TÉLÉVERSER' },
]

// ── 2. LES EXEMPTIONS — une raison NOMMÉE par fichier, sinon le script échoue ────────────
/** @type {[RegExp, string][]} */
const EXEMPTIONS = [
  [/^apps\/frontend\/e2e\//, 'spec E2E : lit `process.env.X ?? défaut`, surchargeable sans édition'],
  [/^apps\/frontend\/playwright\.config\.ts$/, 'config E2E : même mécanique de surcharge'],
  [/^apps\/backend\/src\/tests\/appUrlSource\.test\.ts$/, "méta-test : il vérifie l'ÉGALITÉ des défauts, pas leur valeur — et exempte déjà l'e-mail factice"],
  [/^mobile\/src\/__tests__\/appUrl\.test\.ts$/, "méta-test mobile : idem, il juge la forme"],
  [/^apps\/frontend\/src\/tests\/landingClaims\.test\.ts$/, "fixture de test : chaîne d'exemple passée au détecteur, sans rapport avec l'hôte servi"],
  [/^apps\/frontend\/scripts\/verify-sw-routes\.mjs$/, "fixture d'URL : la règle SW matche le CHEMIN, pas l'hôte — la laisser prouve cette indépendance"],
  [/^apps\/backend\/src\/routes\/admin\.ts$/, 'adresse e-mail FACTICE `test@…`, déjà exemptée par appUrlSource.test.ts'],
  [/^apps\/backend\/prisma\/schema\.prisma$/, 'commentaire — aucun effet'],
  [/^\.github\/workflows\/ci\.yml$/, 'ligne de résumé de run — cosmétique, à corriger à la main si on veut'],
  [/^apps\/backend\/src\/lib\/corsOrigins\.ts$/, "⚠️ l'ANCIENNE origine, gardée EXPRÈS : la migration est un AJOUT, on ne coupe pas l'ancien hôte"],
  [/^(README|CHANGELOG|SETUP)\.md$/, 'documentation racine — à relire à la main, une partie DATE l’hôte historique'],
  [/^docs\//, 'documentation et audits — plusieurs passages DATENT l’hôte historique ; les réécrire les rendrait faux'],
  [/^mobile\/(CLAUDE|README|PLAY_STORE|IOS_BUILD)\.md$/, 'documentation mobile — idem, à relire à la main'],
  // ⚠️ LE SCRIPT S'ÉPINGLAIT LUI-MÊME. Il porte le littéral dans sa valeur `--from` par défaut ;
  // tant qu'il n'était pas suivi par git, `git grep` ne le voyait pas, et tous les essais
  // passaient. Commité, il échouait à CHAQUE exécution. Un scanneur doit survivre à son propre
  // scan — même leçon que `dockerContextImports.test.ts`.
  [/^scripts\/migrer-domaine\.mjs$/, "le script lui-même : le littéral y est la valeur `--from` par défaut, pas une surface"],
]

// ── Le balayage ─────────────────────────────────────────────────────────────────────────
// ⚠️ `git grep` sort en 1 quand il ne trouve RIEN — donc execFileSync lève. « Rien trouvé »
// est ici une réponse légitime (migration déjà faite, ou `--from` erroné) : elle doit produire
// un refus LISIBLE, pas une trace de pile. C'est le même piège que `set -e` + `grep` muet.
let suivis = []
try {
  suivis = execFileSync('git', ['grep', '-l', hoteDepuis], { encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(Boolean)
} catch (e) {
  if (e?.status !== 1) throw e // 1 = aucune correspondance ; tout autre code est une vraie panne
}

if (suivis.length === 0) {
  console.error(`❌ AUCUN fichier ne porte « ${hoteDepuis} ». Balayage cassé, ou migration déjà faite ?`)
  console.error('   (un scan qui ne lit rien rend une liste vide, donc un succès qui ne garde rien)')
  process.exit(2)
}

const aReecrire = new Set(REECRITURES.map(r => r.f))
const orphelins = suivis.filter(f => !aReecrire.has(f) && !EXEMPTIONS.some(([re]) => re.test(f)))

console.log(`\n  ${DEPUIS}  →  ${VERS}`)
console.log(`  ${suivis.length} fichiers suivis portent le littéral · ${aReecrire.size} à réécrire · ${suivis.length - aReecrire.size - orphelins.length} exemptés\n`)

if (orphelins.length) {
  console.error('❌ FICHIERS NON CLASSÉS — le script refuse de deviner :\n')
  for (const f of orphelins) console.error(`   ${f}`)
  console.error('\n   Ajoutez-les aux RÉÉCRITURES (avec leur ancre) ou aux EXEMPTIONS (avec leur raison).')
  console.error('   Un périmètre écrit à la main est faux dès qu’on ajoute un fichier : c’est ce refus qui le rattrape.')
  process.exit(1)
}

// ── Les réécritures ─────────────────────────────────────────────────────────────────────
let echecs = 0
const parFichier = new Map()
for (const r of REECRITURES) {
  if (!parFichier.has(r.f)) parFichier.set(r.f, readFileSync(r.f, 'utf8'))
  const avant = parFichier.get(r.f)
  const n = avant.split(r.old).length - 1
  if (n !== 1) {
    console.error(`❌ ${r.f}`)
    console.error(`   ancre trouvée ${n} fois (attendu 1) : ${JSON.stringify(r.old)}`)
    console.error('   → le fichier a changé. Corriger l’ancre AVANT d’appliquer : sans cette')
    console.error('     vérification, la substitution serait un no-op qui se déclare réussi.')
    echecs++
    continue
  }
  parFichier.set(r.f, avant.replace(r.old, r.new))
  console.log(`   ✓ ${r.f}`)
  console.log(`     ${r.pourquoi}`)
}
if (echecs) { console.error(`\n❌ ${echecs} ancre(s) introuvable(s) — rien n’a été écrit.`); process.exit(1) }

if (!APPLIQUER) {
  console.log('\n  SIMULATION — rien n’a été écrit. Relancer avec --appliquer.\n')
} else {
  for (const [f, contenu] of parFichier) writeFileSync(f, contenu)
  console.log(`\n  ✅ ${parFichier.size} fichiers écrits.\n`)
}

console.log('  ENSUITE, et le dépôt n’y suffit pas :')
console.log(`    1. Railway   CORS_EXTRA_ORIGINS=${VERS}   ← AVANT tout, et sans redéploiement`)
console.log(`    2. Vercel    ajouter le domaine · VITE_APP_URL=${VERS}`)
console.log(`    3. Railway   FRONTEND_URL=${VERS}`)
console.log('    4. EAS       EXPO_PUBLIC_APP_URL  (+ une OTA : la valeur est INLINÉE au bundling)')
console.log('    5. Vérifier  npm run verify:seo-urls --workspace=apps/frontend   (sur le dist/ LIVRÉ)')
console.log(`    6. Vérifier  curl -s ${VERS}/ | grep -oE '<link rel="canonical"[^>]*>'`)
console.log('    7. Play Store : re-rendre ET re-téléverser feature_graphic.svg + URL de politique\n')
