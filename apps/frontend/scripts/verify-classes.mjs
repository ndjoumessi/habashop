#!/usr/bin/env node
/**
 * VERROU D'ARTEFACT — aucun jeton de classe du code ATTEIGNABLE ne doit manquer au `dist/`
 * livré. Moteur, corpus et limites connues : `scripts/classAudit.mjs`.
 *
 * ⚠️ Ce verrou ne peut PAS être un test unitaire : la CI lance `vitest` AVANT `build`, donc
 * `dist/` n'existe pas encore à ce moment-là. Il suit le motif déjà en place dans ce dépôt
 * pour tout ce qui se juge sur le produit et non sur la source — `verify:sw-routes`
 * (ordre des règles du service worker) et `verify:seo-urls` (marqueurs non substitués).
 * La LOGIQUE, elle, est gardée par la suite : `src/tests/classesLivrees.test.ts`.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { auditer } from './classAudit.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(RACINE, 'src')
const DIST = join(RACINE, 'dist')

if (!existsSync(DIST)) {
  console.error('❌ dist/ absent — ce verrou juge l\'ARTEFACT. Lancer `npm run build` d\'abord.')
  process.exit(1)
}

const r = auditer({
  src: SRC,
  entree: join(SRC, 'main.tsx'),
  dist: DIST,
  e2e: join(RACINE, 'e2e'),
})

// ── Assertions de COUVERTURE (angle mort n°1 : un scan cassé rend une liste vide, donc un
//    vert qui ne garde rien). On exige des ordres de grandeur, pas des valeurs exactes.
const socle = [
  ['fichiers atteignables', r.nbFichiersAtteignables, 150],
  ['fichiers d\'artefact lus', r.nbFichiersArtefact, 20],
  ['jetons de classe extraits', r.nbJetons, 150],
]
let casse = false
for (const [quoi, eu, min] of socle) {
  if (eu < min) { console.error(`❌ COUVERTURE — ${quoi} : ${eu} < ${min} attendus. Le scan ne lit pas ce qu'il croit lire.`); casse = true }
}
if (casse) process.exit(1)

console.log(`[verify:classes] ${r.nbFichiersAtteignables} fichiers atteignables · ${r.nbJetons} jetons · ${r.nbFichiersArtefact} fichiers d'artefact (${(r.octetsArtefact / 1e6).toFixed(1)} Mo)`)

if (r.absents.length === 0) {
  console.log('✅ Tout jeton de classe du code atteignable existe dans l\'artefact livré.')
  process.exit(0)
}

console.error(`\n❌ ${r.absents.length} jeton(s) de classe écrits mais ABSENTS de l'artefact livré.`)
console.error('   Tailwind n\'émet rien dans ce dépôt : une classe utilitaire non écrite à la main')
console.error('   dans `index.css` est MORTE. Trois issues, dans cet ordre de préférence :')
console.error('     • la bonne classe existe déjà sous un autre nom  → corriger l\'APPEL')
console.error('     • le style est déjà inline à côté               → retirer la poignée morte')
console.error('     • rien ne la porte                              → l\'écrire dans `index.css`\n')
for (const a of r.absents) {
  console.error(`  ${a.jeton}  (${a.sites.length})`)
  for (const s of a.sites) console.error(`      ${s.replace(RACINE + '/', '')}`)
}
process.exit(1)
