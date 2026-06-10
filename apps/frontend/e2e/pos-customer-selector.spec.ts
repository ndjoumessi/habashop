import { test, expect } from '@playwright/test'

const BASE = process.env.POS_BASE ?? 'https://habashop.vercel.app'

// Caméra factice → le scanner @zxing entre en mode viewfinder (vs fallback erreur).
test.use({
  serviceWorkers: 'block',
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
})

test('POS — sélecteur client inline : recherche + scan QR (captures)', async ({ page }) => {
  // enableLoyalty est une préférence per-device (appStore persisté) → off par défaut dans la session
  // démo. On la force AVANT le 1er goto pour que le chip affiche « · Bronze · −5% » (le suffixe
  // fidélité est gated dessus, comme le badge remise du panier).
  await page.addInitScript(() => {
    try {
      const k = 'habashop-config'
      const raw = localStorage.getItem(k)
      if (raw) { const c = JSON.parse(raw); c.state.enableLoyalty = true; localStorage.setItem(k, JSON.stringify(c)) }
    } catch { /* noop */ }
  })
  await page.goto(`${BASE}/app/pos`)

  // Ouvrir la caisse si fermée (état local).
  const openBtn = page.getByRole('button', { name: /Ouvrir la caisse|Open register/ })
  const discountBtn = page.getByRole('button', { name: /Appliquer une remise/ })
  await openBtn.or(discountBtn).first().waitFor({ timeout: 15000 })
  if (await openBtn.count() > 0) {
    await page.locator('input[type="number"]').first().fill('50000')
    await openBtn.first().click()
  }

  // ── Le sélecteur client est dans le panier ──
  const search = page.getByPlaceholder(/Ajouter un client/)
  await expect(search).toBeVisible({ timeout: 12000 })

  // 1) Recherche texte → dropdown avec résultat + palier (data démo réelle : « Espace Sahel »)
  await search.fill('es')
  const result = page.getByText('Espace Sahel', { exact: true })
  await expect(result).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/screenshots/pos-selector-search.png' })

  // 2) Sélection → chip client lié « ✓ Nom · Palier · −X% »
  await result.click()
  const chip = page.getByText('Espace Sahel', { exact: true })
  await expect(chip).toBeVisible()
  await expect(page.getByLabel(/Retirer le client/)).toBeVisible()
  // Le palier/remise du chip est rempli par un fetch async (loyaltyApi.get) → attendre le suffixe.
  await page.getByText(/Bronze · −5%/).waitFor({ timeout: 8000 }).catch(() => {})
  await page.screenshot({ path: 'e2e/screenshots/pos-selector-chip.png' })

  // 3) Retirer → revient au champ, puis ouvrir le scanner QR (modale caméra)
  await page.getByLabel(/Retirer le client/).click()
  await expect(page.getByPlaceholder(/Ajouter un client/)).toBeVisible()
  await page.getByRole('button', { name: /^Scanner$/ }).click()
  // BarcodeScanner : viewfinder caméra OU fallback saisie manuelle (selon dispo caméra CI)
  await expect(page.getByText(/code-barres|barcode|caméra|camera|manuellement|manually/i).first()).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'e2e/screenshots/pos-selector-scan.png' })
})
