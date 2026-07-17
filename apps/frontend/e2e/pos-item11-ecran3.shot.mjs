import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Captures écran 3 (item 11 — Clôture / Ticket Z) vs maquette 03-cloture-ticketz.view.html.
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = 'e2e/screenshots/item11'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])

const now = new Date().toISOString()
const DAY_SALES = [
  { id: 's1', paymentMode: 'cash',   total: 124500, createdAt: now, status: 'completed', items: [] },
  { id: 's2', paymentMode: 'wave',   total: 86000,  createdAt: now, status: 'completed', items: [] },
  { id: 's3', paymentMode: 'orange', total: 42000,  createdAt: now, status: 'completed', items: [] },
  { id: 's4', paymentMode: 'mtn',    total: 18500,  createdAt: now, status: 'completed', items: [] },
]
const PRODUCTS = [{ id: 'p1', name: 'Riz parfumé 5kg', sellPrice: 4500, category: 'cereals', emoji: '🍚', stockQty: 120 }]

async function preparePage(ctx, { theme = 'dark' } = {}) {
  const page = await ctx.newPage()
  await page.addInitScript(({ authLS, theme }) => {
    for (const { name, value } of authLS) localStorage.setItem(name, value)
    // requireCashier=true → cérémonie d'ouverture (fond 50 000 saisi via l'UI)
    localStorage.setItem('habashop-config', JSON.stringify({ state: { theme, lang: 'fr', currency: 'XOF', requireCashier: true, posDefaultFund: 50000 }, version: 0 }))
  }, { authLS, theme })
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/tenant', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"requireCashier":true}' }))
  await page.route('**/api/products', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS) }))
  await page.route(u => u.pathname.endsWith('/api/sales') , r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DAY_SALES) }))
  await page.route('**/health', r => r.fulfill({ status: 200, body: '{"ok":true}' }))
  return page
}

async function openRegisterThenClose(page, counted) {
  // Écran d'ouverture (miroir simplifié) : fond pré-rempli posDefaultFund → Ouvrir
  await page.getByRole('button', { name: /Ouvrir la caisse/ }).waitFor({ timeout: 20000 })
  await page.locator('input[type="number"]').first().fill('50000')
  await page.getByRole('button', { name: /Ouvrir la caisse/ }).click()
  // Pill « Caisse ouverte » → feuille de clôture
  await page.getByTestId('pos-cashier-pill').click()
  await page.locator('[role="dialog"]').waitFor({ timeout: 8000 })
  await page.getByText(/Ventes par mode/i).waitFor({ timeout: 8000 }).catch(() => {})
  if (counted != null) {
    await page.locator('#counted-amount').fill(String(counted))
    await page.waitForTimeout(300)
  }
}

const browser = await chromium.launch()

// ── Maquette 03 (référence) ──
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 760 } })
  const page = await ctx.newPage()
  await page.goto('file://' + process.cwd() + '/../../docs/ux-mockups/03-cloture-ticketz.view.html')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/maquette-03-ticketz.png`, fullPage: true })
  await ctx.close()
}

// ── Desktop : écart −500 (ambre) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx)
  await page.goto(`${BASE}/app/pos`)
  await openRegisterThenClose(page, 174000)
  await page.screenshot({ path: `${OUT}/ticketz-desktop-ecart.png` })
  // Variante caisse juste (vert)
  await page.locator('#counted-amount').fill('174500')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/ticketz-desktop-juste.png` })
  // Variante écart important (rouge)
  await page.locator('#counted-amount').fill('150000')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/ticketz-desktop-rouge.png` })
  await ctx.close()
}

// ── Mobile 390 ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx)
  await page.goto(`${BASE}/app/pos`)
  await openRegisterThenClose(page, 174000)
  await page.screenshot({ path: `${OUT}/ticketz-mobile.png` })
  await ctx.close()
}

// ── Thème clair ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx, { theme: 'light' })
  await page.goto(`${BASE}/app/pos`)
  await openRegisterThenClose(page, 174000)
  await page.screenshot({ path: `${OUT}/ticketz-desktop-light.png` })
  await ctx.close()
}

await browser.close()
console.log('OK — captures écran 3 dans', OUT)
