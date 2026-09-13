import { test, expect } from '@playwright/test'
import { seedEcran, ouvrirEcran } from './ecrans'

/**
 * CARTE DES CLIENTS — OpenStreetMap, vérifiée sur un VRAI moteur de rendu.
 *
 * ⚠️ Aucun octet ne part vers OpenStreetMap ni Photon depuis la CI : les tuiles sont
 * interceptées ici (une image PNG d'un pixel), le géocodeur par le harnais. Faire charger des
 * tuiles réelles à chaque exécution serait du « bulk downloading » au sens de la politique.
 */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64')

async function ouvrirCarte(page: import('@playwright/test').Page, w = 1440) {
  const tuiles: string[] = []
  const google: string[] = []
  await page.route('**/tile.openstreetmap.org/**', r => { tuiles.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }) })
  page.on('request', r => { if (/google(apis)?\.com\/maps|maps\.googleapis/.test(r.url())) google.push(r.url()) })
  await seedEcran(page)
  await ouvrirEcran(page, '/app/customers', w, 1100)
  await expect(page.locator('body')).toContainText(/Clients|Customers/)
  await page.getByRole('button', { name: /^Carte$/ }).first().click()
  await expect(page.getByText('Carte des clients').first()).toBeVisible()
  return { tuiles, google }
}

