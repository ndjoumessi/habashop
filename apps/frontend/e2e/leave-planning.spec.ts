import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'https://habashop.vercel.app'

// Phase 6 : les congés passent désormais par l'API (/api/leave-requests). Soumettre = POST,
// Approuver = POST /:id/approve (le BACKEND crée le Shift Congé + l'Attendance LEAVE via
// eachDateInclusive). Le frontend n'écrit plus dans le localStorage planning → ce test vérifie
// le flux UI création + approbation (statut → Approuvé) et les appels API correspondants.
// ⚠️ Crée une vraie demande sur le tenant démo (pas de route DELETE leave → accumulation assumée).
// NOTE : /api/auth/login rate-limité (10 / 15 min / IP) → un seul login.
test('Congé : création + approbation via API → statut Approuvé', async ({ page }) => {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@habashop.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 })

  // HR → onglet Congés
  await page.goto(`${BASE}/app/hr`)
  await expect(page.getByRole('heading', { name: /Ressources Humaines|Human Resources/ })).toBeVisible({ timeout: 15000 })
  await page.getByText(/^Congés$|^Leaves$/).first().click()

  // Nouvelle demande → remplir → Soumettre (POST /api/leave-requests)
  await page.getByText(/Nouvelle demande|New request/).first().click()
  const empSelect = page.locator('select[aria-label="EMPLOYÉ"], select[aria-label="EMPLOYEE"]').first()
  await expect(empSelect).toBeVisible({ timeout: 5000 })
  await empSelect.selectOption({ label: 'Fatoumata Ndiaye' })
  await page.locator('input[aria-label="DU"], input[aria-label="FROM"]').first().fill('2026-06-01')
  await page.locator('input[aria-label="AU"], input[aria-label="TO"]').first().fill('2026-06-03')
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/leave-requests') && r.request().method() === 'POST', { timeout: 15000 }),
    page.getByRole('button', { name: /Soumettre|Submit/ }).click(),
  ])

  // La demande créée (en attente, en tête de liste) → Approuver (POST /:id/approve)
  const approveBtn = page.getByRole('button', { name: /Approuver|Approve/ }).first()
  await expect(approveBtn).toBeVisible({ timeout: 8000 })
  await Promise.all([
    page.waitForResponse(r => /\/api\/leave-requests\/[^/]+\/approve/.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 }),
    approveBtn.click(),
  ])

  // Statut → Approuvé (le backend a aussi créé Shift Congé + Attendance LEAVE côté serveur).
  await expect(page.getByText(/Approuvé|Approved/).first()).toBeVisible({ timeout: 8000 })
})
