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

/* ═══ HARNAIS DE MESURE — même motif, même exigence ═════════════════════════════
   `/__dev/table` rend la console Ops SANS la garde `PlatformAdminOnly`, pour mesurer la
   table dense dans un vrai navigateur. Il est gardé par `import.meta.env.DEV` et son
   `import()` vit DANS la branche — mais ça, c'est la SOURCE. Le défaut `demo1234` avait
   précisément une source correcte et un artefact fautif : on vérifie donc le `dist/`.
   ⚠️ Ce harnais est plus grave qu'un raccourci de connexion s'il fuit : il n'expose aucun
   secret, mais il rend un écran d'administration plateforme à n'importe qui.
   ⚠️ Il n'est JAMAIS attendu, même en build démo — contrairement à `demo1234`. */
/* ⚠️ DEUX marqueurs depuis le 2026-08-13 : le harnais des SURFACES monte sept composants
   de production (caisse, catalogue public, abonnements…) avec un `fetch` stubbé et un store
   amorcé. Il est tiré par le premier, donc protégé par la même branche `DEV` — mais
   « protégé par le même mécanisme » est un RAISONNEMENT, et ce fichier existe précisément
   parce qu'un raisonnement correct sur la source avait laissé passer un artefact fautif.
   On vérifie les deux sur le `dist/` livré. */
const MARQUEURS_HARNAIS = ['__habashop_dev_table_harness__', '__habashop_dev_surfaces_harness__']
for (const marqueur of MARQUEURS_HARNAIS) {
  const fuites = files.filter(f => readFileSync(f, 'utf8').includes(marqueur))
  if (fuites.length > 0) {
    console.error(`[verify-demo-flag] ❌ FUITE — le harnais de mesure « ${marqueur} » est dans le bundle livré :`)
    for (const h of fuites) console.error(`   ${h}`)
    console.error('   Le `import()` doit rester DANS la branche `import.meta.env.DEV ? … : null`.')
    process.exit(1)
  }
}
console.log(`[verify-demo-flag] OK — les ${MARQUEURS_HARNAIS.length} harnais de mesure sont absents des ${files.length} fichiers livrés.`)
