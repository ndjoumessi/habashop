import { test } from '@playwright/test'

// Capture before/after du redesign Stock — thème sombre (défaut device).
// Lecture seule : aucune création/édition de produit.
const BASE = process.env.STOCK_BASE ?? 'https://habashop.vercel.app'
const TAG = process.env.SHOT_TAG ?? 'before'

test.use({ viewport: { width: 1440, height: 900 } })

test(`Stock captures ${TAG} — dark`, async ({ page }) => {
  await page.goto(`${BASE}/app/stock`)

  // Attendre la table produits (au moins une ligne avec un SKU PRD-)
  await page.getByText(/PRD-\d+/).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)

  await page.screenshot({ path: `e2e/screenshots/stock-${TAG}-dark.png` })
})
