import { test as setup, expect } from '@playwright/test'

// UN SEUL login pour toute la suite : on se connecte ici, on sauvegarde l'état
// (localStorage habashop_token + habashop-auth) → les autres specs le réutilisent via
// `storageState` (cf. playwright.config.ts). Évite 1 login/spec = anti rate-limit (10/15min).
const BASE = process.env.E2E_BASE ?? 'https://habashop.vercel.app'
const authFile = 'e2e/.auth/user.json'

setup('authentifie une fois et sauvegarde la session', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@habashop.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 })
  // Garantit un VRAI JWT en localStorage (pas un état partiel) avant sauvegarde.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('habashop_token')), { timeout: 10000 })
    .toBeTruthy()
  await page.context().storageState({ path: authFile })
})
