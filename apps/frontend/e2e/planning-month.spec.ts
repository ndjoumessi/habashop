import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'https://habashop.vercel.app'
const API = process.env.E2E_API ?? 'https://habashop-production.up.railway.app'

// Vue mois Planning (Phase 7) : bascule Semaine/Mois → grille calendaire 6×7. Vérifie le rendu
// du calendrier, la bascule, le drill (clic jour → retour vue semaine), et l'AGRÉGATION
// MULTI-SHIFT (2 types le même jour → 2 pastilles distinctes dans la case).
// Les 2 shifts sont créés/supprimés via l'API (setup/cleanup) pour rester déterministe et propre.
// NOTE : /api/auth/login rate-limité (10 / 15 min / IP) → un seul login.
test('Planning : vue Mois — calendrier 6×7, agrégation multi-shift, drill semaine', async ({ page }) => {
  // Auth via storageState (projet `setup`). UNE SEULE navigation (pas de goto dashboard préalable
  // qui annulerait le /me de montage). On lit le token depuis la page Planning chargée.
  await page.goto(`${BASE}/app/planning`)
  await expect(page.getByRole('button', { name: /Copier|Copy/ })).toBeVisible({ timeout: 15000 })

  // Token JWT réel (depuis localStorage de la page chargée) → appels API directs.
  const token = await page.evaluate(() => localStorage.getItem('habashop_token'))
  expect(token, 'token JWT en localStorage').toBeTruthy()
  const auth = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }

  // Date cible = 18 du mois courant (toujours dans le mois + dans la grille 6×7).
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const target = `${ym}-18`

  // Employé du tenant démo.
  const empRes = await page.request.get(`${API}/api/employees`, { headers: auth })
  expect(empRes.ok()).toBeTruthy()
  const empId: string = (await empRes.json())[0].id

  // Setup : 2 shifts de types DIFFÉRENTS le même jour (multi-shift).
  const createdIds: string[] = []
  for (const shiftTypeKey of ['morning', 'night']) {
    const r = await page.request.post(`${API}/api/shifts`, { headers: auth, data: { employeeId: empId, date: target, shiftTypeKey } })
    expect(r.ok(), `POST shift ${shiftTypeKey}`).toBeTruthy()
    createdIds.push((await r.json()).id)
  }

  try {
    // Bascule vers la vue Mois (le changement de vue refetch les shifts → inclut ceux créés ci-dessus).
    await page.getByRole('button', { name: /^Mois$|^Month$/ }).click()

    // Le calendrier du mois affiche le jour 15 (présent dans tout mois) et masque « Copier ».
    await expect(page.getByText('15', { exact: true }).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /Copier|Copy/ })).toHaveCount(0)

    // Multi-shift : la case du 18 agrège les DEUX types → pastilles « Matin » ET « Nuit » présentes.
    const cell = page.locator(`[data-testid="month-day-${target}"]`)
    await expect(cell).toBeVisible({ timeout: 8000 })
    await expect(cell.locator('[title="Matin"], [title="Morning"]')).toHaveCount(1)
    await expect(cell.locator('[title="Nuit"], [title="Night"]')).toHaveCount(1)

    // Capture pour inspection visuelle.
    await page.screenshot({ path: 'playwright-report/planning-month.png', fullPage: true })

    // Drill : clic sur le 18 → retour vue semaine (« Copier » réapparaît).
    await cell.click()
    await expect(page.getByRole('button', { name: /Copier|Copy/ })).toBeVisible({ timeout: 8000 })
  } finally {
    // Cleanup : supprime les 2 shifts créés (laisse le tenant démo dans son état initial).
    for (const id of createdIds) {
      await page.request.delete(`${API}/api/shifts/${id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
  }
})
