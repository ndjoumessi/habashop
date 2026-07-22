// Génère src/version.generated.ts AU BUILD (hook `prebuild`) depuis le package.json RACINE
// du monorepo. But : BAKER la version à la compilation → le binaire déployé n'a AUCUNE
// hypothèse sur ce que contient le conteneur runtime (le walk FS runtime échouait sur l'image
// slim Railway → /health = 0.0.0-unknown). La racine EST présente au build (workspaces npm).
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url)) // apps/backend/scripts
const rootPkg = join(here, '../../../package.json')   // racine du monorepo
const out = join(here, '../src/version.generated.ts')

try {
  const version = String(JSON.parse(readFileSync(rootPkg, 'utf8')).version ?? '')
  // Regex ANCRÉE des deux côtés (semver strict, pré-release optionnel) → refuse toute valeur
  // hors-forme AVANT interpolation. + JSON.stringify pour un littéral échappé : deux verrous
  // contre l'injection de code dans le fichier généré (le finding de revue de sécurité).
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`version racine absente/invalide: ${version}`)
  // Empreinte de BUILD : identifie le binaire déployé même quand la version ne bouge pas.
  // ⚠️ Sans elle, on ne peut PAS prouver quel commit tourne en prod : `railway up` envoie
  // des fichiers (pas un dépôt), Railway n'injecte donc aucune variable git, et /health ne
  // renvoyait que la version — inchangée entre deux correctifs. L'uptime prouve QU'UN
  // redémarrage a eu lieu, pas LEQUEL.
  let sha = 'nogit'
  try { sha = execSync('git rev-parse --short HEAD', { cwd: here, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { /* hors dépôt (Docker) */ }
  const buildId = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z-${sha}`
  if (!/^[0-9A-Za-z.\-]+$/.test(buildId)) throw new Error(`buildId hors-forme: ${buildId}`)

  writeFileSync(out,
    `// ⚠️ GÉNÉRÉ AU BUILD par scripts/gen-version.mjs (hook prebuild) depuis le package.json RACINE.\n` +
    `// NE PAS éditer à la main. Baké à la compilation → aucune lecture runtime, aucune hypothèse conteneur.\n` +
    `export const BAKED_APP_VERSION = ${JSON.stringify(version)}\n` +
    `export const BAKED_BUILD_ID = ${JSON.stringify(buildId)}\n`)
  console.log('[gen-version] BAKED_APP_VERSION =', version, '| BUILD_ID =', buildId)
} catch (e) {
  // Racine illisible au build (cas limite) → on CONSERVE le fichier committé (dernière valeur connue),
  // jamais d'écrasement par du vide. Le build ne casse pas.
  console.warn('[gen-version] racine illisible, version.generated.ts conservé tel quel :', e.message)
}
