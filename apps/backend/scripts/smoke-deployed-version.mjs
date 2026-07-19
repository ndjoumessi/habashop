// SMOKE POST-DÉPLOIEMENT : vérifie que le /health DÉPLOYÉ renvoie bien la version de la
// SOURCE UNIQUE (package.json racine). Comble le trou du méta-test #85 : `versionSource.test.ts`
// prouve la SOURCE (la logique lit la racine), PAS le CHEMIN RÉEL en prod (le walk FS échouait
// sur le conteneur slim → 0.0.0-unknown, méta-test vert quand même). Même leçon que le test qui
// figeait le séparateur de facture sans exercer le rendu réel. À lancer APRÈS chaque déploiement
// backend (Railway). Échoue (exit 1) si la version déployée ≠ source → détecte les régressions
// d'environnement runtime qu'un test unitaire ne peut pas voir.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const expected = JSON.parse(readFileSync(join(here, '../../../package.json'), 'utf8')).version
const BASE = process.env.SMOKE_BASE || 'https://habashop-production.up.railway.app'

const res = await fetch(`${BASE}/health`)
const body = await res.json().catch(() => ({}))
console.log(`[smoke] ${BASE}/health → version="${body.version}" | attendu="${expected}"`)

if (body.version !== expected) {
  console.error(`[smoke] ÉCHEC : le /health déployé ne renvoie pas la version source (${body.version} ≠ ${expected}).`)
  process.exit(1)
}
console.log('[smoke] OK — version déployée = source unique.')
