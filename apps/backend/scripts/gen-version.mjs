// Génère src/version.generated.ts AU BUILD (hook `prebuild`) depuis le package.json RACINE
// du monorepo. But : BAKER la version à la compilation → le binaire déployé n'a AUCUNE
// hypothèse sur ce que contient le conteneur runtime (le walk FS runtime échouait sur l'image
// slim Railway → /health = 0.0.0-unknown). La racine EST présente au build (workspaces npm).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url)) // apps/backend/scripts
const rootPkg = join(here, '../../../package.json')   // racine du monorepo
const out = join(here, '../src/version.generated.ts')

try {
  const version = JSON.parse(readFileSync(rootPkg, 'utf8')).version
  if (!version || !/^\d+\.\d+\.\d+/.test(String(version))) throw new Error(`version racine absente/invalide: ${version}`)
  writeFileSync(out,
    `// ⚠️ GÉNÉRÉ AU BUILD par scripts/gen-version.mjs (hook prebuild) depuis le package.json RACINE.\n` +
    `// NE PAS éditer à la main. Baké à la compilation → aucune lecture runtime, aucune hypothèse conteneur.\n` +
    `export const BAKED_APP_VERSION = '${version}'\n`)
  console.log('[gen-version] BAKED_APP_VERSION =', version)
} catch (e) {
  // Racine illisible au build (cas limite) → on CONSERVE le fichier committé (dernière valeur connue),
  // jamais d'écrasement par du vide. Le build ne casse pas.
  console.warn('[gen-version] racine illisible, version.generated.ts conservé tel quel :', e.message)
}
