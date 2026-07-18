import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Captures du prix barré dans les 3 modes tarifaires (Détail/Grossiste/Demi-gros).
// PHASE=avant|apres → dossiers distincts. Produits mixtes : avec / sans tarif de gros.
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const PHASE = process.env.PHASE ?? 'apres'
const OUT = 'e2e/screenshots/price-strike'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])

const PRODUCTS = [
  // Sans tarif de gros distinct → wholesale/semi retombent sur sellPrice (cas du bug « 2 800 2 800 »)
  { id: 'p1', name: 'Café soluble 200g', sellPrice: 2800, category: 'grocery', emoji: '☕', stockQty: 64 },
  { id: 'p2', name: 'Sucre morceaux 1kg', sellPrice: 1200, category: 'grocery', emoji: '🧊', stockQty: 40 },
  // Avec vrais tarifs de gros → écart réel dans les modes Grossiste/Demi-gros
  { id: 'p3', name: 'Riz parfumé 5kg', sellPrice: 4500, wholesalePrice: 4000, semiWholesalePrice: 4250, category: 'grocery', emoji: '🍚', stockQty: 120 },
  { id: 'p4', name: 'Huile palme 1L', sellPrice: 1800, wholesalePrice: 1500, semiWholesalePrice: 1650, category: 'grocery', emoji: '🫙', stockQty: 30 },
]

const MODES = [
  { id: 'retail', label: /^Détail$/ },
  { id: 'wholesale', label: /^Grossiste$/ },
  { id: 'semi', label: /^Demi-gros$/ },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
const page = await ctx.newPage()
await page.addInitScript((authLS) => {
  for (const { name, value } of authLS) localStorage.setItem(name, value)
  localStorage.setItem('habashop-config', JSON.stringify({ state: { theme: 'dark', lang: 'fr', currency: 'XOF', requireCashier: false, cashierForcedClosed: false, posShowStockOnTile: true }, version: 0 }))
}, authLS)
await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
await page.route('**/api/tenant', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"requireCashier":false,"enableScanner":false}' }))
await page.route('**/api/products', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS) }))
await page.route('**/api/payments/paydunya/config', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false}' }))
await page.route('**/health', r => r.fulfill({ status: 200, body: '{"ok":true}' }))

await page.goto(`${BASE}/app/pos`)
await page.getByRole('button', { name: /Café soluble.*—/ }).first().waitFor({ timeout: 25000 })

for (const m of MODES) {
  await page.getByRole('button', { name: m.label }).click()
  await page.waitForTimeout(400)
  // Capture cadrée sur la grille produits (colonne gauche)
  await page.screenshot({ path: `${OUT}/${PHASE}-${m.id}.png`, clip: { x: 230, y: 150, width: 760, height: 460 } })
}

await browser.close()
console.log(`OK — captures ${PHASE} dans ${OUT}`)