test('la carte OSM se dessine, place les clients, et respecte les règles d’usage', async ({ page }) => {
  const { tuiles, google } = await ouvrirCarte(page)
  // 3 quartiers distincts + 1 introuvable = 4 requêtes réseau max, espacées d'1,1 s.
  await expect(page.locator('.hs-marker')).toHaveCount(10, { timeout: 15_000 })

  const m = await page.evaluate(() => {
    const attr = document.querySelector('.hs-map .leaflet-control-attribution') as HTMLElement | null
    const carte = document.querySelector('[data-testid="customer-map"]') as HTMLElement | null
    const r = attr?.getBoundingClientRect(), c = carte?.getBoundingClientRect()
    // Élément réellement AU-DESSUS du milieu de l'attribution : elle ne doit pas être couverte.
    const dessus = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null
    return {
      photon: (window as unknown as { __photonAppels?: number }).__photonAppels ?? 0,
      attribution: attr?.textContent ?? '',
      attributionDansCarte: !!(r && c && r.left >= c.left && r.right <= c.right + 1 && r.bottom <= c.bottom + 1),
      attributionVisible: !!(dessus && attr?.contains(dessus)),
    }
  })

  // ⚠️ Le CACHE à l'écran : 10 clients placés, au plus 4 requêtes (3 quartiers + 1 introuvable).
  expect(m.photon, `appels Photon : ${m.photon}`).toBeGreaterThan(0)
  expect(m.photon, `appels Photon : ${m.photon} — le cache n'épargne pas les adresses répétées`).toBeLessThanOrEqual(4)
  // ⚠️ Attribution OBLIGATOIRE (ODbL) : présente, dans la carte, et non recouverte.
  expect(m.attribution).toMatch(/OpenStreetMap/)
  expect(m.attributionDansCarte, 'attribution hors de la carte').toBe(true)
  expect(m.attributionVisible, 'attribution recouverte par un autre élément').toBe(true)
  const contraste = await page.evaluate(() => {
    const el = document.querySelector('.hs-map .leaflet-control-attribution') as HTMLElement
    const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number)
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const st = getComputedStyle(el)
    const [br, bg, bb, ba = 1] = rgb(st.backgroundColor)
    // Fond semi-transparent composé sur le fond sombre de la carte (#0A0A16).
    const fond = [br * ba + 10 * (1 - ba), bg * ba + 10 * (1 - ba), bb * ba + 22 * (1 - ba)]
    const [a, b] = [lum(rgb(st.color)), lum(fond)].sort((x, y) => y - x)
    return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100
  })
  // ⚠️ La première version mesurait ~1,9:1 à l'œil — « clearly » exige au moins l'AA.
  expect(contraste, `contraste de l'attribution ${contraste}:1`).toBeGreaterThanOrEqual(4.5)
  // La carte a bien demandé des tuiles — et plus AUCUNE requête vers Google.
  expect(tuiles.length, 'aucune tuile demandée — la carte ne se dessine pas').toBeGreaterThan(0)
  expect(google, 'une requête part encore vers Google Maps').toEqual([])

  // ⚠️ DEUX listes, jamais une : sans adresse ≠ adresse introuvable.
  await expect(page.getByText(/Clients sans adresse \(1\)/)).toBeVisible()
  await expect(page.getByText(/Adresse introuvable sur la carte \(1\)/)).toBeVisible()

  // Le popup s'ouvre au clic et nomme OpenStreetMap, pas Google.
  // ⚠️ On clique un marqueur RÉELLEMENT au premier plan. Des clients à la même adresse
  // géocodée s'EMPILENT au même point (limite réelle, déjà vraie sous Google) : `.first()`
  // visait un marqueur recouvert, et le clic expirait. Forcer le clic aurait prouvé qu'un
  // élément invisible pour l'utilisateur est cliquable pour le test.
  const cible = await page.evaluate(() => {
    for (const el of [...document.querySelectorAll<HTMLElement>('.hs-marker')]) {
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 3
      const dessus = document.elementFromPoint(x, y)
      if (dessus && el.contains(dessus)) return { x, y }
    }
    return null
  })
  expect(cible, 'aucun marqueur au premier plan — tous recouverts').not.toBeNull()
  await page.mouse.click(cible!.x, cible!.y)
  const popup = page.locator('.hs-map-popup')
  await expect(popup).toBeVisible()
  // ⚠️ ET IL LE RESTE. La première version du composant fermait le popup au rendu SUIVANT
  // (`setSelected` → marqueurs recréés) : une assertion immédiate passait dans la milliseconde
  // qui précédait ce rendu. On laisse React et Leaflet finir, puis on revérifie.
  await page.waitForTimeout(1200)
  await expect(popup, 'le popup s’est refermé après le rendu qui suit le clic').toBeVisible()
  await expect(popup).toContainText('OpenStreetMap')
  await expect(popup.locator('a[href*="openstreetmap.org/search"]')).toHaveCount(1)

  // ⚠️ Le popup porte la couleur du MARQUEUR cliqué — une table à part divergeait sur deux
  // paliers sur quatre. On compare ce qui est RENDU : la couleur lue dans la data-URI de
  // l'icône cliquée, et celle du dégradé d'en-tête du popup.
  const couleurs = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)?.closest('.hs-marker')
    const src = decodeURIComponent(el?.querySelector('img')?.getAttribute('src') ?? '')
    const marqueur = (src.match(/stop-color="(#[0-9A-Fa-f]{6})"/) ?? [])[1] ?? null
    const entete = document.querySelector('.hs-map-popup .leaflet-popup-content > div > div') as HTMLElement | null
    return { marqueur, entete: entete?.getAttribute('style') ?? '' }
  }, cible!)
  expect(couleurs.marqueur, 'couleur du marqueur illisible — le cas ne mesure rien').toMatch(/^#[0-9A-Fa-f]{6}$/)
  expect(couleurs.entete.toLowerCase(), `popup ≠ marqueur (${couleurs.marqueur})`).toContain(couleurs.marqueur!.toLowerCase())

  await page.screenshot({ path: 'test-results/carte-osm.png' })
})

test('thème sombre : SEULES les tuiles sont inversées, jamais les marqueurs', async ({ page }) => {
  await ouvrirCarte(page)
  await expect(page.locator('.hs-marker').first()).toBeVisible({ timeout: 15_000 })
  const f = await page.evaluate(() => ({
    sombre: !!document.querySelector('.hs-map-dark'),
    tuiles: getComputedStyle(document.querySelector('.leaflet-tile-pane')!).filter,
    marqueurs: getComputedStyle(document.querySelector('.leaflet-marker-pane')!).filter,
  }))
  expect(f.sombre, 'le harnais n’est pas en thème sombre — le cas ne mesure rien').toBe(true)
  expect(f.tuiles).toMatch(/invert/)
  // Un violet de palier inversé deviendrait un vert : les marqueurs ne sont JAMAIS filtrés.
  expect(f.marqueurs).toBe('none')
})
