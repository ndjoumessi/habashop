import { test, expect } from '@playwright/test'

// Base overridable: prod for baseline, http://localhost:4173 for previewing the refactor.
const BASE = process.env.HR_BASE ?? 'https://habashop.vercel.app'

async function login(page: import('@playwright/test').Page) {
  // Auth via storageState (projet `setup`) → aucun login UI. Chaque test enchaîne avec UN SEUL
  // page.goto(`/app/...`) : pas de double navigation (qui annulerait le /me de montage →
  // catch(logout) → effacement du token → bounce /login).
  void page
}

test('HR — page renders (stats + cards) and edit modal opens', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/app/hr`)

  // Header + KPI bar (HRStatsBar)
  await expect(page.getByRole('heading', { name: /Ressources Humaines|Human Resources/ })).toBeVisible({ timeout: 12000 })
  await expect(page.getByText(/Effectif total|Total staff/).first()).toBeVisible()
  await expect(page.getByText(/Masse salariale|Payroll/).first()).toBeVisible()

  // Employee cards (seed) → click one to open the edit/detail modal
  const card = page.locator('text=/Marie|Kofi|Aminata|Fatoumata|Seydou/').first()
  await card.click()
  await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 })
})

test('HR — tab navigation (Présences / Rémunération)', async ({ page }) => {
  await login(page)
  await page.goto(`${BASE}/app/hr`)
  await expect(page.getByRole('heading', { name: /Ressources Humaines|Human Resources/ })).toBeVisible({ timeout: 12000 })
  await page.getByText(/Rémunération|Payroll/).first().click()
  await expect(page.getByText(/Masse salariale|Payroll/).first()).toBeVisible()
})
