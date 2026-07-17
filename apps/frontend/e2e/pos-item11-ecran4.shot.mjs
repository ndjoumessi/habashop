import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Captures écran 4 (item 11 — Carte fidélité) vs maquette 04-fidelite-carte.view.html.
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = 'e2e/screenshots/item11'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])

const CARD = {
  customerId: 'demo-card-12345678', customerName: 'Awa Diop',
  tier: 'Silver', points: 340, nextTier: 'Gold',
  bronzeThreshold: 200, silverThreshold: 500, pointsToNext: 160,
  shopName: 'Dakar Central', currency: 'XOF', enableLoyalty: true,
  totalRevenue: 812000, pointsPerAmount: 1000,
  bronzeDiscount: 3, silverDiscount: 5, goldDiscount: 10,
}
const LOYALTY = { points: 340, tier: 'Silver', history: [
  { id: 'h1', points: 45, saleId: 's1', amount: 11305, createdAt: '2026-07-15T10:00:00Z' },
  { id: 'h2', points: 30, saleId: 's2', amount: 7200, createdAt: '2026-07-12T10:00:00Z' },
  { id: 'h3', points: -100, reason: 'Remise utilisée', createdAt: '2026-07-08T10:00:00Z' },
] }
const CUSTOMERS = [{ id: 'demo-card-12345678', name: 'Awa Diop', phone: '+221770000000', loyaltyPoints: 340, totalSpent: 812000, createdAt: '2026-01-10T00:00:00Z' }]

async function preparePage(ctx, { theme = 'dark' } = {}) {
  const page = await ctx.newPage()
  await page.addInitScript(({ authLS, theme }) => {
    for (const { name, value } of authLS) localStorage.setItem(name, value)
    localStorage.setItem('habashop-config', JSON.stringify({ state: { theme, lang: 'fr', currency: 'XOF', enableLoyalty: true, tenant: { enableLoyalty: true, name: 'Dakar Central', currency: 'XOF', bronzeThreshold: 200, silverThreshold: 500 } }, version: 0 }))
  }, { authLS, theme })
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/tenant', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"enableLoyalty":true,"name":"Dakar Central","currency":"XOF"}' }))
  await page.route(u => u.pathname.endsWith('/api/customers'), r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CUSTOMERS) }))
  await page.route('**/api/customers/*/loyalty-card', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CARD) }))
  await page.route('**/api/customers/*/loyalty', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LOYALTY) }))
  await page.route('**/health', r => r.fulfill({ status: 200, body: '{"ok":true}' }))
  return page
}

const browser = await chromium.launch()

// ── Maquette 04 (référence) ──
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } })
  const page = await ctx.newPage()
  await page.goto('file://' + process.cwd() + '/../../docs/ux-mockups/04-fidelite-carte.view.html')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/maquette-04-fidelite.png`, fullPage: true })
  await ctx.close()
}

// ── Desktop : carte Silver (état maquette : 340 pts, 160 → Gold) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx)
  await page.goto(`${BASE}/app/customers`)
  await page.locator('button[title="Carte fidélité"], button[title="Loyalty card"]').first().waitFor({ timeout: 20000 })
  await page.locator('button[title="Carte fidélité"], button[title="Loyalty card"]').first().click()
  await page.getByText(/Activité récente/).waitFor({ timeout: 8000 })
  await page.waitForTimeout(600)
  await page.locator('.modal-box').last().screenshot({ path: `${OUT}/fidelite-desktop-silver.png` })
  await ctx.close()
}

// ── Variantes Bronze / Gold ──
for (const [tier, points, nextTier] of [['Bronze', 120, 'Silver'], ['Gold', 780, null]]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx)
  await page.route('**/api/customers/*/loyalty-card', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...CARD, tier, points, nextTier }) }))
  await page.goto(`${BASE}/app/customers`)
  await page.locator('button[title="Carte fidélité"], button[title="Loyalty card"]').first().waitFor({ timeout: 20000 })
  await page.locator('button[title="Carte fidélité"], button[title="Loyalty card"]').first().click()
  await page.getByText(/Palier actuel/).waitFor({ timeout: 8000 })
  await page.waitForTimeout(600)
  await page.locator('.modal-box').last().screenshot({ path: `${OUT}/fidelite-desktop-${String(tier).toLowerCase()}.png` })
  await ctx.close()
}

// ── Thème clair ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx, { theme: 'light' })
  await page.goto(`${BASE}/app/customers`)
  await page.locator('button[title="Carte fidélité"], button[title="Loyalty card"]').first().waitFor({ timeout: 20000 })
  await page.locator('button[title="Carte fidélité"], button[title="Loyalty card"]').first().click()
  await page.getByText(/Activité récente/).waitFor({ timeout: 8000 })
  await page.waitForTimeout(600)
  await page.locator('.modal-box').last().screenshot({ path: `${OUT}/fidelite-desktop-light.png` })
  await ctx.close()
}

await browser.close()
console.log('OK — captures écran 4 dans', OUT)
