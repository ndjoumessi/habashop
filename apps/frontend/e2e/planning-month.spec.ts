import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'https://habashop.vercel.app'

// Vue mois Planning (Phase 7) : bascule Semaine/Mois → grille calendaire 6×7. Vérifie le rendu
// du calendrier, la bascule, et le drill (clic jour → retour vue semaine).
// NOTE : /api/auth/login rate-limité (10 / 15 min / IP) → un seul login.
test('Planning : bascule vue Mois → calendrier 6×7 + drill vers la semaine', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@habashop.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 })

  await page.goto(`${BASE}/app/planning`)
  // Vue semaine par défaut : le bouton « Copier → suiv. » est présent.
  await expect(page.getByRole('button', { name: /Copier|Copy/ })).toBeVisible({ timeout: 15000 })

  // Bascule vers la vue Mois.
  await page.getByRole('button', { name: /^Mois$|^Month$/ }).click()

  // Le calendrier du mois affiche le jour 15 (présent dans tout mois) et masque « Copier ».
  await expect(page.getByText('15', { exact: true }).first()).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('button', { name: /Copier|Copy/ })).toHaveCount(0)
  // Capture pour inspection visuelle.
  await page.screenshot({ path: 'playwright-report/planning-month.png', fullPage: true })

  // Drill : clic sur le 15 → retour vue semaine (« Copier » réapparaît).
  await page.getByText('15', { exact: true }).first().click()
  await expect(page.getByRole('button', { name: /Copier|Copy/ })).toBeVisible({ timeout: 8000 })
})
