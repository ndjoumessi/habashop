import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Captures écran 5 (item 11 — Onboarding) vs maquette 05-onboarding-wizard.view.html.
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const OUT = 'e2e/screenshots/item11'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])

async function preparePage(ctx, { theme = 'dark' } = {}) {
  const page = await ctx.newPage()
  await page.addInitScript(({ authLS, theme }) => {
    for (const { name, value } of authLS) localStorage.setItem(name, value)
    localStorage.removeItem('habashop_onboarded')
    localStorage.setItem('habashop-config', JSON.stringify({ state: { theme, lang: 'fr', currency: 'XOF' }, version: 0 }))
  }, { authLS, theme })
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/health', r => r.fulfill({ status: 200, body: '{"ok":true}' }))
  return page
}

const browser = await chromium.launch()

// ── Maquette 05 (référence) ──
{
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('file://' + process.cwd() + '/../../docs/ux-mockups/05-onboarding-wizard.view.html')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/maquette-05-onboarding.png`, fullPage: true })
  await ctx.close()
}

// ── Desktop : étape 1 remplie (état maquette : Alimentation Koné · Épicerie · Abidjan) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx)
  await page.goto(`${BASE}/onboarding`)
  await page.locator('#ob-shop-name').waitFor({ timeout: 20000 })
  await page.locator('#ob-shop-name').fill('Alimentation Koné')
  await page.locator('#ob-country').selectOption("Côte d'Ivoire")
  await page.locator('#ob-city').fill('Abidjan')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/onboarding-etape1.png` })
  // Étape 2 (devise) puis 3 (équipe) — fil d'étapes avec check
  await page.getByRole('button', { name: /Continuer/ }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/onboarding-etape2.png` })
  await page.getByRole('button', { name: /Continuer/ }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/onboarding-etape3.png` })
  // Skip → produits → Terminer → succès
  await page.getByRole('button', { name: /Passer pour l'instant/ }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /^Terminer/ }).click()
  await page.getByText(/prête|Configuration enregistrée/).waitFor({ timeout: 8000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/onboarding-etape5.png` })
  await ctx.close()
}

// ── Thème clair (étape 1) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx, { theme: 'light' })
  await page.goto(`${BASE}/onboarding`)
  await page.locator('#ob-shop-name').waitFor({ timeout: 20000 })
  await page.locator('#ob-shop-name').fill('Alimentation Koné')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/onboarding-etape1-light.png` })
  await ctx.close()
}

// ── Mobile 390 (étape 1) ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const page = await preparePage(ctx)
  await page.goto(`${BASE}/onboarding`)
  await page.locator('#ob-shop-name').waitFor({ timeout: 20000 })
  await page.locator('#ob-shop-name').fill('Alimentation Koné')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/onboarding-mobile.png` })
  await ctx.close()
}

await browser.close()
console.log('OK — captures écran 5 dans', OUT)
