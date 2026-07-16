import { test as setup, expect } from '@playwright/test'
import { loginViaUI } from './helpers/auth'

// UN SEUL login pour toute la suite : on se connecte ici, on sauvegarde l'état
// (localStorage habashop_token + habashop-auth) → les autres specs le réutilisent via
// `storageState` (cf. playwright.config.ts). Évite 1 login/spec = anti rate-limit (10/15min).
const BASE = process.env.E2E_BASE ?? 'https://habashop.vercel.app'
const authFile = 'e2e/.auth/user.json'

// Compte E2E dédié (SUPER_ADMIN sur `e2e-tenant`, mono-boutique). Surchargeable via env.
// Provisionné par apps/backend/scripts/seed-e2e-tenant.ts (issue #5).
const E2E_EMAIL = process.env.E2E_EMAIL ?? 'e2e@habashop.com'
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'demo1234'

setup('authentifie une fois et sauvegarde la session', async ({ page }) => {
  // e2e@ est mono-boutique → login direct sur le dashboard (loginViaUI ne déclenche pas
  // le sélecteur ; le fallback multi-boutiques reste inoffensif s'il n'apparaît pas).
  await loginViaUI(page, BASE, E2E_EMAIL, E2E_PASSWORD)
  // Garantit un VRAI JWT en localStorage (pas un état partiel) avant sauvegarde.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('habashop_token')), { timeout: 10000 })
    .toBeTruthy()
  await page.context().storageState({ path: authFile })
})
