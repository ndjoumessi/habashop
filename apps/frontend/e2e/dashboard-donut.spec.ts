import { test, expect } from '@playwright/test'

// Vérif live des 3 fixes post-review (commit "% source unique + couleurs modulo + cursor:help") :
//  F1 — le % du tooltip == le % de la légende pour CHAQUE catégorie (source unique = catPcts).
//  F3 — les badges devise/langue (lecture seule) ont cursor:'help', pas 'pointer'.
// Auth via storageState (projet `setup`) → aucun login UI, UN SEUL page.goto.
const BASE = process.env.DASH_BASE ?? 'https://habashop.vercel.app'

const TITLES = /CA par catégorie|Revenue by category|Ingresos por categoría|Ricavi per categoria/

test('Dashboard — donut : tooltip % == légende % (source unique) + cursor help badges', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.goto(`${BASE}/app/dashboard`)

  // Panneau « CA par catégorie »
  const panel = page.locator('.panel').filter({ has: page.getByText(TITLES) }).first()
  await expect(panel.getByText(TITLES)).toBeVisible({ timeout: 15000 })

  // Donut rendu (réplique unique → laisser le chart lazy se charger)
  const surface = panel.locator('.recharts-surface').first()
  await expect(surface).toBeVisible({ timeout: 12000 })
  const n = await panel.locator('.recharts-pie-sector').count()
  expect(n, 'le donut doit avoir au moins une catégorie sur le tenant démo').toBeGreaterThan(0)

  // Légende : name -> pct (textContent d'une ligne = "Épicerie33%" → on parse nom + %)
  const legend: Record<string, number> = await panel.evaluate((el, titles) => {
    const re = new RegExp(titles)
    // la légende = dernier conteneur flex-column du panneau ; ses lignes finissent par "N%"
    // une ligne de légende = 2 spans en enfants directs (nom + « N% »), pas le conteneur
    const rows = Array.from(el.querySelectorAll('div')).filter(d => {
      const t = (d.textContent ?? '').trim()
      return /\d+%$/.test(t) && d.querySelectorAll(':scope > span').length === 2 && !re.test(t)
    })
    const out: Record<string, number> = {}
    for (const r of rows) {
      const t = (r.textContent ?? '').trim()
      const m = t.match(/^(.*?)(\d+)%$/)
      if (m) out[m[1].trim()] = Number(m[2])
    }
    return out
  }, TITLES.source)

  expect(Object.keys(legend).length, 'la légende doit lister des catégories').toBeGreaterThan(0)

  // Balayage de l'anneau du donut (innerR 68 / outerR 108 → r≈88 px) : le survol d'un point
  // SUR l'arc déclenche le tooltip recharts (un hover() centré sur la bbox d'un secteur
  // tomberait dans le trou central → pas de tooltip). On collecte name -> pct vus.
  const box = await surface.boundingBox()
  expect(box).toBeTruthy()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + box!.height / 2
  const tip = panel.locator('.recharts-tooltip-wrapper')
  const seen: Record<string, number> = {}

  for (let deg = 0; deg < 360; deg += 8) {
    const rad = (deg * Math.PI) / 180
    await page.mouse.move(cx + 88 * Math.cos(rad), cy + 88 * Math.sin(rad))
    if (!(await tip.isVisible())) continue
    const txt = (await tip.textContent())?.trim() ?? ''
    const name = (await tip.locator('span').first().textContent())?.trim() ?? ''
    const pct = Number((txt.match(/(\d+)%\s*$/) ?? [])[1])
    if (!name || Number.isNaN(pct)) continue
    expect(pct, `tooltip "${name}" ne doit jamais afficher 0%`).toBeGreaterThan(0)
    if (legend[name] !== undefined) {
      // F1 : strictement égal à la légende (avant le fix, le dernier slice divergeait de ±1)
      expect(pct, `tooltip vs légende pour "${name}"`).toBe(legend[name])
    }
    seen[name] = pct
  }

  expect(Object.keys(seen).length, 'au moins une part a déclenché un tooltip lisible').toBeGreaterThan(0)

  // Anti-test-vacant : au moins une catégorie doit exister DANS le tooltip ET la légende,
  // sinon l'égalité stricte F1 ci-dessus ne se serait jamais exécutée.
  const matched = Object.keys(seen).filter(k => legend[k] !== undefined)
  expect(matched.length, `tooltip∩légende vide — seen=${JSON.stringify(seen)} legend=${JSON.stringify(legend)}`).toBeGreaterThan(0)

  // F3 : badges devise + langue en lecture seule → cursor:'help'
  const helpCount = await page.locator('button.icon-btn').evaluateAll(
    btns => btns.filter(b => getComputedStyle(b as Element).cursor === 'help').length,
  )
  expect(helpCount, 'badges devise + langue doivent avoir cursor:help').toBeGreaterThanOrEqual(2)

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([])
})
