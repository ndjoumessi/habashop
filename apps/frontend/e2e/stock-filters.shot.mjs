import { chromium } from '@playwright/test'

const BASE = 'http://localhost:5173'
const OUT = 'playwright-report'

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.locator('input[type="email"]').fill('admin@habashop.com')
  await page.locator('input[type="password"]').fill('demo1234')
  await page.locator('button[type="submit"], .public-btn-primary').first().click()
  await page.waitForURL('**/app/**', { timeout: 20000 })
}

async function seedTheme(page, theme) {
  // Patch le thème persisté AVANT le rendu de /app/stock (évite un reload)
  await page.addInitScript((t) => {
    try {
      const raw = localStorage.getItem('habashop-config')
      const cfg = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      cfg.state = { ...(cfg.state || {}), theme: t }
      localStorage.setItem('habashop-config', JSON.stringify(cfg))
    } catch {}
  }, theme)
}

async function shootStock(page, tag) {
  await page.goto(`${BASE}/app/stock`)
  await page.waitForSelector('.panel', { timeout: 20000 })
  // Le panneau Inventaire : viser le bloc filtres
  await page.waitForTimeout(800)
  // Trouver le panel "Inventaire Produits" (celui qui contient la recherche)
  const searchInput = page.locator('input[placeholder^="Rechercher un produit"]').first()
  await searchInput.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  // Capture fermé : la zone filtres + le haut du tableau
  const panel = page.locator('.panel').filter({ has: searchInput }).first()
  await panel.screenshot({ path: `${OUT}/stock-filters-${tag}-closed.png` })

  // Ouvrir le dropdown Catégorie (aria-label = "Catégorie")
  const trigger = page.getByRole('button', { name: 'Catégorie', exact: true }).first()
  await trigger.click()
  await page.waitForSelector('[role="listbox"]', { timeout: 5000 })
  await page.waitForTimeout(300)
  await panel.screenshot({ path: `${OUT}/stock-filters-${tag}-open.png` })
  // Fermer
  await page.keyboard.press('Escape')
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

// 1) Thème sombre (défaut gold/dark)
await login(page)
await shootStock(page, 'dark')

// 2) Mode soleil
await seedTheme(page, 'soleil')
await shootStock(page, 'soleil')

await browser.close()
console.log('OK — screenshots in', OUT)
