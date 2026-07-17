import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Captures écran 1 (item 11 — POS principal) sur le build local `vite preview`.
// Desktop + mobile étroit + variante hors-ligne, API mockée (aucune vente réelle).
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = 'e2e/screenshots/item11'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])
const authState = JSON.parse(authLS.find(e => e.name === 'habashop-auth')?.value || '{}')
const USER = authState?.state?.user ?? { name: 'Admin', role: 'ADMIN', shopName: 'HabaShop — Dakar Central' }
if (!USER.shopName) USER.shopName = 'HabaShop — Dakar Central'

const PRODUCTS = [
  { id: 'p1',  name: 'Riz parfumé 5kg',    sellPrice: 4500, category: 'cereals', emoji: '🌾', stockQty: 120 },
  { id: 'p2',  name: 'Huile palme 1L',     sellPrice: 1800, category: 'fat',     emoji: '🫙', stockQty: 12, hasPromotion: true, promotionPrice: 1500, promotionEnd: '2027-01-01T00:00:00Z' },
  { id: 'p3',  name: 'Sucre 1kg',          sellPrice: 850,  category: 'grocery', emoji: '🍚', stockQty: 245 },
  { id: 'p4',  name: 'Farine blé 1kg',     sellPrice: 650,  category: 'cereals', emoji: '🌾', stockQty: 89 },
  { id: 'p5',  name: 'Savon 500g',         sellPrice: 500,  category: 'hygiene', emoji: '🧼', stockQty: 8 },
  { id: 'p6',  name: 'Lait poudre 400g',   sellPrice: 2200, category: 'dairy',   emoji: '🥛', stockQty: 67 },
  { id: 'p7',  name: 'Tomate conc. 800g',  sellPrice: 1400, category: 'canned',  emoji: '🍅', stockQty: 0 },
  { id: 'p8',  name: 'Huile végétale 5L',  sellPrice: 8500, category: 'fat',     emoji: '🫒', stockQty: 34 },
  { id: 'p9',  name: 'Café soluble 200g',  sellPrice: 2800, category: 'grocery', emoji: '☕', stockQty: 15 },
  { id: 'p10', name: 'Sardines 155g',      sellPrice: 900,  category: 'canned',  emoji: '🐟', stockQty: 200 },
]

async function preparePage(ctx, { offline } = {}) {
  const page = await ctx.newPage()
  await page.addInitScript(({ authLS }) => {
    try {
      for (const { name, value } of authLS) localStorage.setItem(name, value)
      // Caisse ouverte sans cérémonie : requireCashier=false + pas de fermeture forcée.
      const raw = localStorage.getItem('habashop-config')
      const o = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      o.state = { ...(o.state || {}), theme: 'dark', lang: 'fr', currency: 'XOF', requireCashier: false, cashierForcedClosed: false }
      localStorage.setItem('habashop-config', JSON.stringify(o))
    } catch {}
  }, { authLS })
  // Générique d'abord (Playwright matche en ordre INVERSE d'enregistrement → les spécifiques gagnent).
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  await page.route('**/api/tenant', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requireCashier: false, name: USER.shopName }) }))
  await page.route('**/api/products', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS) }))
  await page.route('**/api/payments/paydunya/config', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: false }) }))
  // customersApi.search = GET /api/customers?search=… (prédicat : '?' est un métachar de glob)
  await page.route(u => u.pathname.endsWith('/api/customers') && u.searchParams.has('search'),
    r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'c1', name: 'Awa Diop', phone: '+221 77 000 00 00', tier: 'Bronze' }]) }))
  await page.route('**/api/customers/c1/loyalty', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ points: 340, tier: 'Bronze', bronzeDiscount: 5, history: [] }) }))
  // Statut réseau : /health forcé OK (en ligne) ou coupé (hors-ligne).
  await page.route('**/health', r => offline ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }))
  return page
}


// Le focus des champs du bas fait défiler le conteneur AppLayout (bannière d'essai
// au-dessus du POS) → on remonte tout scroll avant chaque capture.
async function resetScroll(page) {
  await page.evaluate(() => { document.querySelectorAll('*').forEach(el => { if (el.scrollTop) el.scrollTop = 0 }); window.scrollTo(0, 0) })
}

async function fillCart(page) {
  // .first() : une fois au panier, le stepper « Retirer <produit> » matche aussi le nom.
  await page.getByRole('button', { name: /Riz parfumé.*—/ }).first().click()
  await page.getByRole('button', { name: /Riz parfumé.*—/ }).first().click()
  await page.getByRole('button', { name: /Huile palme.*—/ }).first().click()
  await page.getByRole('button', { name: /Café soluble.*—/ }).first().click()
}

async function linkCustomer(page) {
  await page.getByPlaceholder(/Ajouter un client/).fill('Aw')
  await page.getByText('Awa Diop', { exact: true }).click()
  await page.getByText(/Bronze · −5%/).waitFor({ timeout: 5000 }).catch(() => {})
}

const browser = await chromium.launch()

// ── Desktop 1440×900 ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx)
  await page.goto(`${BASE}/app/pos`)
  await page.getByRole('button', { name: /Riz parfumé/ }).waitFor({ timeout: 20000 })
  await fillCart(page)
  await linkCustomer(page)
  await page.waitForTimeout(600)
  console.log('desktop header count:', await page.locator('[data-testid="pos-header"]').count(),
    'box:', JSON.stringify(await page.locator('[data-testid="pos-header"]').boundingBox().catch(() => null)))
  await resetScroll(page)
  await page.screenshot({ path: `${OUT}/pos-item11-desktop.png` })
  await ctx.close()
}

// ── Mobile étroit 390×844 : vue produits puis vue panier ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx)
  await page.goto(`${BASE}/app/pos`)
  await page.getByRole('button', { name: /Riz parfumé/ }).waitFor({ timeout: 20000 })
  await fillCart(page)
  await page.waitForTimeout(400)
  await resetScroll(page)
  await page.screenshot({ path: `${OUT}/pos-item11-mobile-produits.png` })
  await page.getByRole('button', { name: /Panier/ }).first().click()
  await linkCustomer(page)
  await page.waitForTimeout(400)
  await resetScroll(page)
  await page.screenshot({ path: `${OUT}/pos-item11-mobile-panier.png` })
  await ctx.close()
}

// ── Desktop hors-ligne : badge ambre + modes non-cash désactivés ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx, { offline: true })
  await page.goto(`${BASE}/app/pos`)
  await page.getByRole('button', { name: /Riz parfumé/ }).waitFor({ timeout: 20000 })
  await fillCart(page)
  await page.getByText(/Hors-ligne/).first().waitFor({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(400)
  await resetScroll(page)
  await page.screenshot({ path: `${OUT}/pos-item11-desktop-offline.png` })
  await ctx.close()
}

await browser.close()
console.log('OK — captures dans', OUT)
