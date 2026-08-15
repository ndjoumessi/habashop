import { test, expect } from '@playwright/test'
import { getPreconditions } from './helpers/preconditions'

// Vérif live des 3 fixes post-review (commit "% source unique + couleurs modulo + cursor:help") :
//  F1 — le % du tooltip == le % de la légende pour CHAQUE catégorie (source unique = catPcts).
//  F3 — les badges devise/langue (lecture seule) ont cursor:'help', pas 'pointer'.
// Auth via storageState (projet `setup`) → aucun login UI, UN SEUL page.goto.
const BASE = process.env.DASH_BASE ?? 'https://habashop.vercel.app'

const TITLES = /CA par catégorie|Revenue by category|Ingresos por categoría|Ricavi per categoria/

test.beforeEach(async () => {
  const pre = await getPreconditions()
  test.skip(!pre.hasRecentSales, 'tenant démo sans ventes récentes (categoryBreakdown vide) — dette suivie #5')
})

test('Dashboard — donut : tooltip % == légende % (source unique) + cursor help badges', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.goto(`${BASE}/app/dashboard`)

  // Panneau « CA par catégorie »
  const panel = page.locator('.panel').filter({ has: page.getByText(TITLES) }).first()
  await expect(panel.getByText(TITLES)).toBeVisible({ timeout: 15000 })

  // Donut rendu (réplique unique → laisser le chart lazy se charger)
  const surface = panel.locator('[data-testid="chart-donut"] svg').first()
  await expect(surface).toBeVisible({ timeout: 12000 })
  const n = await panel.locator('[data-testid="donut-sector"]').count()
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
  //
  // ─── ⚠️ POURQUOI LA LECTURE EST ATOMIQUE — un faux rouge du 2026-08-07 ───────────
  // Ce spec a échoué sur `main` en annonçant « tooltip vs légende pour "Épicerie" :
  // attendu 32, reçu 14 ». Les DEUX nombres étaient JUSTES : Épicerie valait bien 32 %,
  // et 14 % était la part de **Boissons**. Le produit n'a jamais affiché « Épicerie 14 % ».
  //
  // C'est la LECTURE qui appariait mal. Le balayage faisait deux allers-retours distincts
  // vers le navigateur, sans rien pour les synchroniser :
  //
  //     const txt  = await tip.textContent()                          // → le %
  //     const name = await tip.locator('span').first().textContent()  // → le nom
  //
  // La trace du run rouge (31134633027) le montre en toutes lettres, sur deux échantillons
  // consécutifs séparés de 8° :
  //
  //     move → textContent 'Boissons10,98 €14%' · span 'Boissons'   ✅ cohérent
  //     move → textContent 'Boissons10,98 €14%' · span 'Épicerie'   ❌ le rendu s'est
  //                                                                   intercalé entre les deux
  //
  // Le défaut est armé à CHAQUE franchissement de frontière entre deux échantillons — ni
  // par la petitesse d'une part, ni au hasard. Sur ce run : 2 itérations avec infobulle
  // visible, 1 incohérente. Il s'est déclenché deux fois de suite dans le même run (mêmes
  // données, mêmes angles) puis plus au run suivant : géométrie déterministe, course de
  // rendu, pas un aléa.
  //
  // ⚠️ L'ASSERTION F1 N'EST PAS TOUCHÉE, et ne doit pas l'être. Elle a déjà attrapé un vrai
  // défaut produit (« le dernier secteur divergeait de ±1 »). Assouplir un test qui a raison,
  // c'est faire taire la seule chose qui signalerait le défaut suivant.
  const box = await surface.boundingBox()
  expect(box).toBeTruthy()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + box!.height / 2
  const tip = panel.locator('[data-testid="chart-tooltip"]')
  // ⚠️ DIFFÉRENCE AVEC RECHARTS, ASSUMÉE : recharts gardait le conteneur d'infobulle MONTÉ
  // en permanence et basculait sa `visibility` ; notre primitive le monte au survol et le
  // démonte à la sortie — c'est plus honnête pour un lecteur d'écran (rien d'invisible ne
  // traîne dans l'arbre). On l'exige donc APRÈS un premier survol, pas avant : sinon les 45
  // `evaluate` du balayage expireraient l'un après l'autre sur une absence attendue.
  await page.mouse.move(cx + 88, cy)
  await expect(tip).toBeAttached()
  const seen: Record<string, number> = {}

  for (let deg = 0; deg < 360; deg += 8) {
    const rad = (deg * Math.PI) / 180
    await page.mouse.move(cx + 88 * Math.cos(rad), cy + 88 * Math.sin(rad))
    // ⚠️ UNE SEULE LECTURE, ATOMIQUE — cf. l'encadré ci-dessus. Le rappel s'exécute
    // SYNCHRONEMENT dans la page : React ne peut pas commiter un rendu en son milieu, donc
    // le nom et le pourcentage viennent forcément du MÊME état de l'infobulle.
    // La visibilité est décidée ici aussi : la tester par un appel séparé rouvrirait la même
    // fenêtre (visible au test, changée à la lecture), en plus petit.
    const lu = await tip.evaluate((el) => {
      const st = getComputedStyle(el as Element)
      const r = (el as Element).getBoundingClientRect()
      if (st.visibility === 'hidden' || st.display === 'none' || r.width === 0 || r.height === 0) return null
      const txt = (el.textContent ?? '').trim()
      const m = txt.match(/(\d+)%\s*$/)
      const nom = (el.querySelector('span')?.textContent ?? '').trim()
      if (!nom || !m) return null
      return { nom, pct: Number(m[1]), txt }
    })
    if (!lu) continue
    const { nom: name, pct } = lu
    // Garde-fou de la lecture elle-même : le libellé de l'infobulle COMMENCE par le nom
    // (`<span>nom</span>` puis montant puis « N% »). Si ce n'était pas le cas, les deux
    // valeurs ne décriraient pas la même part — c'est exactement le défaut d'avant, et il
    // échouerait ICI, en le nommant, plutôt qu'en accusant l'écart de la ligne F1.
    expect(lu.txt.startsWith(name), `lecture incohérente : « ${lu.txt} » ne commence pas par « ${name} »`).toBe(true)
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
