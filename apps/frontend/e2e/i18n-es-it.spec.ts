import { test, expect, type Page } from '@playwright/test'

/**
 * Vérifie le rendu ES/IT des écrans dont l'i18n a été corrigée
 * (commits c3201bb6 / ba266a91 / d09d3486) : HR, Payroll, Customers, Orders.
 *
 * ⚠️ baseURL = prod (habashop.vercel.app). Le test ne passe que si ces commits
 * sont déployés. Surcharge possible : E2E_BASE=http://localhost:4173 (vite preview).
 *
 * Couverture forte (assertions sur mes corrections directes) :
 *  - Customers : tooltips title= traduits (Vista tabla / Vista cuadrícula, etc.)
 *  - Payroll   : sous-titre "Período/Periodo" (zone mois/labels localisés)
 * Couverture rendu + régression (la page rend dans la langue, zéro erreur JS) :
 *  - HR (en-tête Recursos Humanos / Risorse Umane), Orders.
 * Hors portée e2e (cf. checklist manuelle) : bulletin PDF (window.open),
 *  colonne "unité" du détail commande, toasts (transitoires).
 */

const BASE = process.env.E2E_BASE ?? 'https://habashop.vercel.app'
const API  = process.env.E2E_API  ?? 'https://habashop-production.up.railway.app'

// Reset DÉTERMINISTE de la langue du tenant démo PARTAGÉ via API (PATCH awaité). L'ancien
// reset passait par l'UI (`setLangUI`) dans un `catch` silencieux → s'il ratait (cold start,
// bounce /login, course avec le teardown), le tenant démo restait en es/IT entre les sessions
// (drift observé). Lire le JWT du localStorage (session storageState) → PATCH /api/tenant.
async function resetTenantLangFr(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('habashop_token')).catch(() => null)
  if (!token || token === 'demo-token-local') return
  const res = await page.request.patch(`${API}/api/tenant`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { lang: 'fr' },
  })
  if (!res.ok()) throw new Error(`reset lang fr → HTTP ${res.status()}`)
}

// Le LanguageSwitcher de l'en-tête est devenu un INDICATEUR en lecture seule (plus de
// menu) ; la bascule de langue vit désormais dans Paramètres → Langue & Devise (setLang).
// setLang persiste AUSSI au tenant (PATCH /api/tenant) et setTenant RESTAURE lang à chaque
// /me → on doit attendre le PATCH avant tout reload. Le tenant démo étant PARTAGÉ : ces
// tests tournent en SÉRIE et afterEach REMET le français (sinon la démo resterait en es/it).
test.describe.configure({ mode: 'serial' })

async function login(page: Page) {
  // Auth via storageState (projet `setup`) → aucun login UI (anti rate-limit). On charge
  // l'app pour exposer la session + la sidebar SPA.
  await page.goto(`${BASE}/app/dashboard`)
  await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 })
}

// Choisit une langue dans Paramètres → Langue & Devise, en NAVIGATION SPA (clic sidebar,
// sans page.goto) : un reload revalide la session côté backend et redirige par intermittence
// vers /login (cold start). Le libellé de section peut être dans n'importe quelle langue
// (selon l'état courant) → regex 4-langues ; le clic auto-attend le montage SPA de Settings.
async function setLangUI(page: Page, nativeName: string) {
  await page.locator('a[href="/app/settings"]').first().click()
  await page.getByRole('button', { name: /Langue & Devise|Language & Currency|Idioma & Divisa|Lingua & Valuta/ })
    .first().click({ timeout: 20_000 })
  // Clic sur le nom natif (texte exact du <div>) → l'événement remonte au <button> parent ;
  // plus robuste que le nom accessible (qui inclut le drapeau emoji + le nom anglais).
  await page.getByText(nativeName, { exact: true }).first().click({ timeout: 10_000 })
}

async function switchLang(page: Page, c: LangCase) {
  await setLangUI(page, c.native)
  await expect(page.getByRole('button', { name: c.langNav }).first()) // confirme : chrome localisé
    .toBeVisible({ timeout: 5000 })
}

