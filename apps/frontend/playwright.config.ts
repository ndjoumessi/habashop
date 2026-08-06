import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  /**
   * ⚠️ EXCLUSION PAR DOSSIER, jamais par nom de fichier.
   * `e2e/dev/` contient les specs qui exigent le SERVEUR DE DÉVELOPPEMENT (harnais gardés par
   * `import.meta.env.DEV`). Cette config vise la PRODUCTION : les y jouer garantit l'échec,
   * puisque le harnais y est absent par conception.
   * MESURÉ le 2026-08-06 : déposé à la racine d'`e2e/`, `dev-table-density.spec.ts` faisait
   * passer la suite prod de 39 cas / 20 fichiers à 43 / 21 — un défaut introduit par le
   * correctif lui-même. Ajouter son NOM ici aurait marché ce jour-là et cassé au deuxième
   * harnais ; un dossier ne se périme pas à l'ajout d'un fichier.
   */
  testIgnore: '**/dev/**',
  timeout: 30000,
  retries: 1, // 1 retry en cas d'échec réseau
  // Backend prod = réplique unique Railway (cold start) → on SÉRIALISE pour ne pas le
  // marteler en parallèle (un /me lent au montage → catch(logout) → bounce /login).
  workers: 1,

  use: {
    // Prod par défaut (CI) ; surchargeable via E2E_BASE pour valider un build local (vite preview).
    // Aligné avec auth.setup.ts qui lit le même E2E_BASE → setup et specs ciblent la même origine.
    baseURL: process.env.E2E_BASE ?? 'https://habashop.vercel.app',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    trace: 'on-first-retry',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  projects: [
    // 1) Login unique → sauvegarde l'état d'auth (storageState) dans e2e/.auth/user.json.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // 2) Suite : réutilise la session sauvegardée (aucun login par spec → anti rate-limit).
    //    smoke.spec surcharge storageState en interne (tests publics + flux de login réels).
    {
      name: 'chromium',
      use: { browserName: 'chromium', storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
      // ⚠️ Le `testIgnore` de PROJET écrase celui du niveau config : on répète `dev/`.
      testIgnore: [/auth\.setup\.ts/, '**/dev/**'],
    },
  ],

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
})
