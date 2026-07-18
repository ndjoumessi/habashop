import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = 'e2e/screenshots/price-strike'
const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])
const PRODUCTS = [
  { id: 'p1', name: 'Café soluble 200g', sellPrice: 2800, category: 'grocery', emoji: '☕', stockQty: 64 },
  { id: 'p3', name: 'Riz parfumé 5kg', sellPrice: 4500, wholesalePrice: 4000, category: 'grocery', emoji: '🍚', stockQty: 120 },
  { id: 'p4', name: 'Huile palme 1L', sellPrice: 1800, wholesalePrice: 1500, category: 'grocery', emoji: '🫙', stockQty: 30 },
]
async function run(scanner, cb) {
  const ctx = await chromium.launch().then(b => b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }).then(c => ({ b, c })))
  const page = await ctx.c.newPage()
  await page.addInitScript((a) => {
    for (const { name, value } of a.authLS) localStorage.setItem(name, value)
    localStorage.setItem('habashop-config', JSON.stringify({ state: { theme: 'dark', lang: 'fr', currency: 'XOF', requireCashier: false, cashierForcedClosed: false, posShowStockOnTile: true, enableScanner: a.scanner }, version: 0 }))
  }, { authLS, scanner })
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/tenant', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requireCashier: false, enableScanner: scanner }) }))
  await page.route('**/api/products', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS) }))
  await page.route('**/api/payments/paydunya/config', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }))
  await page.route('**/health', r => r.fulfill({ status: 200, body: '{"ok":true}' }))
  await page.goto(`${BASE}/app/pos`)
  await page.getByRole('button', { name: /Café soluble.*—/ }).first().waitFor({ timeout: 25000 })
  await page.waitForTimeout(500)
  await cb(page)
  await ctx.b.close()
}
await run(true, async (page) => {
  await page.screenshot({ path: `${OUT}/header-scan-on.png`, clip: { x: 470, y: 38, width: 560, height: 56 } })
})
await run(false, async (page) => {
  await page.screenshot({ path: `${OUT}/header-scan-off.png`, clip: { x: 470, y: 38, width: 560, height: 56 } })
  await page.getByRole('button', { name: /^Grossiste$/ }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/tarif-mention-wholesale.png`, clip: { x: 230, y: 148, width: 770, height: 300 } })
})
console.log('OK header+tarif')
