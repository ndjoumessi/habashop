import { test, expect } from '@playwright/test'

const BASE = process.env.STOCK_BASE ?? 'https://habashop.vercel.app'

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@habashop.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/dashboard/, { timeout: 12000 })
}

test('Stock — page renders, product/label/category modals open', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await login(page)
  await page.goto(`${BASE}/app/stock`)

  // Header action + categories panel (kept inline) render
  await expect(page.getByRole('button', { name: /Nouveau produit|New product/ })).toBeVisible({ timeout: 12000 })
  await expect(page.getByText(/Gestion des catégories/).first()).toBeVisible({ timeout: 5000 })

  // Product modal (StockModals) — tabs render
  await page.getByRole('button', { name: /Nouveau produit|New product/ }).first().click()
  await expect(page.getByText(/Prix & Stock/).first()).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /^Annuler$|^Cancel$/ }).first().click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 5000 })

  // Label modal (StockModals) — from the inventory toolbar (StockInventory)
  await page.getByRole('button', { name: /Étiquettes|Labels/ }).first().click()
  await expect(page.getByText(/Imprimer des étiquettes|Print labels/).first()).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /^Annuler$|^Cancel$/ }).first().click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 5000 })

  // Category modal (StockModals) — from inline categories panel button
  await page.getByRole('button', { name: /Nouvelle catégorie|New category/ }).first().click()
  await expect(page.getByText(/Nom de la catégorie/).first()).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /^Annuler$|^Cancel$/ }).first().click()

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})
