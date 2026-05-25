import { test, expect } from '@playwright/test'

const BASE = process.env.CUST_BASE ?? 'https://habashop.vercel.app'

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@habashop.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/dashboard/, { timeout: 12000 })
}

test('Customers — page renders, tabs switch, new-customer modal opens', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await login(page)
  await page.goto(`${BASE}/app/customers`)

  // Header action present
  await expect(page.getByRole('button', { name: /Nouveau client|New customer/ })).toBeVisible({ timeout: 12000 })

  // Stats tab → CustomersStats
  await page.getByRole('button', { name: /^Statistiques$|^Statistics$/ }).first().click()
  await expect(page.getByText(/Répartition par type|Distribution by type/).first()).toBeVisible({ timeout: 5000 })

  // Map tab → inline wiring + CustomerMap
  await page.getByRole('button', { name: /^Carte$|^Map$|^Mapa$|^Mappa$/ }).first().click()
  await expect(page.getByText(/Carte des clients|Customer map/).first()).toBeVisible({ timeout: 5000 })

  // Back to list → CustomersList renders
  await page.getByRole('button', { name: /^Liste$|^List$|^Lista$|^Elenco$/ }).first().click()
  await expect(page.locator('input[placeholder*="Nom"], input[placeholder*="Name"], input[placeholder*="Nombre"], input[placeholder*="Nome"]').first()).toBeVisible({ timeout: 5000 })

  // New-customer modal → CustomersModals
  await page.getByRole('button', { name: /Nouveau client|New customer/ }).first().click()
  await expect(page.getByText(/NOM \/ ENSEIGNE|NAME \/ COMPANY/).first()).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /Annuler|Cancel/ }).first().click()

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})
