import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

const BASE = 'http://localhost:5173'
const OUT = 'playwright-report'

// Réutilise le token JWT du storageState live (origine vercel) → pas de login
// (cold-start Railway lent). On rejoue les entrées localStorage sur localhost.
const auth = JSON.parse(readFileSync('e2e/.auth/user.json', 'utf8'))
const authLS = (auth.origins?.[0]?.localStorage ?? [])
const authState = JSON.parse(authLS.find(e => e.name === 'habashop-auth')?.value || '{}')
const USER = authState?.state?.user ?? { name: 'Admin', role: 'ADMIN' }

async function seed(page, { theme, collapsed }) {
  await page.addInitScript(({ cfg, authLS }) => {
    try {
      for (const { name, value } of authLS) localStorage.setItem(name, value)
      const raw = localStorage.getItem('habashop-config')
      const o = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      o.state = { ...(o.state || {}), ...(cfg.theme ? { theme: cfg.theme } : {}), sidebarCollapsed: !!cfg.collapsed }
      localStorage.setItem('habashop-config', JSON.stringify(o))
    } catch {}
  }, { cfg: { theme, collapsed }, authLS })
}

async function shoot(ctx, tag, opts) {
  const page = await ctx.newPage()
  await seed(page, opts)
  // Backend prod injoignable depuis ce sandbox → on garde la session vivante
  // (App.tsx logout() si /me échoue) et on neutralise les autres appels API.
  await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}/app/dashboard`)
  await page.waitForSelector('#sidebar', { timeout: 20000 })
  await page.waitForTimeout(700)
  const sidebar = page.locator('#sidebar')
  await sidebar.screenshot({ path: `${OUT}/sidebar-${tag}.png` })
  await page.close()
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })

await shoot(ctx, 'dark-expanded',    { theme: 'dark',   collapsed: false })
await shoot(ctx, 'dark-collapsed',   { theme: 'dark',   collapsed: true  })
await shoot(ctx, 'soleil-expanded',  { theme: 'soleil', collapsed: false })
await shoot(ctx, 'soleil-collapsed', { theme: 'soleil', collapsed: true  })

await browser.close()
console.log('OK — screenshots in', OUT)
