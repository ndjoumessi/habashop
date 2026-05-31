import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1, // 1 retry en cas d'échec réseau
  // Backend prod = réplique unique Railway (cold start) → on SÉRIALISE pour ne pas le
  // marteler en parallèle (un /me lent au montage → catch(logout) → bounce /login).
  workers: 1,

  use: {
    baseURL: 'https://habashop.vercel.app',
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
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
})
