import { test, expect } from '@playwright/test'

const BASE = process.env.STOCK_BASE ?? 'https://habashop.vercel.app'

async function login(page: import('@playwright/test').Page) {
  // Auth via storageState (projet `setup`) → aucun login UI. Chaque test enchaîne avec UN SEUL
  // page.goto(`/app/...`) : pas de double navigation (qui annulerait le /me de montage →
  // catch(logout) → effacement du token → bounce /login).
  void page
}

test('Stock — page renders, product/label modals open', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await login(page)
  await page.goto(`${BASE}/app/stock`)

  // Header action + categories panel (kept inline) render
  await expect(page.getByRole('button', { name: /Nouveau produit|New product/ })).toBeVisible({ timeout: 12000 })
  // ⚠️ Le panneau MONTRE les catégories, il ne les « gère » plus : il affichait six
  // catégories écrites en dur avec des effectifs littéraux, et son CRUD n'était pas persisté.
  await expect(page.getByText(/Catégories du catalogue|Categories in stock/).first()).toBeVisible({ timeout: 5000 })

  // Product modal (StockModals) — tabs render
  await page.getByRole('button', { name: /Nouveau produit|New product/ }).first().click()
  await expect(page.getByText(/Prix & Stock/).first()).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /^Annuler$|^Cancel$/ }).first().click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 5000 })

  // Label modal (StockModals) — from the inventory toolbar (StockInventory)
  await page.getByRole('button', { name: /Étiquettes|Labels/ }).first().click()
  await expect(page.getByText(/Imprimer des étiquettes|Print labels/).first()).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /^Annuler$|^Cancel$/ }).first().click()
  await expect(page.locator('[role="dialog"]')).toHaveCount(0, { timeout: 5000 })

  // ⚠️ La modale « catégorie » a été SUPPRIMÉE : elle collectait couleur, icône et
  // description — trois champs qu'aucun modèle ne stocke — et écrivait dans un `useState`,
  // si bien que la catégorie créée disparaissait au rechargement. Une catégorie naît
  // désormais en saisissant son nom sur un produit. Ce test l'épinglait ; il épingle
  // maintenant son ABSENCE, pour qu'une réintroduction se remarque.
  await expect(page.getByRole('button', { name: /Nouvelle catégorie|New category/ })).toHaveCount(0)

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})
