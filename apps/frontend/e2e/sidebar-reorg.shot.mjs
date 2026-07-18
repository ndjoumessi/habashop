import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

// Étape 3 — capture sidebar avant/après. PHASE=avant|apres, THEME=dark|light.
// AVANT : SHOT_BASE=https://habashop.vercel.app (prod, ancienne sidebar).
// APRÈS : SHOT_BASE=http://localhost:4173 (build local, nouvelle sidebar).
// Réutilise le JWT admin du storageState (pas de login) ; API mockée (rendu = NAV).
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const PHASE = process.env.PHASE ?? 'apres'
const THEME = process.env.THEME ?? 'dark'
const OUT = 'e2e/screenshots/sidebar'

const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])
const authState = JSON.parse(authLS.find(e => e.name === 'habashop-auth')?.value || '{}')
const USER = authState?.state?.user ?? { name: 'Admin', role: 'ADMIN' }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, serviceWorkers: 'block' })
const page = await ctx.newPage()
await page.addInitScript(({ authLS, theme }) => {
  for (const { name, value } of authLS) localStorage.setItem(name, value)
  const raw = localStorage.getItem('habashop-config')
  const o = raw ? JSON.parse(raw) : { state: {}, version: 0 }
  o.state = { ...(o.state || {}), theme, sidebarCollapsed: false }
  localStorage.setItem('habashop-config', JSON.stringify(o))
}, { authLS, theme: THEME })
await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
await page.route('**/api/stock/transfers**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

await page.goto(`${BASE}/app/dashboard`)
await page.waitForSelector('#sidebar', { timeout: 20000 })
await page.waitForTimeout(700)
await page.locator('#sidebar').screenshot({ path: `${OUT}/${PHASE}-${THEME}.png` })

await browser.close()
console.log(`OK — ${PHASE}-${THEME}.png`)
