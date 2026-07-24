import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Captures Chantier B : message de scan honnête + indicateur de synchro (pied sidebar).
// ⚠️ serviceWorkers:'block' (sinon le SW court-circuite page.route).
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = 'e2e/screenshots/freshness'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = auth.origins?.[0]?.localStorage ?? []
const USER = JSON.parse(authLS.find(e => e.name === 'habashop-auth')?.value || '{}')?.state?.user
  ?? { name: 'Admin', role: 'ADMIN', shopName: 'HabaShop — Dakar Central' }

const PRODUCTS = [
  { id: 'p1', name: 'Riz parfumé 5 kg',   sellPrice: 4500, emoji: '🌾', stockQty: 120, category: 'cereals', barcode: '4006381333931', sku: 'PRD-0001' },
  { id: 'p2', name: 'Huile végétale 1 L', sellPrice: 1300, emoji: '🫙', stockQty: 48,  category: 'fat',     barcode: '', sku: 'PRD-0002' },
  { id: 'p3', name: 'Savon de Marseille', sellPrice: 850,  emoji: '🧼', stockQty: 60,  category: 'hygiene', barcode: '', sku: 'PRD-0003' },
]

/** `syncedAgo` : ancienneté simulée du catalogue (ms) pour l'indicateur. */
async function prepare(ctx, { syncedAgo = 3 * 3600_000, lookupFinds = false, catalogFails = false } = {}) {
  const page = await ctx.newPage()
  await page.addInitScript(({ authLS, syncedAgo }) => {
    try {
      for (const { name, value } of authLS) localStorage.setItem(name, value)
      const raw = localStorage.getItem('habashop-config')
      const o = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      o.state = {
        ...(o.state || {}), theme: 'dark', lang: 'fr', currency: 'XOF',
        requireCashier: false, cashierForcedClosed: false, enableScanner: true,
        freshness: { catalog: Date.now() - syncedAgo },
      }
      localStorage.setItem('habashop-config', JSON.stringify(o))
    } catch {}
  }, { authLS, syncedAgo })

  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  await page.route('**/api/tenant', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requireCashier: false, name: USER.shopName }) }))
  // lookup AVANT products : Playwright matche en ordre inverse d'enregistrement.
  await page.route(u => u.pathname.endsWith('/api/products/lookup'), r => lookupFinds
    ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'p9', name: 'Produit créé ce matin', sellPrice: 2500, emoji: '✨', stockQty: 40, category: 'grocery', barcode: '5901234123457', sku: 'PRD-0009' }) })
    : r.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"NOT_IN_CATALOG"}' }))
  // catalogFails : le refetch échoue → markFresh n'est PAS appelé, l'horodatage semé
  // survit. C'est le cas réel que l'indicateur doit savoir dire (données périmées).
  await page.route(u => u.pathname.endsWith('/api/products'), r => catalogFails
    ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"indisponible"}' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS) }))
  await page.route('**/health', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }))
  return page
}

/** Injecte un code dans handleScan sans caméra : le champ de recherche accepte le scan. */
async function scan(page, code) {
  await page.evaluate(c => {
    const ev = new CustomEvent('habashop:test-scan', { detail: c })
    window.dispatchEvent(ev)
  }, code)
}

const shots = []
const browser = await chromium.launch()

// ── 1. Indicateur de synchro (pied de sidebar), catalogue vieux de 3 h ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'fr-FR' })
  const page = await prepare(ctx, { catalogFails: true })
  await page.goto(`${BASE}/app/pos`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /Dernière synchro/ }).click()
  await page.waitForTimeout(500)
  await page.locator('.sidebar').screenshot({ path: `${OUT}/desktop-indicateur.png` }).catch(async () => {
    await page.screenshot({ path: `${OUT}/desktop-indicateur.png`, clip: { x: 0, y: 380, width: 330, height: 560 } })
  })
  shots.push('desktop-indicateur.png')
  await page.screenshot({ path: `${OUT}/desktop-pleine-page.png` })
  shots.push('desktop-pleine-page.png')
  await ctx.close()
}

// ── 2. Douchette : code absent du cache + lookup en échec → message HONNÊTE ──
//    (contrairement à la caméra, ce chemin est pilotable : c'est un champ de saisie)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'fr-FR' })
  const page = await prepare(ctx)                       // catalogue OK, lookup en 404
  await page.goto(`${BASE}/app/pos`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const field = page.getByPlaceholder(/Rechercher ou scanner/)
  await field.click()
  // Frappe à cadence DOUCHETTE (~5 ms/caractère) puis Entrée, comme le matériel réel.
  await field.pressSequentially('5901234123457', { delay: 5 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/desktop-douchette-introuvable.png` })
  shots.push('desktop-douchette-introuvable.png')
  await ctx.close()
}

// ── 3. Douchette : code absent du cache mais RÉSOLU par le serveur → ajout muet ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'fr-FR' })
  const page = await prepare(ctx, { lookupFinds: true })
  await page.goto(`${BASE}/app/pos`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const field = page.getByPlaceholder(/Rechercher ou scanner/)
  await field.click()
  await field.pressSequentially('5901234123457', { delay: 5 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/desktop-douchette-resolue.png` })
  shots.push('desktop-douchette-resolue.png')
  await ctx.close()
}

// ── 4. Mobile (sidebar en tiroir) ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 840 }, deviceScaleFactor: 3, serviceWorkers: 'block', locale: 'fr-FR' })
  const page = await prepare(ctx, { syncedAgo: 26 * 3600_000, catalogFails: true })
  await page.goto(`${BASE}/app/pos`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // La sidebar est un TIROIR sous 768px : on l'ouvre, sinon l'indicateur n'est pas rendu.
  await page.evaluate(() => document.getElementById('sidebar')?.classList.add('mobile-open'))
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Dernière synchro/ }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/mobile-indicateur.png` })
  shots.push('mobile-indicateur.png')
  await ctx.close()
}

await browser.close()
console.log(`[shot] ${shots.length} captures → ${OUT}/`)
shots.forEach(s => console.log('  ' + s))
