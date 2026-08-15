import { test, expect } from '@playwright/test'

const BASE = process.env.REPORTS_BASE ?? 'https://habashop.vercel.app'

async function login(page: import('@playwright/test').Page) {
  // Auth via storageState (projet `setup`) → aucun login UI. Chaque test enchaîne avec UN SEUL
  // page.goto(`/app/...`) : pas de double navigation (qui annulerait le /me de montage →
  // catch(logout) → effacement du token → bounce /login).
  void page
}

test('Reports — all 5 tabs render (charts incl.), no errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await login(page)
  await page.goto(`${BASE}/app/reports`)

  // Default tab = Ventes: donut + area chart render (charts use the moved render helpers)
  await expect(page.getByText(/Répartition paiements|Payment breakdown/).first()).toBeVisible({ timeout: 12000 })
  await expect(page.locator('[data-testid="chart-donut"]').first()).toBeVisible()

  // NB : les onglets sont des role="tab" (composant <Tabs> unifié, Vague 2), pas role="button".
  // Stock
  await page.getByRole('tab', { name: /^Stock$/ }).first().click()
  // ⚠️ Assertion RÉALIGNÉE. Ce spec vérifiait « Rotation des stocks » — un bloc dont les
  // 5 catégories, pourcentages et montants étaient des LITTÉRAUX FABRIQUÉS. Il était donc
  // vert PARCE QUE la page mentait, et il est passé au rouge quand le bloc a été retiré
  // (516493ec) : un test E2E qui garde l'existence d'une donnée inventée protège le défaut,
  // pas l'utilisateur. On asserte désormais un KPI calculé sur les vraies données.
  await expect(page.getByText(/Articles en stock|Items in stock/).first()).toBeVisible({ timeout: 5000 })
  // Et le bloc serveur du dessus, qui doit rester cohérent avec lui (c'est la contradiction
  // « À réapprovisionner : 2 » vs « 7 en rupture » que la refonte a supprimée).
  await expect(page.getByText(/À réapprovisionner|To reorder/).first()).toBeVisible({ timeout: 5000 })

  // Clients
  await page.getByRole('tab', { name: /^Clients$|^Customers$/ }).first().click()
  await expect(page.getByText(/Segments clients|Customer segments/).first()).toBeVisible({ timeout: 5000 })

  // Finance
  await page.getByRole('tab', { name: /^Finance$/ }).first().click()
  await expect(page.getByText(/Compte de résultat|P&L summary/).first()).toBeVisible({ timeout: 5000 })

  // RH
  await page.getByRole('tab', { name: /^RH$|^HR$/ }).first().click()
  await expect(page.getByText(/Masse salariale|Payroll/).first()).toBeVisible({ timeout: 5000 })

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})