// Le tenant démo est PARTAGÉ → on le remet en français après chaque test, de façon DÉTERMINISTE
// (API, awaité). Si le reset rate, on le surface (throw) au lieu de l'avaler silencieusement :
// un échec de nettoyage doit être visible (c'est lui qui laissait la démo en es/it auparavant).
test.afterEach(async ({ page }) => {
  await resetTenantLangFr(page)
})

// Garantie finale (belt-and-suspenders) : même si un afterEach a raté, on repose fr en fin de
// fichier via une session API fraîche (token lu depuis le storageState du projet `setup`).
test.afterAll(async ({ playwright }) => {
  try {
    const fs = await import('node:fs')
    const state = JSON.parse(fs.readFileSync('e2e/.auth/user.json', 'utf-8'))
    const token = state.origins?.flatMap((o: any) => o.localStorage ?? [])
      .find((i: any) => i.name === 'habashop_token')?.value
    if (!token) return
    const ctx = await playwright.request.newContext()
    await ctx.patch(`${API}/api/tenant`, { headers: { Authorization: `Bearer ${token}` }, data: { lang: 'fr' } })
    await ctx.dispose()
  } catch { /* best-effort : le fichier storageState peut ne pas exister hors CI */ }
})

type LangCase = {
  code: 'es' | 'it'
  native: string   // nom natif de la langue (bouton de sélection, libellé statique)
  langNav: string  // libellé localisé de la section "Langue & Devise" (confirme le switch)
  custTableView: string
  custGridView: string
  payrollPeriod: RegExp
  hrHeader: RegExp
}

const CASES: LangCase[] = [
  {
    code: 'es', native: 'Español', langNav: 'Idioma & Divisa',
    custTableView: 'Vista tabla', custGridView: 'Vista cuadrícula',
    payrollPeriod: /Período/, hrHeader: /Recursos Humanos/,
  },
  {
    code: 'it', native: 'Italiano', langNav: 'Lingua & Valuta',
    custTableView: 'Vista tabella', custGridView: 'Vista griglia',
    payrollPeriod: /Periodo/, hrHeader: /Risorse Umane/,
  },
]

for (const c of CASES) {
  test(`i18n ${c.code.toUpperCase()} — écrans modifiés rendent correctement`, async ({ page }) => {
    // Backend live (api.habashop.com) + cold starts → marges généreuses.
    test.setTimeout(90_000)
    const SCREEN = 25_000
    const errors: string[] = []
    page.on('pageerror', e => errors.push(String(e)))

    await login(page)
    await switchLang(page, c)

    // Navigation SPA via la sidebar (NavLink <a href="/app/…">) — login UNIQUE, sans
    // rechargement : la langue choisie reste en mémoire et la session n'est pas revalidée
    // (un page.goto redirige par intermittence vers /login sur cold start backend).
    const nav = (path: string) => page.locator(`a[href="${path}"]`).first().click()

    // ── Customers : tooltips title= traduits (correction directe) ──
    await nav('/app/customers')
    await expect(page.locator(`button[title="${c.custTableView}"]`).first())
      .toBeVisible({ timeout: SCREEN })
    await expect(page.locator(`button[title="${c.custGridView}"]`).first())
      .toBeVisible({ timeout: SCREEN })

    // ── Payroll : sous-titre période localisé (zone mois/labels corrigée) ──
    await nav('/app/payroll')
    await expect(page.getByText(c.payrollPeriod).first())
      .toBeVisible({ timeout: SCREEN })

    // ── HR : la page rend bien dans la langue cible ──
    await nav('/app/hr')
    await expect(page.getByText(c.hrHeader).first())
      .toBeVisible({ timeout: SCREEN })

    // ── Orders : la page rend (régression — pas d'écran blanc / crash) ──
    await nav('/app/orders')
    await expect(page).toHaveURL(/\/app\/orders/, { timeout: SCREEN })

    // Aucune erreur JS sur l'ensemble du parcours (es/it)
    expect(errors, `Erreurs JS:\n${errors.join('\n')}`).toEqual([])
  })
}
