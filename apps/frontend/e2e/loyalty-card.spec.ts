import { test, expect } from '@playwright/test'
import { getPreconditions } from './helpers/preconditions'

// ⚠️ Le service worker PWA peut prendre la main en cours de test et court-circuiter
// page.route() (mock /loyalty-card ignoré → data réelle rendue). On le bloque.
test.use({ serviceWorkers: 'block' })

const BASE = process.env.CUST_BASE ?? 'https://habashop.vercel.app'

// Vérif live du redesign LoyaltyCardDigital (maquette 04 : carte hero teintée
// palier + paliers actuel/prochain + activité) : on intercepte /loyalty-card ET
// /loyalty côté client pour rendre les 3 paliers sans toucher la data prod.
const baseCard = {
  customerId: 'demo-card-12345678',
  customerName: 'Awa Diop',
  bronzeThreshold: 2000,
  silverThreshold: 5000,
  shopName: 'Superette Plateau',
  currency: 'EUR',
  enableLoyalty: true,
  totalRevenue: 812000, // base XOF → converti à l'affichage
  pointsPerAmount: 1000,
  bronzeDiscount: 5, silverDiscount: 10, goldDiscount: 15,
}

const TIERS = [
  { tier: 'Bronze', points: 1240, nextTier: 'Silver', pointsToNext: 760 },
  { tier: 'Silver', points: 3200, nextTier: 'Gold', pointsToNext: 1800 },
  { tier: 'Gold', points: 7450, nextTier: null, pointsToNext: 0 },
] as const

test.beforeEach(async () => {
  const pre = await getPreconditions()
  test.skip(!pre.hasCustomers, 'tenant démo sans clients (pas de bouton « Carte numérique ») — dette suivie #5')
})

test('Carte fidélité numérique — rendu des 3 paliers + captures', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  let current: (typeof TIERS)[number] = TIERS[0]
  await page.route('**/api/customers/*/loyalty-card', route =>
    route.fulfill({ json: { ...baseCard, ...current } }))
  // Activité récente (points serveur) — mock stable pour la capture
  await page.route('**/api/customers/*/loyalty', route =>
    route.fulfill({ json: { points: current.points, tier: current.tier, history: [
      { id: 'h1', points: 45, saleId: 's1', createdAt: '2026-07-15T10:00:00Z' },
      { id: 'h2', points: -100, reason: 'Remise utilisée', createdAt: '2026-07-10T10:00:00Z' },
    ] } }))

  await page.goto(`${BASE}/app/customers`)
  await expect(page.getByRole('button', { name: /Nouveau client|New customer/ })).toBeVisible({ timeout: 15000 })

  for (const t of TIERS) {
    current = t
    await page.locator('button[title="Carte fidélité"], button[title="Loyalty card"]').first().click()

    // Carte hero (maquette 04) : boutique (header modale) + badge palier + points
    const modal = page.locator('.modal-box').last()
    await expect(modal.getByText(/Superette Plateau/)).toBeVisible({ timeout: 8000 })
    const tierFr = t.tier === 'Bronze' ? 'Bronze' : t.tier === 'Silver' ? 'Argent' : 'Or'
    await expect(modal.getByText(tierFr, { exact: true }).first()).toBeVisible()
    // Progression vers le palier suivant (ou palier max)
    if (t.nextTier) {
      const nextFr = t.nextTier === 'Gold' ? 'Or' : 'Argent'
      await expect(modal.getByText(new RegExp(`pts (jusqu.à|to) ${nextFr}`))).toBeVisible()
    } else {
      await expect(modal.getByText(/Palier maximum atteint/)).toBeVisible()
    }
    // Paliers actuel / prochain (remises configurables) + activité points
    await expect(modal.getByText(/Palier actuel/)).toBeVisible()
    await expect(modal.getByText(/Prochain palier/)).toBeVisible()
    await expect(modal.getByText(/Activité récente/)).toBeVisible()
    // QR rendu (fond blanc, généré async)
    await expect(modal.locator('img[alt*="QR"]')).toBeVisible()

    await page.waitForTimeout(600) // settle animation avant capture
    // ⚠️ PAS dans playwright-report/ (le reporter HTML purge le dossier en fin de run).
    await modal.screenshot({ path: `e2e/screenshots/loyalty-card-${t.tier.toLowerCase()}.png` })

    await modal.getByRole('button', { name: /Fermer|Close/ }).click()
    await expect(modal).not.toBeVisible()
  }

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})
