import { test, expect } from '@playwright/test'

const BASE = 'https://habashop.vercel.app'

// NOTE : les tests connectés font un login UI réel. Le endpoint /api/auth/login
// est rate-limité (10 / 15 min par IP) → éviter de relancer la suite en rafale.

test.describe('HabaShop — Smoke Tests', () => {
  test('Landing page se charge', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveTitle(/HabaShop/)
    await expect(page.locator('text=HabaShop').first()).toBeVisible()
  })

  test('Page pricing accessible', async ({ page }) => {
    await page.goto(`${BASE}/pricing`)
    await expect(page.locator('text=Starter').first()).toBeVisible()
    await expect(page.locator('text=Pro').first()).toBeVisible()
  })

  test('Login page accessible', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
  })

  test('Login avec compte démo', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', 'admin@habashop.com')
    await page.fill('input[type="password"]', 'demo1234')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/app\/dashboard/, { timeout: 10000 })
    expect(page.url()).toContain('/app/dashboard')
  })

  test('Dashboard charge les KPIs', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', 'admin@habashop.com')
    await page.fill('input[type="password"]', 'demo1234')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/app\/dashboard/, { timeout: 10000 })
    await expect(page.locator('[aria-label*="CA"], [class*="kpi"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('Navigation sidebar fonctionne', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', 'admin@habashop.com')
    await page.fill('input[type="password"]', 'demo1234')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/app\/dashboard/, { timeout: 10000 })
    await page.click('[aria-label*="Stock"], [href*="/stock"]')
    await page.waitForURL(/\/app\/stock/, { timeout: 5000 })
    expect(page.url()).toContain('/app/stock')
  })

  test('Page POS accessible', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', 'admin@habashop.com')
    await page.fill('input[type="password"]', 'demo1234')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/app\/dashboard/, { timeout: 10000 })
    await page.goto(`${BASE}/app/pos`)
    expect(page.url()).toContain('/app/pos')
    await expect(page.locator('input[type="search"], input[aria-label*="produit"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('Page Settings accessible', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', 'admin@habashop.com')
    await page.fill('input[type="password"]', 'demo1234')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/app\/dashboard/, { timeout: 10000 })
    await page.goto(`${BASE}/app/settings`)
    expect(page.url()).toContain('/app/settings')
  })

  test('Super-admin accessible', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"]', 'admin@habashop.com')
    await page.fill('input[type="password"]', 'demo1234')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/app\/dashboard/, { timeout: 10000 })
    await page.goto(`${BASE}/admin`)
    expect(page.url()).toContain('/admin')
  })
})
