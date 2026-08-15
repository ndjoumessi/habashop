import { test, expect } from '@playwright/test'
import { seedEcran, ouvrirEcran } from './ecrans'

test('infobulle du donut — se monte au survol, se démonte hors survol, sans jamais faire patienter', async ({ page }) => {
  await seedEcran(page)
  await ouvrirEcran(page, '/app/dashboard', 1440, 1000)
  await page.waitForTimeout(2500)
  const lire = () => page.evaluate(() => {
    const el = document.querySelector('[data-testid="chart-donut"] [data-testid="chart-tooltip"]')
    return el ? (el.textContent ?? '').trim().slice(0, 40) : null
  })
  // Hors survol : ABSENTE — et la lecture rend `null` IMMÉDIATEMENT (pas de patience).
  const t0 = Date.now()
  expect(await lire()).toBeNull()
  expect(Date.now() - t0, 'la lecture a patienté — elle doit rendre null tout de suite').toBeLessThan(2000)
  // Sur un secteur : MONTÉE, avec du contenu.
  // ⚠️ `hover()` vise le centre de la bbox, qui pour un arc tombe dans le TROU du donut.
  const b = await page.locator('[data-testid="chart-donut"]').first().boundingBox()
  const cx = b!.x + b!.width / 2, cy = b!.y + b!.height / 2
  let monte = false
  for (let d = 0; d < 360 && !monte; d += 6) {
    const r = (d * Math.PI) / 180
    await page.mouse.move(cx + 88 * Math.cos(r), cy + 88 * Math.sin(r))
    monte = (await lire()) !== null
  }
  await page.waitForTimeout(200)
  const contenu = await lire()
  expect(contenu, 'aucune infobulle au survol d’un secteur').toBeTruthy()
  console.log('[infobulle]', JSON.stringify(contenu))
  // Sortie : DÉMONTÉE.
  await page.mouse.move(5, 5)
  await page.waitForTimeout(300)
  expect(await lire(), 'l’infobulle survit à la sortie du secteur').toBeNull()
})
