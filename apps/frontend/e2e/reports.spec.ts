import { test, expect } from '@playwright/test'

const BASE = process.env.REPORTS_BASE ?? 'https://habashop.vercel.app'

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@habashop.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/dashboard/, { timeout: 12000 })
}

test('Reports — all 5 tabs render (charts incl.), no errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await login(page)
  await page.goto(`${BASE}/app/reports`)

  // Default tab = Ventes: donut + area chart render (charts use the moved render helpers)
  await expect(page.getByText(/Répartition paiements|Payment breakdown/).first()).toBeVisible({ timeout: 12000 })
  await expect(page.locator('.recharts-surface').first()).toBeVisible()

  // Stock
  await page.getByRole('button', { name: /^Stock$/ }).first().click()
  await expect(page.getByText(/Rotation des stocks|Stock rotation/).first()).toBeVisible({ timeout: 5000 })

  // Clients
  await page.getByRole('button', { name: /^Clients$|^Customers$/ }).first().click()
  await expect(page.getByText(/Segments clients|Customer segments/).first()).toBeVisible({ timeout: 5000 })

  // Finance
  await page.getByRole('button', { name: /^Finance$/ }).first().click()
  await expect(page.getByText(/Compte de résultat|P&L summary/).first()).toBeVisible({ timeout: 5000 })

  // RH
  await page.getByRole('button', { name: /^RH$|^HR$/ }).first().click()
  await expect(page.getByText(/Masse salariale|Payroll total/).first()).toBeVisible({ timeout: 5000 })

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})
