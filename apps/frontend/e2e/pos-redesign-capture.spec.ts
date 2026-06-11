import { test } from '@playwright/test'

// Capture before/after du redesign POS — dark (thème device par défaut) + Mode soleil.
// N'effectue AUCUN encaissement (pas de vente créée) ; la caisse ouverte + panier sont
// des états locaux au device (appStore persisté dans le contexte éphémère du test).
const BASE = process.env.POS_BASE ?? 'https://habashop.vercel.app'
const TAG = process.env.SHOT_TAG ?? 'before'

test.use({ viewport: { width: 1440, height: 900 } })

test(`POS captures ${TAG} — dark + soleil`, async ({ page }) => {
  await page.goto(`${BASE}/app/pos`)

  const openBtn = page.getByRole('button', { name: /Ouvrir la caisse|Open register/ })
  const discountBtn = page.getByRole('button', { name: /Appliquer une remise/ })
  await openBtn.or(discountBtn).first().waitFor({ timeout: 15000 })
  if (await openBtn.count() > 0) {
    await page.locator('input[type="number"]').first().fill('50000')
    await openBtn.first().click()
  }
  await discountBtn.waitFor({ timeout: 15000 })

  // Attendre la grille produits puis ajouter 2 articles pour un panier non vide
  const tiles = page.locator('[role="button"][aria-label*="—"], .pos-tile')
  await tiles.first().waitFor({ timeout: 15000 }).catch(() => {})
  const n = await tiles.count()
  if (n > 0) await tiles.nth(0).click()
  if (n > 1) await tiles.nth(1).click()
  if (n > 1) await tiles.nth(1).click()
  await page.waitForTimeout(600)

  await page.screenshot({ path: `e2e/screenshots/pos-${TAG}-dark.png` })

  // Mode soleil via le toggle header (état device-local, aucune pollution tenant)
  const sunBtn = page.locator('button[aria-pressed]:has(svg.lucide-sun)').first()
  await sunBtn.click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `e2e/screenshots/pos-${TAG}-soleil.png` })
})
