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

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', 'admin@habashop.com')
  await page.fill('input[type="password"]', 'demo1234')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/dashboard/, { timeout: 12000 })
}

// Bascule via le LanguageSwitcher de l'en-tête. Contexte neuf => langue = fr au départ,
// donc le libellé cible (ES/IT) est unique vs le trigger qui affiche "FR".
async function switchLang(page: Page, label: 'ES' | 'IT') {
  const trigger = page.locator('button[title="Changer la langue"]').first()
  await trigger.click()                                  // ouvre le menu
  await page.getByText(label, { exact: true }).click()   // <span>ES</span> / <span>IT</span>
  await expect(trigger).toContainText(label)             // confirme le switch
}

type LangCase = {
  code: 'es' | 'it'
  label: 'ES' | 'IT'
  custTableView: string
  custGridView: string
  payrollPeriod: RegExp
  hrHeader: RegExp
}

const CASES: LangCase[] = [
  {
    code: 'es', label: 'ES',
    custTableView: 'Vista tabla', custGridView: 'Vista cuadrícula',
    payrollPeriod: /Período/, hrHeader: /Recursos Humanos/,
  },
  {
    code: 'it', label: 'IT',
    custTableView: 'Vista tabella', custGridView: 'Vista griglia',
    payrollPeriod: /Periodo/, hrHeader: /Risorse Umane/,
  },
]

for (const c of CASES) {
  test(`i18n ${c.label} — écrans modifiés rendent correctement`, async ({ page }) => {
    // Backend live (api.habashop.com) + cold starts → marges généreuses.
    test.setTimeout(90_000)
    const SCREEN = 25_000
    const errors: string[] = []
    page.on('pageerror', e => errors.push(String(e)))

    await login(page)
    await switchLang(page, c.label)

    // Navigation SPA via la sidebar (NavLink <a href="/app/…">) — login UNIQUE, sans
    // rechargement : l'auth reste en mémoire. Un page.goto rechargerait la page et
    // revaliderait la session côté backend (intermittent → redirection /login).
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
