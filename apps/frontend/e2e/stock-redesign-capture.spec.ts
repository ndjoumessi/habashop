import { test } from '@playwright/test'

// Capture before/after du redesign Stock — dark (thème device par défaut) + Mode soleil.
// Lecture seule : aucune création/édition de produit.
const BASE = process.env.STOCK_BASE ?? 'https://habashop.vercel.app'
const TAG = process.env.SHOT_TAG ?? 'before'

test.use({ viewport: { width: 1440, height: 900 } })

test(`Stock captures ${TAG} — dark + soleil`, async ({ page }) => {
  await page.goto(`${BASE}/app/stock`)

  // Attendre la table produits (au moins une ligne avec un SKU PRD-)
  await page.getByText(/PRD-\d+/).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)

  await page.screenshot({ path: `e2e/screenshots/stock-${TAG}-dark.png` })

  // Mode soleil via le toggle header (état device-local)
  const sunBtn = page.locator('button[aria-pressed]:has(svg.lucide-sun)').first()
  await sunBtn.click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `e2e/screenshots/stock-${TAG}-soleil.png` })
})
