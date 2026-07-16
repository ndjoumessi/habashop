import { Page } from '@playwright/test'

// Boutique démo par défaut pour les comptes multi-boutiques (admin@).
// Cf. CLAUDE.md « Comptes démo » : demo-tenant-001 = « HabaShop — Dakar Central ».
const DEFAULT_SHOP_ID = 'demo-tenant-001'
const DEFAULT_SHOP_NAME = /Dakar Central/i

/**
 * Login UI réel, robuste au flux multi-boutiques v2.
 *
 * Depuis multi-boutiques v2, un compte lié à > 1 boutique (ex. admin@) est redirigé
 * après login vers /select-shop au lieu de /app/dashboard : il faut choisir une
 * boutique avant d'atteindre le dashboard. Un compte mono-boutique atterrit
 * directement sur le dashboard (pas de sélecteur).
 *
 * Sélection de boutique : on privilégie le data-testid `shop-option-<tenantId>`
 * (stable), avec repli sur le NOM de boutique (rôle+texte) — car les E2E ciblent la
 * prod déployée et le data-testid n'y apparaît qu'après redéploiement Vercel du build.
 *
 * ⚠️ /api/auth/login est rate-limité (30/15min/IP) → 1 seul login par appel.
 */
export async function loginViaUI(
  page: Page,
  base: string,
  email = 'admin@habashop.com',
  password = 'demo1234',
): Promise<void> {
  await page.goto(`${base}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')

  // Selon le compte : sélecteur de boutique (> 1 boutique) OU dashboard direct (1 boutique).
  await page.waitForURL(/\/(select-shop|app\/dashboard)/, { timeout: 15000 })
  if (page.url().includes('/select-shop')) {
    // Le bouton nommé existe sur tous les builds → on l'attend, puis on préfère le
    // data-testid s'il est présent (build redéployé), sinon on clique par le nom.
    const byName = page.getByRole('button', { name: DEFAULT_SHOP_NAME })
    await byName.waitFor({ timeout: 10000 })
    const byTestId = page.getByTestId(`shop-option-${DEFAULT_SHOP_ID}`)
    await ((await byTestId.count()) > 0 ? byTestId : byName).click()
    await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 })
  }

  // La sélection de boutique déclenche un window.location.assign (rechargement dur). On
  // attend un élément STABLE du shell authentifié (la navigation principale, rendue une
  // fois l'app rechargée) : garantit qu'aucune navigation n'est plus en vol avant qu'un
  // page.evaluate() (ex. lecture du token) ne s'exécute → évite « Execution context was
  // destroyed ».
  await page.getByRole('navigation', { name: /Navigation principale/i }).waitFor({ timeout: 15000 })
}
