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
/**
 * ⚠️ MARQUEUR D'IDENTITÉ DU SERVEUR — `reuseExistingServer: false` empêche de se BRANCHER sur
 * un serveur existant ; il ne prouve pas que celui auquel on parle est celui qu'on a démarré.
 * Un port n'est pas une identité. On injecte donc un jeton unique par exécution : le harnais
 * le rend, et le spec l'assert AVANT la première mesure.
 * C'est la leçon du `dist/` rassis — un sabotage passé vert parce que l'artefact n'avait pas
 * été régénéré — appliquée à un serveur de développement.
 *
 * ⚠️ Posé dans `process.env` : les workers Playwright sont des processus ENFANTS de celui qui
 * lit cette config, donc ils en héritent. Le passer par `webServer.env` seul ne le rendrait
 * pas visible au spec.
 */
const JETON = process.env.HARNESS_NONCE
  ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
process.env.HARNESS_NONCE = JETON

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
    // ⚠️ `true` EN LOCAL SEULEMENT. Sur un runner, réutiliser « un serveur déjà là » est un
    // vert qui décrit un monde inexistant : si le port 5173 est occupé par autre chose,
    // Playwright s'y branche sans rien dire. En CI on exige un serveur DÉMARRÉ PAR NOUS.
    reuseExistingServer: !process.env.CI,
    // Le jeton traverse jusqu'à Vite, qui l'inline dans le harnais (préfixe `VITE_`).
    env: { VITE_HARNESS_NONCE: JETON },
    // ⚠️ Un runner froid doit installer les deps de Vite avant de servir : 90 s suffisaient
    // en local, pas nécessairement là-bas. On laisse de la marge plutôt qu'un échec qui
    // ressemblerait à un défaut de la mesure.
    timeout: process.env.CI ? 180_000 : 90_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
