import { test, expect } from '@playwright/test'

const BASE = process.env.CUST_BASE ?? 'https://habashop.vercel.app'

// Vérif live du redesign LoyaltyCardDigital (2 zones par palier) : on intercepte
// /loyalty-card côté client pour rendre les 3 paliers sans toucher la data prod.
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

test('Carte fidélité numérique — rendu des 3 paliers + captures', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  let current: (typeof TIERS)[number] = TIERS[0]
  await page.route('**/api/customers/*/loyalty-card', route =>
    route.fulfill({ json: { ...baseCard, ...current } }))

  await page.goto(`${BASE}/app/customers`)
  await expect(page.getByRole('button', { name: /Nouveau client|New customer/ })).toBeVisible({ timeout: 15000 })

  for (const t of TIERS) {
    current = t
    await page.locator('button[title="Carte numérique"], button[title="Digital card"]').first().click()

    // Zone haute : label + nom boutique + badge palier localisé
    const modal = page.locator('.modal-box').last()
    await expect(modal.getByText('Superette Plateau')).toBeVisible({ timeout: 8000 })
    const tierFr = t.tier === 'Bronze' ? 'Bronze' : t.tier === 'Silver' ? 'Argent' : 'Or'
    await expect(modal.getByText(tierFr, { exact: true })).toBeVisible()
    await expect(modal.getByText(`HS-${baseCard.customerId.slice(0, 8).toUpperCase()}`)).toBeVisible()
    // Zone basse : progression + stats
    if (t.nextTier) {
      const nextFr = t.nextTier === 'Gold' ? 'Or' : 'Argent'
      await expect(modal.getByText(`${tierFr} → ${nextFr}`)).toBeVisible()
    } else {
      await expect(modal.getByText(/Palier maximum atteint/)).toBeVisible()
    }
    await expect(modal.getByText(/Total achats/)).toBeVisible()
    await expect(modal.getByText(/Valeur dispo\./)).toBeVisible()
    // QR rendu (fond blanc, généré async)
    await expect(modal.locator('img[alt="QR"]')).toBeVisible()

    await page.waitForTimeout(600) // settle animation avant capture
    await modal.screenshot({ path: `playwright-report/loyalty-card-${t.tier.toLowerCase()}.png` })

    await modal.getByRole('button', { name: /Fermer|Close/ }).click()
    await expect(modal).not.toBeVisible()
  }

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})
