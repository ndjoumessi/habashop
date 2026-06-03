import { test, expect } from '@playwright/test'

// Vérif LIVE du « Mode soleil ☀️ » (Vague 3) : le bouton header bascule vers le thème clair
// haut-contraste `soleil` (body.theme-soleil + data-theme=light + fond quasi-blanc) et restaure
// le thème précédent au 2ᵉ tap. Le thème est device-local (localStorage) → AUCUNE pollution
// tenant. Auth via storageState (projet `setup`) → aucun login UI, UN SEUL page.goto.
const BASE = process.env.SUN_BASE ?? 'https://habashop.vercel.app'

// Luminance relative (WCAG) d'un "rgb(r, g, b)" calculé → distingue fond sombre vs blanc.
function luminanceOf(rgb: string): number {
  const m = rgb.match(/\d+(\.\d+)?/g)
  if (!m) return 0
  const [r, g, b] = m.slice(0, 3).map(Number)
  const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

test('Header — Mode soleil : tap → thème soleil clair, 2ᵉ tap → thème précédent', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.goto(`${BASE}/app/dashboard`)

  // Le bouton ☀️ : icône lucide Sun + aria-pressed (distinctif du SunModeToggle).
  const sunBtn = page.locator('button[aria-pressed]:has(svg.lucide-sun)').first()
  await expect(sunBtn).toBeVisible({ timeout: 15000 })

  // NB : `data-theme` est posé au NOM BRUT du thème par AppLayout (non utilisé par le CSS) ;
  // la preuve fonctionnelle du mode clair = `color-scheme` (posé par applyTheme) + fond blanc.
  const snapshot = () => page.evaluate(() => ({
    cls: document.body.className,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    bg: getComputedStyle(document.body).backgroundColor,
  }))

  // État initial (thème par défaut du device, p.ex. gold/sombre).
  const before = await snapshot()
  expect(before.cls).not.toBe('theme-soleil')
  const lumBefore = luminanceOf(before.bg)
  expect(await sunBtn.getAttribute('aria-pressed')).toBe('false')

  // ── 1er tap → Mode soleil ──
  await sunBtn.click()
  await expect.poll(() => page.evaluate(() => document.body.className), { timeout: 5000 }).toBe('theme-soleil')

  const on = await snapshot()
  expect(on.colorScheme).toBe('light')                     // soleil traité comme light (applyTheme)
  expect(luminanceOf(on.bg)).toBeGreaterThan(0.7)          // fond quasi-blanc (étal extérieur)
  expect(luminanceOf(on.bg)).toBeGreaterThan(lumBefore)    // bien plus clair qu'avant
  expect(await sunBtn.getAttribute('aria-pressed')).toBe('true')

  // ── 2e tap → restaure le thème précédent ──
  await sunBtn.click()
  await expect.poll(() => page.evaluate(() => document.body.className), { timeout: 5000 }).toBe(before.cls)

  const after = await snapshot()
  expect(after.colorScheme).toBe(before.colorScheme)
  expect(Math.abs(luminanceOf(after.bg) - lumBefore)).toBeLessThan(0.02) // retour au fond initial
  expect(await sunBtn.getAttribute('aria-pressed')).toBe('false')

  expect(errors, `erreurs JS: ${errors.join(' | ')}`).toEqual([])
})
