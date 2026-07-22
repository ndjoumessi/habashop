import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { BAKED_APP_VERSION, BAKED_BUILD_ID } from '../version.generated'

// Version PRODUIT = SOURCE UNIQUE = package.json RACINE du monorepo (« habashop »).
// ⚠️ BAKÉE AU BUILD (`version.generated.ts` via prebuild) → le binaire déployé ne fait
// AUCUNE lecture runtime : le walk FS échouait sur l'image slim Railway (/health=0.0.0-unknown).
// Repli (dev/local) = remontée FS jusqu'au package.json « habashop ». AUCUN numéro en dur
// ailleurs (health, docs, admin…) — cf. `versionSource.test.ts` + smoke post-déploiement.
// ⚠️ Mobile (mobile/app.json) est une piste SÉPARÉE (pilote runtimeVersion/OTA) — cf. CLAUDE.md.
let cached: string | null = null

export function getAppVersion(): string {
  if (cached) return cached
  // 1) Version bakée au build (source de vérité en prod — pas d'hypothèse conteneur).
  if (BAKED_APP_VERSION && /^\d+\.\d+\.\d+/.test(BAKED_APP_VERSION)) { cached = BAKED_APP_VERSION; return cached }
  // 2) Repli dev/local : remontée FS (la racine est présente hors conteneur).
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

/**
 * Empreinte du BINAIRE déployé (`AAAAMMJJTHHMMSSZ-<sha court>`).
 *
 * ⚠️ Complète la version, elle ne la remplace pas : deux correctifs successifs partagent
 * souvent le même semver, donc `/health.version` ne dit PAS quel build tourne. `railway up`
 * envoie des fichiers et non un dépôt → Railway n'injecte aucune variable git, et l'uptime
 * prouve qu'un redémarrage a eu lieu, pas lequel. D'où cette empreinte, bakée au build.
 */
export function getBuildId(): string {
  return BAKED_BUILD_ID || 'unknown'
}
