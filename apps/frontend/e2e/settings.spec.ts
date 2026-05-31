import { test, expect } from '@playwright/test'

const BASE = process.env.SETTINGS_BASE ?? 'https://habashop.vercel.app'

async function login(page: import('@playwright/test').Page) {
  // Auth via storageState (projet `setup`) → aucun login UI. Chaque test enchaîne avec UN SEUL
  // page.goto(`/app/...`) : pas de double navigation (qui annulerait le /me de montage →
  // catch(logout) → effacement du token → bounce /login).
  void page
}

// Drives all 6 settings sections (read-only nav). No destructive actions (no Reset/Save).
test('Settings — all 6 sections render', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await login(page)
  await page.goto(`${BASE}/app/settings`)

  // Default section = Shop
  await expect(page.getByText(/Informations boutique|Shop information/).first()).toBeVisible({ timeout: 12000 })

  // POS
  await page.getByRole('button', { name: /Config POS|POS Config/ }).first().click()
  await expect(page.getByText(/Configuration POS|POS Configuration/).first()).toBeVisible({ timeout: 5000 })

  // Lang & Currency
  await page.getByRole('button', { name: /Langue & Devise|Language & Currency/ }).first().click()
  // Libellé actuel = « Devise de la boutique » (anciennement « Devise d'affichage » — assertion réalignée).
  await expect(page.getByText(/Devise de la boutique|Shop currency/).first()).toBeVisible({ timeout: 5000 })
  await expect(page.getByText(/Apparence|Appearance/).first()).toBeVisible()

  // Notifications — target the nav button by its unique description (avoids the header bell)
  await page.getByRole('button', { name: /Alertes & rapports|Alerts & reports|Alertas & reportes|Avvisi & rapporti/ }).first().click()
  await expect(page.getByText(/Alertes rupture stock|Stock shortage alerts/).first()).toBeVisible({ timeout: 5000 })

  // Security
  await page.getByRole('button', { name: /Accès & sessions|Access & sessions|Acceso & sesiones|Accesso & sessioni/ }).first().click()
  await expect(page.getByText(/Sécurité & Accès|Security & Access/).first()).toBeVisible({ timeout: 5000 })

  // Documents
  await page.getByRole('button', { name: /Exports & config|Exportar & config|Esporta & config/ }).first().click()
  await expect(page.getByText(/Documents & Configuration|Documentos & Configuración/).first()).toBeVisible({ timeout: 5000 })

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})
