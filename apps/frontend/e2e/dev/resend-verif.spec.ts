import { test, expect } from '@playwright/test'
import { seedEcran, ouvrirEcran } from './ecrans'

const CAS = [
  { nom: 'verifie', payload: { configured: true, expediteur: 'HabaShop <bonjour@habashop.com>', domaineExpedition: 'habashop.com', domaineVerifie: true, domaines: [{ name: 'habashop.com', verified: true, statut: 'verified' }], echec: null, mesureA: '2026-08-15T04:00:00.000Z' } },
  { nom: 'resenddev', payload: { configured: true, expediteur: 'HabaShop <onboarding@resend.dev>', domaineExpedition: 'resend.dev', domaineVerifie: false, domaines: [], echec: null, mesureA: '2026-08-15T04:00:00.000Z' } },
  { nom: 'sanscle', payload: { configured: false, expediteur: 'HabaShop <onboarding@resend.dev>', domaineExpedition: 'resend.dev', domaineVerifie: null, domaines: null, echec: 'NOT_CONFIGURED', mesureA: '2026-08-15T04:00:00.000Z' } },
]

for (const cas of CAS) {
  test(`sonde Resend — ${cas.nom}`, async ({ page }) => {
    const erreurs: string[] = []
    page.on('pageerror', e => erreurs.push(String(e)))
    await seedEcran(page)
    // ⚠️ Le cas se pose DANS la page : le harnais stubbe `window.fetch`, donc `page.route`
    // n'intercepte rien — piège vérifié, il rendait trois fois le même repli générique.
    await page.addInitScript(c => { (window as unknown as { __RESEND_CAS__?: string }).__RESEND_CAS__ = c }, cas.nom)
    await ouvrirEcran(page, '/__dev/table', 1440, 1000)
    await page.waitForTimeout(2000)
    // ⚠️ TÉMOIN POSITIF d'abord : sans lui, un écran vide rend « tout absent » et se lit
    // comme un succès. Le piège est déjà tombé une fois aujourd'hui.
    const bandeau = page.locator('text=Domaine d’expédition e-mail').first()
    await expect(bandeau).toBeVisible({ timeout: 10_000 })
    const zone = page.locator('div').filter({ hasText: /Domaine d’expédition e-mail/ }).last()
    await zone.scrollIntoViewIfNeeded()
    console.log(`[${cas.nom}] →`, (await zone.innerText()).replace(/\n+/g, ' | '))
    await page.screenshot({ path: `test-results/resend-${cas.nom}.png`, clip: await zone.boundingBox() ?? undefined })
    expect(erreurs).toEqual([])
  })
}
