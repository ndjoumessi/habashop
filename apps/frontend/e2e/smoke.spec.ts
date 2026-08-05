import { test, expect } from '@playwright/test'
import { loginViaUI } from './helpers/auth'

const BASE = 'https://habashop.vercel.app'

// Smoke = parcours PUBLICS + flux de login RÉELS → on ignore la session partagée
// (storageState du projet) et on part déconnecté. Les tests connectés d'ici se loguent eux-mêmes.
test.use({ storageState: { cookies: [], origins: [] } })

// NOTE : les tests connectés font un login UI réel. Le endpoint /api/auth/login
// est rate-limité (10 / 15 min par IP) → éviter de relancer la suite en rafale.

test.describe('HabaShop — Smoke Tests', () => {
  test('Landing page se charge', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveTitle(/HabaShop/)
    await expect(page.locator('text=HabaShop').first()).toBeVisible()
  })

  // ⚠️ Les libellés de plan ont changé au 2026-08-06 : /pricing portait sa PROPRE grille
  // (Starter / Pro / Enterprise à 9 900 / 24 900 / 49 900) pendant que la vitrine en
  // affichait une autre. Elle réutilise désormais la grille unique — Starter / Business /
  // Enterprise. Ce test échouera donc tant que la prod sert l'ancienne page : il est le
  // signal de déploiement, pas un faux positif.
  test('Page pricing accessible', async ({ page }) => {
    await page.goto(`${BASE}/pricing`)
    await expect(page.locator('text=Starter').first()).toBeVisible()
    await expect(page.locator('text=Business').first()).toBeVisible()
    await expect(page.locator('text=Enterprise').first()).toBeVisible()
    // La recommandation est un avis, pas une affirmation sur d'autres acheteurs.
    await expect(page.locator('text=Recommandé').first()).toBeVisible()
    await expect(page.locator('text=/plus populaire/i')).toHaveCount(0)
  })

  test('Login page accessible', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('Login avec compte démo', async ({ page }) => {
    await loginViaUI(page, BASE)
    expect(page.url()).toContain('/app/dashboard')
  })

  test('Dashboard charge les KPIs', async ({ page }) => {
    await loginViaUI(page, BASE)
    await expect(page.locator('[aria-label*="CA"], [class*="kpi"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('Navigation sidebar fonctionne', async ({ page }) => {
    await loginViaUI(page, BASE)
    await page.click('[aria-label*="Stock"], [href*="/stock"]')
    await page.waitForURL(/\/app\/stock/, { timeout: 5000 })
    expect(page.url()).toContain('/app/stock')
  })

  // NB: on navigue par CLIC de lien (nav client-side) et non par page.goto : un rechargement
  // dur (goto/reload) revalide la session côté backend et, sur cold start, redirige vers /login.
  test('Page POS accessible', async ({ page }) => {
    await loginViaUI(page, BASE)
    await page.click('[href*="/app/pos"]')
    await page.waitForURL(/\/app\/pos/, { timeout: 8000 })
    expect(page.url()).toContain('/app/pos')
    await expect(page.locator('input[type="search"], input[aria-label*="produit"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('Page Settings accessible', async ({ page }) => {
    await loginViaUI(page, BASE)
    await page.click('[href*="/app/settings"]')
    await page.waitForURL(/\/app\/settings/, { timeout: 8000 })
    expect(page.url()).toContain('/app/settings')
  })

  // P0 — le panneau plateforme est réservé aux admins PLATEFORME (isPlatformAdmin),
  // jamais au rôle tenant SUPER_ADMIN. Le compte démo (admin@, SUPER_ADMIN de sa
  // boutique) ne doit donc PLUS voir l'entrée « Admin Panel » ni atteindre /admin.
  test('Panneau plateforme masqué pour un SUPER_ADMIN de tenant', async ({ page }) => {
    await loginViaUI(page, BASE)
    await expect(page.locator('[aria-label="Admin Panel"]')).toHaveCount(0)
  })
})
