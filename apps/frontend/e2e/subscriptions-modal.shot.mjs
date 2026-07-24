import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Captures de la modale « Nouvel abonnement » redessinée, sur le build local
// `vite preview`. Desktop (vide + rempli) + mobile + thème clair. API mockée —
// aucune écriture réelle.
// ⚠️ serviceWorkers:'block' : sinon le SW PWA court-circuite page.route().
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = 'e2e/screenshots/subscriptions'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = auth.origins?.[0]?.localStorage ?? []
const authState = JSON.parse(authLS.find(e => e.name === 'habashop-auth')?.value || '{}')
const USER = authState?.state?.user ?? { name: 'Admin', role: 'ADMIN', shopName: 'HabaShop — Dakar Central' }

const PRODUCTS = [
  { id: 'p1', name: 'Riz parfumé 5 kg',    sellPrice: 4500, emoji: '🍚', stockQty: 120, category: 'cereals' },
  { id: 'p2', name: 'Huile végétale 1 L',  sellPrice: 1300, emoji: '🫙', stockQty: 48,  category: 'fat' },
  { id: 'p3', name: 'Savon de Marseille',  sellPrice: 850,  emoji: '🧼', stockQty: 60,  category: 'hygiene' },
  { id: 'p4', name: 'Sucre 1 kg',          sellPrice: 700,  emoji: '🍬', stockQty: 245, category: 'grocery' },
]

async function preparePage(ctx, { theme = 'dark' } = {}) {
  const page = await ctx.newPage()
  await page.addInitScript(({ authLS, theme }) => {
    try {
      for (const { name, value } of authLS) localStorage.setItem(name, value)
      const raw = localStorage.getItem('habashop-config')
      const o = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      o.state = { ...(o.state || {}), theme, lang: 'fr', currency: 'XOF' }
      localStorage.setItem('habashop-config', JSON.stringify(o))
    } catch {}
  }, { authLS, theme })

  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  await page.route('**/api/subscriptions', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/api/subscriptions/due', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/api/products', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS) }))
  await page.route(u => u.pathname.endsWith('/api/customers') && u.searchParams.has('search'),
    r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'c1', name: 'Awa Diop', phone: '+221 77 123 45 67' }]) }))
  await page.route('**/health', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }))
  return page
}

const box = page => page.locator('.modal-box.sub-modal')

async function openModal(page) {
  await page.goto(`${BASE}/app/subscriptions`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Nouvel abonnement/ }).click()
  await box(page).waitFor({ state: 'visible' })
  await page.waitForTimeout(400)
}

/** Remplit client + nom + 3 produits + jour + date de début. */
async function fillAll(page) {
  await page.getByPlaceholder('Rechercher un client…').fill('Awa')
  await page.getByRole('option', { name: /Awa Diop/ }).click()
  await page.getByPlaceholder('ex. Panier hebdo Marie').fill('Panier hebdo Awa')

  for (const [q, name] of [['Riz', 'Riz parfumé 5 kg'], ['Huile', 'Huile végétale 1 L'], ['Savon', 'Savon de Marseille']]) {
    await page.getByPlaceholder('Rechercher un produit à ajouter…').fill(q)
    await page.getByRole('option', { name: new RegExp(name) }).click()
    await page.waitForTimeout(120)
  }
  // Quantités : Riz ×2, Huile ×3, Savon ×2
  await page.getByRole('button', { name: /Augmenter la quantité — Riz/ }).click()
  await page.getByRole('button', { name: /Augmenter la quantité — Huile/ }).click()
  await page.getByRole('button', { name: /Augmenter la quantité — Huile/ }).click()
  await page.getByRole('button', { name: /Augmenter la quantité — Savon/ }).click()

  await page.getByRole('button', { name: 'Mardi' }).click()
  await page.locator('#sub-start-date').fill('2026-08-04')
  await page.getByPlaceholder(/Instructions de livraison/).fill('Livrer avant 10h, appeler en arrivant.')
  await page.waitForTimeout(300)
}

const shots = []
/** Le corps défile : on remonte en haut, sinon la capture attrape une ligne coupée. */
async function shoot(page, file) {
  await page.evaluate(() => { document.querySelector('.sub-body')?.scrollTo(0, 0) })
  await page.waitForTimeout(150)
  await box(page).screenshot({ path: `${OUT}/${file}` })
  shots.push(file)
}

const browser = await chromium.launch()

// ── Desktop sombre : état vide (incomplet) puis rempli ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'fr-FR' })
  const page = await preparePage(ctx)
  await openModal(page)
  await shoot(page, 'desktop-vide.png')
  await fillAll(page)
  await shoot(page, 'desktop-rempli.png')
  await ctx.close()
}

// ── Desktop CLAIR (le montant bascule sur --text) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'fr-FR' })
  const page = await preparePage(ctx, { theme: 'light' })
  await openModal(page)
  await fillAll(page)
  await shoot(page, 'desktop-clair.png')
  await ctx.close()
}

// ── Mobile ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 840 }, deviceScaleFactor: 3, serviceWorkers: 'block', locale: 'fr-FR' })
  const page = await preparePage(ctx)
  await openModal(page)
  await shoot(page, 'mobile-vide.png')
  await fillAll(page)
  await shoot(page, 'mobile-rempli.png')
  // Bas de la modale (récurrence + total épinglé) en second cadrage.
  await page.evaluate(() => { const b = document.querySelector('.sub-body'); if (b) b.scrollTop = b.scrollHeight })
  await page.waitForTimeout(200)
  await box(page).screenshot({ path: `${OUT}/mobile-bas.png` }); shots.push('mobile-bas.png')
  await ctx.close()
}

await browser.close()
console.log(`[shot] ${shots.length} captures → ${OUT}/`)
console.log(shots.map(s => '  ' + s).join('\n'))
