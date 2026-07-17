import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Captures écran 2 (item 11 — feuille Encaissement) vs maquette 02-encaissement.view.html.
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = 'e2e/screenshots/item11'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])

const PRODUCTS = [
  { id: 'p1', name: 'Café soluble 200g', sellPrice: 2800, category: 'grocery', emoji: '☕', stockQty: 64 },
  { id: 'p3', name: 'Huile palme 1L',    sellPrice: 1800, category: 'fat',     emoji: '🫙', stockQty: 12 },
  { id: 'p5', name: 'Riz parfumé 5kg',   sellPrice: 4500, category: 'cereals', emoji: '🍚', stockQty: 120 },
]

async function preparePage(ctx, { theme = 'dark', offline = false } = {}) {
  const page = await ctx.newPage()
  await page.addInitScript(({ authLS, theme }) => {
    for (const { name, value } of authLS) localStorage.setItem(name, value)
    localStorage.setItem('habashop-config', JSON.stringify({ state: { theme, lang: 'fr', currency: 'XOF', requireCashier: false, cashierForcedClosed: false, enableLoyalty: true }, version: 0 }))
  }, { authLS, theme })
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/tenant', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"requireCashier":false}' }))
  await page.route('**/api/products', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS) }))
  await page.route('**/api/payments/paydunya/config', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }))
  await page.route(u => u.pathname.endsWith('/api/customers') && u.searchParams.has('search'),
    r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'c1', name: 'Awa Diop', tier: 'Silver' }]) }))
  await page.route('**/api/customers/c1/loyalty', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ points: 340, tier: 'Silver', silverDiscount: 5, history: [] }) }))
  await page.route('**/health', r => offline ? r.abort() : r.fulfill({ status: 200, body: '{"ok":true}' }))
  return page
}

async function openSheet(page) {
  await page.getByRole('button', { name: /Café soluble.*—/ }).first().waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: /Café soluble.*—/ }).first().click()
  await page.getByRole('button', { name: /Café soluble.*—/ }).first().click()
  await page.getByRole('button', { name: /Huile palme.*—/ }).first().click()
  await page.getByRole('button', { name: /Riz parfumé.*—/ }).first().click()
  await page.getByPlaceholder(/Ajouter un client/).fill('Aw')
  await page.getByText('Awa Diop', { exact: true }).click()
  await page.getByText(/Argent|Silver/).first().waitFor({ timeout: 5000 }).catch(() => {})
  await page.getByRole('button', { name: /^Encaisser$/ }).click()
  await page.locator('[role="dialog"]').waitFor({ timeout: 8000 })
}

const browser = await chromium.launch()

// ── Maquette 02 (référence) ──
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 760 } })
  const page = await ctx.newPage()
  await page.goto('file://' + process.cwd() + '/../../docs/ux-mockups/02-encaissement.view.html')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/maquette-02-encaissement.png`, fullPage: true })
  await ctx.close()
}

// ── Desktop : Espèces, 12 000 reçu → rendu 695 ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx)
  await page.goto(`${BASE}/app/pos`)
  await openSheet(page)
  await page.getByLabel(/Montant reçu du client/).fill('12000')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/enc-desktop-especes.png` })
  // Variante Mixte
  await page.getByRole('button', { name: /^Mixte$/ }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/enc-desktop-mixte.png` })
  await ctx.close()
}

// ── Mobile 390 : feuille Espèces ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx)
  await page.goto(`${BASE}/app/pos`)
  await page.getByRole('button', { name: /Café soluble.*—/ }).first().waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: /Café soluble.*—/ }).first().click()
  await page.getByRole('button', { name: /Panier/ }).first().click()
  await page.getByRole('button', { name: /^Encaisser$/ }).click()
  await page.locator('[role="dialog"]').waitFor({ timeout: 8000 })
  await page.getByLabel(/Montant reçu du client/).fill('3000')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/enc-mobile-especes.png` })
  await ctx.close()
}

// ── Thème clair ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx, { theme: 'light' })
  await page.goto(`${BASE}/app/pos`)
  await openSheet(page)
  await page.getByLabel(/Montant reçu du client/).fill('12000')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/enc-desktop-light.png` })
  await ctx.close()
}

await browser.close()
console.log('OK — captures écran 2 dans', OUT)
