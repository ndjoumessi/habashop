import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Captures page Clients (audit UI/UX + P0 fidélité) — AVANT/APRÈS, dark + light.
// PHASE=avant|apres · LOYALTY=0|1 (état programme fidélité du tenant mocké)
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const PHASE = process.env.PHASE ?? 'apres'
const OUT = 'e2e/screenshots/customers-uiux'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])

const CUSTOMERS = [
  { id: 'c1', name: 'Awa Diop',      type: 'Fidèle',    phone: '+221 77 123 45 67', email: 'awa@ex.sn',  address: 'Plateau, Dakar',  loyaltyPoints: 1240, totalRevenue: 812000,  createdAt: '2025-11-03', lastPurchaseAt: '2026-07-15', purchasesPerMonth: 6 },
  { id: 'c2', name: 'Moussa Ndiaye', type: 'Grossiste', phone: '+221 76 555 12 12', email: '',           address: 'Pikine, Dakar',   loyaltyPoints: 320,  totalRevenue: 2450000, createdAt: '2026-01-19', lastPurchaseAt: '2026-07-12', purchasesPerMonth: 11 },
  { id: 'c3', name: 'Fatou Sall',    type: 'Détail',    phone: '+221 78 901 22 33', email: 'fs@ex.sn',   address: '',                loyaltyPoints: 45,   totalRevenue: 98000,   createdAt: '2026-05-02', lastPurchaseAt: '2026-06-28', purchasesPerMonth: 2 },
  { id: 'c4', name: 'Ibrahima Ba',   type: 'Semi-gros', phone: '+221 70 444 55 66', email: '',           address: 'Rufisque',        loyaltyPoints: 0,    totalRevenue: 640000,  createdAt: '2026-03-14', lastPurchaseAt: '2026-07-16', purchasesPerMonth: 4 },
]

async function preparePage(ctx, { theme = 'dark', loyalty = false } = {}) {
  const page = await ctx.newPage()
  await page.addInitScript(({ authLS, theme }) => {
    for (const { name, value } of authLS) localStorage.setItem(name, value)
    localStorage.setItem('habashop-config', JSON.stringify({ state: { theme, lang: 'fr', currency: 'XOF', enableLoyalty: false }, version: 0 }))
  }, { authLS, theme })
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/customers', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CUSTOMERS) }))
  await page.route('**/api/tenant', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'demo-tenant-001', name: 'HabaShop — Dakar Central', currency: 'XOF', enableLoyalty: loyalty, plan: 'pro' }) }))
  await page.route('**/api/customers/*/loyalty-card', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ customerId: 'c1', customerName: 'Awa Diop', tier: 'Bronze', points: 1240, nextTier: 'Silver', pointsToNext: 760, bronzeThreshold: 2000, silverThreshold: 5000, shopName: 'HabaShop — Dakar Central', currency: 'XOF', enableLoyalty: true, totalRevenue: 812000, pointsPerAmount: 1000, bronzeDiscount: 5, silverDiscount: 10, goldDiscount: 15 }) }))
  await page.route('**/api/customers/*/loyalty', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ points: 1240, tier: 'Bronze', history: [] }) }))
  await page.route('**/health', r => r.fulfill({ status: 200, body: '{"ok":true}' }))
  return page
}

const browser = await chromium.launch()

for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx, { theme, loyalty: false })
  await page.goto(`${BASE}/app/customers`)
  await page.getByText('Awa Diop').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/${PHASE}-liste-${theme}.png` })

  // Clic action fidélité (programme désactivé) → avant : clic mort ; après : toast explicite
  await page.locator('button[title="Carte fidélité"]').first().click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${PHASE}-fidelite-off-${theme}.png` })

  if (PHASE === 'apres') {
    await page.waitForTimeout(3800) // laisse le toast disparaître
    // Menu Exporter (CSV + PDF)
    await page.getByRole('button', { name: /Exporter/ }).click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/apres-export-menu-${theme}.png` })
    await page.keyboard.press('Escape')
    // Menu « ⋯ » de ligne (devis + supprimer)
    await page.locator('button[title="Plus d’actions"]').first().click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/apres-row-menu-${theme}.png` })
  }
  await ctx.close()
}

// Programme fidélité ACTIVÉ → la carte doit s'ouvrir (dark uniquement)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx, { theme: 'dark', loyalty: true })
  await page.goto(`${BASE}/app/customers`)
  await page.getByText('Awa Diop').first().waitFor({ timeout: 20000 })
  await page.locator('button[title="Carte fidélité"]').first().click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/${PHASE}-fidelite-on-dark.png` })
  await ctx.close()
}

await browser.close()
console.log(`OK — captures ${PHASE} dans ${OUT}`)
