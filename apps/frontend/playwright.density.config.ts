import { defineConfig } from '@playwright/test'

/**
 * CONFIG DÉDIÉE — mesure de densité sur le harnais de DÉVELOPPEMENT.
 *
 * ⚠️ Séparée de `playwright.config.ts` à dessein. La config principale vise la PRODUCTION et
 * dépend d'un `storageState` obtenu par un vrai login sur le tenant e2e ; ici on ne
 * s'authentifie PAS — le harnais `/__dev/table` n'existe qu'en dev et rend le composant sans
 * la garde `PlatformAdminOnly`, qui reste intacte sur `/admin`.
 *
 * ⚠️ `serviceWorkers: 'block'` : le SW de la PWA court-circuite `page.route()` et sert des
 * réponses en cache — piège déjà documenté (§ Pièges E2E). Ici le harnais stubbe `fetch`
 * lui-même, mais le SW pourrait intercepter le chargement des chunks.
 */
export default defineConfig({
  // ⚠️ Pointe le DOSSIER, pas un nom : le prochain harnais y tombera sans qu'on touche
  // à cette config, et sans risque qu'il parte dans la suite de production.
  testDir: './e2e/dev',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.HARNESS_BASE ?? 'http://localhost:5173',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  // Démarre le serveur de dev — le harnais n'existe QUE là (`import.meta.env.DEV`).
  webServer: process.env.HARNESS_BASE ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 90_000,
  },
})
