import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Preuves cohérence devise POS : modale « Appliquer une remise » (suffixe devise,
// icône Montant fixe) + ligne « dont TVA (x %) · montant » — en XOF ET en EUR.
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = 'e2e/screenshots/currency'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])

const PRODUCTS = [
  { id: 'p1', name: 'Café soluble 200g', sellPrice: 2800, category: 'grocery', emoji: '☕', stockQty: 64 },
  { id: 'p3', name: 'Huile palme 1L',    sellPrice: 1800, category: 'fat',     emoji: '🫙', stockQty: 12 },
  { id: 'p5', name: 'Riz parfumé 5kg',   sellPrice: 4500, category: 'cereals', emoji: '🍚', stockQty: 120 },
]

async function preparePage(ctx, { currency = 'XOF' } = {}) {
  const page = await ctx.newPage()
  await page.addInitScript(({ authLS, currency }) => {
    for (const { name, value } of authLS) localStorage.setItem(name, value)
    localStorage.setItem('habashop-config', JSON.stringify({ state: { theme: 'dark', lang: 'fr', currency, requireCashier: false, cashierForcedClosed: false, posTaxRate: 18 }, version: 0 }))
  }, { authLS, currency })
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/tenant', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"requireCashier":false}' }))
  await page.route('**/api/products', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS) }))
  await page.route('**/api/payments/paydunya/config', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }))
  await page.route('**/health', r => r.fulfill({ status: 200, body: '{"ok":true}' }))
  return page
}

async function fillCart(page) {
  await page.getByRole('button', { name: /Café soluble.*—/ }).first().waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: /Café soluble.*—/ }).first().click()
  await page.getByRole('button', { name: /Café soluble.*—/ }).first().click()
  await page.getByRole('button', { name: /Huile palme.*—/ }).first().click()
  await page.getByRole('button', { name: /Riz parfumé.*—/ }).first().click()
}

const browser = await chromium.launch()

for (const currency of ['XOF', 'EUR']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx, { currency })
  await page.goto(`${BASE}/app/pos`)
  await fillCart(page)

  // ── Modale remise : type « Montant fixe » + valeur saisie (suffixe devise) ──
  await page.getByRole('button', { name: /Appliquer une remise/ }).click()
  await page.locator('[role="dialog"]').waitFor({ timeout: 8000 })
  await page.getByRole('button', { name: /Montant fixe/ }).click()
  await page.getByPlaceholder(/^Ex: 5/).fill(currency === 'XOF' ? '500' : '5')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/remise-${currency.toLowerCase()}.png` })

  // ── Appliquer → ligne remise du panier (fmt partagé) + toast ──
  await page.getByRole('button', { name: /Appliquer la remise/ }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/remise-appliquee-${currency.toLowerCase()}.png` })

  // ── Feuille encaissement : ligne « dont TVA (18 %) · montant » ──
  await page.getByRole('button', { name: /^Encaisser$/ }).click()
  await page.locator('[role="dialog"]').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/tva-${currency.toLowerCase()}.png` })
  await ctx.close()
}

await browser.close()
console.log('OK — captures devise dans', OUT)
