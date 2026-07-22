#!/usr/bin/env node
/**
 * Vérifie que le raccourci de connexion démo — et surtout le mot de passe qu'il
 * contient — est ABSENT du bundle de production.
 *
 * Un test unitaire ne peut pas le prouver : ce qui compte, c'est ce que Vite livre
 * réellement après repli de `import.meta.env.VITE_DEMO_MODE` et élagage. Même leçon
 * que le smoke de version — la source peut être juste et l'artefact déployé faux.
 *
 * Usage : node scripts/verify-demo-flag.mjs [dossier-dist]
 *   sans VITE_DEMO_MODE  → le mot de passe NE DOIT PAS apparaître (échec sinon)
 *   avec VITE_DEMO_MODE=1 → il DOIT apparaître (prouve que le grep est concluant)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = process.argv[2] ?? 'dist'
const NEEDLE = 'demo1234'
const expectPresent = process.env.VITE_DEMO_MODE === '1'

function walk(dir) {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

let files
try {
  files = walk(DIST).filter(f => /\.(js|css|html)$/.test(f))
} catch {
  console.error(`[verify-demo-flag] ❌ Dossier « ${DIST} » introuvable — lancez le build d'abord.`)
  process.exit(1)
}

const hits = files.filter(f => readFileSync(f, 'utf8').includes(NEEDLE))

if (expectPresent) {
  if (hits.length === 0) {
    console.error(`[verify-demo-flag] ❌ VITE_DEMO_MODE=1 mais « ${NEEDLE} » est absent — le bloc démo ne serait plus livré même en démo.`)
    process.exit(1)
  }
  console.log(`[verify-demo-flag] OK — build DÉMO : « ${NEEDLE} » présent dans ${hits.length} fichier(s), le grep est concluant.`)
  process.exit(0)
}

if (hits.length > 0) {
  console.error(`[verify-demo-flag] ❌ FUITE — « ${NEEDLE} » est présent dans le bundle de PRODUCTION :`)
  for (const h of hits) console.error(`   ${h}`)
  process.exit(1)
}
console.log(`[verify-demo-flag] OK — build PROD : « ${NEEDLE} » absent des ${files.length} fichiers livrés.`)
