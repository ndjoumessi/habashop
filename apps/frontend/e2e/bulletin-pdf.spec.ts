import { test, expect } from '@playwright/test'

const BASE = 'https://habashop.vercel.app'

// Vérifie en LIVE que le bulletin PDF (printBulletin) affiche le MÊME montant que
// l'écran en devise EUR — régression BUG 2 (double conversion : 686,02 € → 1,05 €).
// NOTE : /api/auth/login est rate-limité (10 / 15 min / IP) → un seul login ici.
test('Bulletin PDF = écran en EUR (pas de double conversion)', async ({ page }) => {
  // 1) Login démo
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@habashop.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 })

  // 2) Force la devise d'AFFICHAGE = EUR dans le store persisté, puis reload.
  //    (Le fix "currency device-local" garantit que setTenant n'écrase PAS la devise
  //     sur un refresh même tenant → EUR survit, comme pour un vrai utilisateur.)
  await page.evaluate(() => {
    const raw = localStorage.getItem('habashop-config')
    const cfg = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    cfg.state = { ...(cfg.state ?? {}), currency: 'EUR' }
    localStorage.setItem('habashop-config', JSON.stringify(cfg))
  })
  await page.goto(`${BASE}/app/payroll`)
  await page.waitForLoadState('networkidle')

  // 3) Cible la ligne de Fatoumata Ndiaye (450 000 XOF, sans retenue → net = brut).
  const row = page.locator('tr', { hasText: 'Fatoumata' }).first()
  await expect(row).toBeVisible({ timeout: 15000 })

  // Montant NET affiché à l'écran (devise EUR → doit contenir "€")
  const screenText = (await row.innerText()).replace(/\s+/g, ' ')
  expect(screenText).toContain('€')
  // Extrait la 1re valeur monétaire € de la ligne (base = net pour Fatoumata)
  const m = screenText.match(/([\d  .,]+)\s*€/)
  expect(m, `pas de montant € dans la ligne: "${screenText}"`).not.toBeNull()
  const screenAmount = m![1].replace(/[  ]/g, '').trim() // ex. "686,02"
  console.log('Écran (ligne Fatoumata) :', screenText)
  console.log('Montant écran extrait   :', screenAmount, '€')

  // 4) Clique "Télécharger le PDF" sur cette ligne et capture la popup
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 15000 }),
    row.locator('button[aria-label="Télécharger le PDF"]').click(),
  ])
  await popup.waitForLoadState('domcontentloaded')
  const pdfText = (await popup.locator('body').innerText()).replace(/\s+/g, ' ')
  console.log('Extrait PDF             :', pdfText.slice(0, 400))

  // 5) Assertions
  // (a) Le PDF contient le MÊME montant que l'écran (preuve PDF == écran)
  expect(pdfText).toContain(screenAmount)
  // (b) Le PDF est bien en EUR
  expect(pdfText).toContain('€')
  // (c) Garde anti-régression : la valeur double-convertie (~1,05 € pour 450k) NE doit PAS apparaître
  expect(pdfText).not.toMatch(/\b1[.,]0[0-9]\s*€/)
})
