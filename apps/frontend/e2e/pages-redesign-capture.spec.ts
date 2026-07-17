import { test } from '@playwright/test'

// Captures before/after du redesign des 10 pages — thème sombre (défaut device).
// UN SEUL page.goto par test (règle CLAUDE.md : un 2ᵉ goto annule le /me → logout).
// Lecture seule. SHOT_TAG=before|after ; PAGES=dashboard,customers (filtre optionnel).
const BASE = process.env.PAGES_BASE ?? 'https://habashop.vercel.app'
const TAG = process.env.SHOT_TAG ?? 'before'
const ONLY = (process.env.PAGES ?? '').split(',').filter(Boolean)

const ROUTES: [string, string][] = [
  ['dashboard', '/app/dashboard'],
  ['customers', '/app/customers'],
  ['suppliers', '/app/suppliers'],
  ['orders', '/app/orders'],
  ['hr', '/app/hr'],
  ['planning', '/app/planning'],
  ['payroll', '/app/payroll'],
  ['expenses', '/app/expenses'],
  ['reports', '/app/reports'],
  ['settings', '/app/settings'],
]

test.use({ viewport: { width: 1440, height: 900 } })

for (const [name, path] of ROUTES) {
  if (ONLY.length && !ONLY.includes(name)) continue
  test(`${name} captures ${TAG} — dark`, async ({ page }) => {
    await page.goto(`${BASE}${path}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `e2e/screenshots/${name}-${TAG}-dark.png` })
  })
}
