import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Version PRODUIT = SOURCE UNIQUE = package.json RACINE du monorepo (« habashop »).
// Lue au boot en remontant l'arborescence depuis ce fichier jusqu'au package.json dont
// `name === 'habashop'` → robuste au layout (src en dev via tsx, dist/ en prod) ET au cwd.
// AUCUN numéro de version en dur ailleurs (health, docs, admin…) — cf. `versionSource.test.ts`.
// ⚠️ Mobile (mobile/app.json) est une piste SÉPARÉE (pilote runtimeVersion/OTA) — cf. CLAUDE.md.
let cached: string | null = null

export function getAppVersion(): string {
  if (cached) return cached
  let dir = __dirname
  for (let i = 0; i < 8; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      if (pkg?.name === 'habashop' && pkg?.version) { cached = String(pkg.version); return cached }
    } catch { /* pas de package.json à ce niveau — on remonte */ }
    const parent = dirname(dir)
    if (parent === dir) break // racine du FS atteinte
    dir = parent
  }
  // Repli si le package.json racine est absent du déploiement (ne devrait pas arriver :
  // Railway déploie depuis la racine). Non-semver volontaire → jamais confondu avec une vraie version.
  cached = process.env.npm_package_version || '0.0.0-unknown'
  return cached
}
