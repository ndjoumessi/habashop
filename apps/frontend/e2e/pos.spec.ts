import { test, expect } from '@playwright/test'

const BASE = process.env.POS_BASE ?? 'https://habashop.vercel.app'

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@habashop.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/dashboard/, { timeout: 12000 })
}

// NB: does NOT complete a checkout (would create a real sale). Verifies render only.
test('POS — open register, grid + cart + discount modal render', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await login(page)
  await page.goto(`${BASE}/app/pos`)

  // Wait for POS to render: either the closed-register screen or the open grid
  const openBtn = page.getByRole('button', { name: /Ouvrir la caisse|Open register/ })
  const discountBtn = page.getByRole('button', { name: /Appliquer une remise/ })
  await openBtn.or(discountBtn).first().waitFor({ timeout: 12000 })

  // Open the cashier if it's closed (local state only)
  if (await openBtn.count() > 0) {
    await page.locator('input[type="number"]').first().fill('50000')
    await openBtn.first().click()
  }

  // POSProductGrid — category chips + client-type/discount bar
  await expect(discountBtn).toBeVisible({ timeout: 12000 })
  await expect(page.getByRole('button', { name: /^Grossiste$/ })).toBeVisible()

  // POSCart — cart panel + checkout button
  await expect(page.getByText(/^Panier$|^Cart$/).first()).toBeVisible()

  // POSModals — discount modal
  await page.getByRole('button', { name: /Appliquer une remise/ }).click()
  await expect(page.getByText(/Type de remise/).first()).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /^Annuler$/ }).first().click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 5000 })

  // POSProductGrid — history tab
  await page.getByRole('button', { name: /^Historique$|^History$/ }).first().click()
  await page.waitForTimeout(400)

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})
