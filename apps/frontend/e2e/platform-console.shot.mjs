import { chromium } from '@playwright/test'

// Capture de la console plateforme refondue (Étape 2). API 100 % mockée + user
// platform-admin injecté dans le store persisté. THEME=dark|light.
const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'
const THEME = process.env.THEME ?? 'dark'
const OUT = 'e2e/screenshots/platform'

const authState = {
  state: {
    user: { id: 'p1', name: 'Ops', email: 'ops@habashop.com', role: 'CASHIER', shopName: 'HabaShop', isPlatformAdmin: true },
    token: 'fake-jwt-for-shot', isAuthenticated: true, tenants: [], activeTenantId: 'demo',
  },
  version: 0,
}

const day = 86400000
const now = Date.now()
const iso = (ms) => new Date(ms).toISOString()
const TENANTS = [
  { id: 'A', name: 'HabaShop — Dakar Central', plan: 'pro', currency: 'XOF', country: 'SN', status: 'active', isActive: true, createdAt: iso(now - 120 * day), trialEnds: null, revenue: 4200000, lastActivityAt: iso(now - 2 * 3600000), _count: { users: 5, products: 48, sales: 320 } },
  { id: 'B', name: 'Alimentation Koné — Abidjan', plan: 'starter', currency: 'XOF', country: 'CI', status: 'trial', isActive: true, createdAt: iso(now - 12 * day), trialEnds: iso(now + 2 * day), revenue: 180000, lastActivityAt: iso(now - 1 * 3600000), _count: { users: 2, products: 20, sales: 34 } },
  { id: 'C', name: 'Superette Fatou — Thiès', plan: 'trial', currency: 'XOF', country: 'SN', status: 'trial', isActive: true, createdAt: iso(now - 40 * day), trialEnds: iso(now - 3 * day), revenue: 90000, lastActivityAt: iso(now - 20 * day), _count: { users: 1, products: 12, sales: 8 } },
]
const STATS = { totalTenants: 3, totalUsers: 8, totalSales: 362, totalRevenue: 4470000, totalProducts: 80 }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' })
const page = await ctx.newPage()
await page.addInitScript(([auth, theme]) => {
  localStorage.setItem('habashop-auth', JSON.stringify(auth))
  localStorage.setItem('habashop_token', 'fake-jwt-for-shot')
  localStorage.setItem('habashop-config', JSON.stringify({ state: { theme, lang: 'fr', currency: 'XOF' }, version: 0 }))
}, [authState, THEME])
// ⚠️ Playwright : le dernier handler ajouté a la priorité → catch-all EN PREMIER,
// puis les mocks spécifiques (sinon `{}` écrase les listes → crash de la page).
await page.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...authState.state.user }) }))
await page.route('**/api/admin/plan-requests', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
await page.route('**/api/admin/stats', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATS) }))
await page.route('**/api/admin/tenants', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TENANTS) }))

await page.goto(`${BASE}/admin`)
await page.getByText(/Console plateforme/).waitFor({ timeout: 20000 })
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/console-${THEME}.png`, fullPage: true })

// Onglet Boutiques : cartes avec CA + dernière activité
await page.getByRole('tab', { name: /Boutiques/ }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/shops-${THEME}.png`, fullPage: true })

await browser.close()
console.log(`OK — console-${THEME}.png + shops-${THEME}.png`)
