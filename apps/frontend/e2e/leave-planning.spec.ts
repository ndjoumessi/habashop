import { test, expect } from '@playwright/test'

const BASE = 'https://habashop.vercel.app'
const LEAVE_BG = 'rgba(255, 59, 92, 0.12)' // SHIFT_TYPES.leave.bg (cellule "Congé" dans la grille)

// Vérifie en LIVE le BUG 3 : approuver un congé écrit des shifts "Congé" dans le store
// planning (localStorage habashop_shifts) sur les jours couverts, et la grille Planning
// les affiche. Congé Lun→Mer (2026-06-01→03) ⇒ index jours [0,1,2] ⇒ 3 entrées "leave".
// NOTE : /api/auth/login rate-limité (10 / 15 min / IP) → un seul login.
test('Congé approuvé → shifts "Congé" sur le planning', async ({ page }) => {
  // 1) Login démo
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@habashop.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 })

  // Repart d'un planning vierge pour une assertion déterministe
  await page.evaluate(() => localStorage.removeItem('habashop_shifts'))

  // 2) HR → onglet Congés
  await page.goto(`${BASE}/app/hr`)
  await expect(page.getByRole('heading', { name: /Ressources Humaines|Human Resources/ })).toBeVisible({ timeout: 15000 })
  await page.getByText(/^Congés$|^Leaves$/).first().click()

  // 3) Nouvelle demande → remplir → soumettre
  await page.getByText(/Nouvelle demande|New request/).first().click()
  await expect(page.locator('select[aria-label="EMPLOYÉ"], select[aria-label="EMPLOYEE"]').first()).toBeVisible({ timeout: 5000 })
  await page.locator('select[aria-label="EMPLOYÉ"], select[aria-label="EMPLOYEE"]').first().selectOption({ label: 'Fatoumata Ndiaye' })
  await page.locator('input[aria-label="DU"], input[aria-label="FROM"]').first().fill('2026-06-01') // lundi
  await page.locator('input[aria-label="AU"], input[aria-label="TO"]').first().fill('2026-06-03')   // mercredi
  await page.getByRole('button', { name: /Soumettre|Submit/ }).click()

  // 4) La demande apparaît "en attente" → Approuver
  const leaveRow = page.locator('div', { hasText: 'Fatoumata Ndiaye' }).filter({ hasText: /Congé annuel|Annual leave/ }).last()
  await expect(leaveRow).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /Approuver|Approve/ }).first().click()

  // 5) Le store planning a reçu 3 shifts "leave" pour Fatoumata (preuve directe du fix)
  const stored = await page.evaluate(() => localStorage.getItem('habashop_shifts'))
  expect(stored, 'habashop_shifts vide après approbation').toBeTruthy()
  const shifts = JSON.parse(stored!)
  const leaveEntries = Object.values<Record<string, string>>(shifts)
    .flatMap(days => Object.values(days))
    .filter(v => v === 'leave')
  console.log('habashop_shifts après approbation :', stored)
  expect(leaveEntries.length).toBe(3) // index 0,1,2 (Lun,Mar,Mer)

  // 6) La grille Planning affiche les cellules "Congé"
  await page.goto(`${BASE}/app/planning`)
  await expect(page.getByText('Fatoumata', { exact: false }).first()).toBeVisible({ timeout: 15000 })
  // Le store doit avoir survécu au montage de Planning (Planning lit la même clé)
  const stillThere = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('habashop_shifts') ?? '{}')
    return Object.values<Record<string, string>>(s).flatMap(d => Object.values(d)).filter(v => v === 'leave').length
  })
  expect(stillThere).toBe(3)
  // Compte les cellules rendues avec le fond "Congé"
  const leaveCells = await page.evaluate((bg) => {
    return [...document.querySelectorAll('td div')].filter(el => getComputedStyle(el).backgroundColor === bg).length
  }, LEAVE_BG)
  console.log('Cellules "Congé" rendues dans la grille :', leaveCells)
  expect(leaveCells).toBeGreaterThanOrEqual(3)
})
