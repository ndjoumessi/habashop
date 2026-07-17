import { test, expect } from '@playwright/test'
import { getPreconditions } from './helpers/preconditions'

const BASE = process.env.POS_BASE ?? 'https://habashop.vercel.app'
const PHASE = process.env.PHASE ?? 'after' // 'before' (prod actuel) | 'after' (après deploy)

test.beforeEach(async () => {
  const pre = await getPreconditions()
  test.skip(!pre.requiresCashierFund, 'tenant démo requireCashier=false (pas de champ fond de caisse) — dette suivie #5')
})

test('POS — champ Montant reçu (captures négatif + états)', async ({ page }) => {
  await page.goto(`${BASE}/app/pos`)

  // Ouvrir la caisse si fermée (état local).
  const openBtn = page.getByRole('button', { name: /Ouvrir la caisse|Open register/ })
  const discountBtn = page.getByRole('button', { name: /Appliquer une remise/ })
  await openBtn.or(discountBtn).first().waitFor({ timeout: 15000 })
  if (await openBtn.count() > 0) {
    await page.locator('input[type="number"]').first().fill('50000')
    await openBtn.first().click()
  }

  // Ajouter un produit au panier (total > 0).
  await page.getByText(/Riz parfumé/).first().click().catch(async () => {
    // fallback : 1er tuile produit
    await page.locator('[style*="cursor: pointer"]').first().click()
  })

  // Item 11 : le champ Montant reçu vit dans la FEUILLE D'ENCAISSEMENT → l'ouvrir.
  await page.getByRole('button', { name: /^Encaisser$|^Checkout$/ }).first().click()

  // S'assurer du mode Espèces (tuile dans la feuille).
  await page.getByRole('button', { name: /^Espèces$|^Cash$/ }).first().click().catch(() => {})

  const field = page.getByPlaceholder(/Montant reçu|Amount received/)
  await expect(field).toBeVisible({ timeout: 8000 })

  // 1) Tentative valeur négative → (before: acceptée -7 / after: clampée à 0)
  await field.fill('-7')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `e2e/screenshots/pos-cash-${PHASE}-negative.png` })

  // 2) Montant insuffisant (1 unité de devise < total)
  await field.fill('')
  await field.fill('1')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `e2e/screenshots/pos-cash-${PHASE}-insufficient.png` })

  // 3) Montant suffisant (couvre largement le total) → monnaie à rendre
  await field.fill('')
  await field.fill('9999')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `e2e/screenshots/pos-cash-${PHASE}-sufficient.png` })
})
