import { test, expect } from '@playwright/test'

/**
 * MESURE — la page `/f/<jeton>` à la largeur d'un VRAI téléphone.
 *
 * ⚠️ POURQUOI UN E2E ET PAS UN VERROU UNITAIRE : jsdom ne fait AUCUNE mise en page — ni
 * largeur, ni retour à la ligne, ni débordement. `publicInvoicePage.test.tsx` était VERT
 * pendant que la colonne TOTAL sortait de l'écran sur le téléphone de Nelson
 * (2026-10-26) : la table portait `min-width:380px` dans un écran de 360, et il fallait
 * faire défiler latéralement pour voir ce qu'on avait payé. Sur la page dont l'usage EST
 * d'être ouverte au téléphone après un scan de QR.
 *
 * La propriété jugée est le DÉBORDEMENT, jamais un pixel exact : la géométrie diffère
 * entre Ubuntu et macOS, et un seuil au pixel rougirait pour la mauvaise raison.
 */

const LARGEURS = [
  { nom: '360 px — le plus étroit en usage', w: 360, h: 780 },
  { nom: '390 px — iPhone courant', w: 390, h: 844 },
  { nom: '1280 px — bureau', w: 1280, h: 900 },
] as const

const FACTURE = {
  invoiceNumber: null,
  date: '2026-10-25T23:03:00Z',
  status: 'completed',
  paymentMode: 'cash',
  total: 1150, subtotalHT: 975, vatAmount: 175, discountAmount: 0,
  cashAmount: 1150, mobileMoneyAmount: null, cardAmount: null,
  items: [
    { name: 'Haricot vert', qty: 1, unitPrice: 500, total: 500 },
    // Un nom long : c'est lui qui pousse une table à déborder, pas un nom court.
    { name: 'Farine de blé tendre supérieure 1 kg', qty: 12, unitPrice: 650, total: 7800 },
  ],
  customerName: null,
  shop: {
    name: 'HabaShop — Dakar Central', address: 'Rue 10 × 23, Dakar, Sénégal',
    phone: '+221 77 000 00 00', email: 'contact@habashop.sn',
    currency: 'XOF', vatRate: 18, lang: 'fr', ninea: null, rccm: null, vatNumber: null,
  },
}

for (const { nom, w, h } of LARGEURS) {
  test(`reçu public — aucun débordement horizontal à ${nom}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.route('**/api/public/invoice/**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FACTURE) }))

    await page.goto('/f/vente-test~AAAAAAAAAAAAAAAA')
    await page.waitForSelector('table.pi-items tbody tr')

    // 1 · La PAGE ne défile pas latéralement.
    const page_ = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(page_.scroll, 'la page déborde horizontalement').toBeLessThanOrEqual(page_.client + 1)

    // 2 · Le TOTAL de chaque ligne est ENTIÈREMENT dans le champ — c'est le chiffre que
    //     le client vient vérifier, et c'est lui qui partait hors écran.
    const totaux = page.locator('table.pi-items .pi-total')
    await expect(totaux).toHaveCount(FACTURE.items.length)
    for (let k = 0; k < FACTURE.items.length; k++) {
      const box = await totaux.nth(k).boundingBox()
      expect(box, `ligne ${k} sans géométrie`).not.toBeNull()
      expect(box!.x + box!.width, `le total de la ligne ${k} sort de l'écran`).toBeLessThanOrEqual(w)
      expect(box!.x, `le total de la ligne ${k} commence hors écran`).toBeGreaterThanOrEqual(0)
    }

    // 3 · Aucun conteneur interne ne défile non plus (le défaut d'origine était là).
    const debordants = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .filter(el => el.scrollWidth > el.clientWidth + 1)
        .map(el => `${el.tagName.toLowerCase()}.${el.className || '—'}`))
    expect(debordants, 'des conteneurs défilent latéralement').toEqual([])
  })
}

/**
 * ⚠️ Les deux assertions ci-dessus ne gardaient QUE l'absence de débordement — et le
 * sabotage l'a montré : supprimer le repliement sous 560 px les laissait VERTES, parce
 * que sans `min-width` une table à 4 colonnes se comprime et tient, au prix de colonnes
 * étranglées et d'un nom qui s'enroule sur quatre lignes. Le retrait du `min-width` est
 * le correctif du DÉBORDEMENT ; le repliement est celui de la LISIBILITÉ. Deux propriétés,
 * donc deux mesures — sinon la moitié de ce qui est livré n'est gardée par personne.
 */
test('⚠️ sous 560 px, les lignes sont REPLIÉES : le nom occupe toute la largeur', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.route('**/api/public/invoice/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FACTURE) }))
  await page.goto('/f/vente-test~AAAAAAAAAAAAAAAA')
  await page.waitForSelector('table.pi-items tbody tr')
  const part = await page.evaluate(() => {
    const ligne = document.querySelector<HTMLElement>('table.pi-items tbody tr')!
    const nom = ligne.querySelector<HTMLElement>('.pi-nom')!
    return nom.getBoundingClientRect().width / ligne.getBoundingClientRect().width
  })
  expect(part, 'le nom ne prend pas toute la ligne → pas replié').toBeGreaterThan(0.9)
})

test('au-dessus de 560 px, la table reste une TABLE (le repliement ne déborde pas du mobile)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.route('**/api/public/invoice/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FACTURE) }))
  await page.goto('/f/vente-test~AAAAAAAAAAAAAAAA')
  await page.waitForSelector('table.pi-items tbody tr')
  const part = await page.evaluate(() => {
    const ligne = document.querySelector<HTMLElement>('table.pi-items tbody tr')!
    const nom = ligne.querySelector<HTMLElement>('.pi-nom')!
    return nom.getBoundingClientRect().width / ligne.getBoundingClientRect().width
  })
  expect(part, 'le nom prend toute la ligne → replié à tort sur grand écran').toBeLessThan(0.9)
})

/**
 * ⚠️ Mesuré sur capture le 2026-10-26 : replié, le bloc de référence prenait la largeur de
 * sa plus longue ligne, et `text-align:right` calait les autres sur CE bord — « FACTURE »,
 * « N° FAC-… » et « Date : » ne partageaient aucun bord commun. Invisible à tsc, invisible
 * à la mesure de débordement : il n'y avait aucun débordement, juste un escalier.
 */
test('⚠️ sous 560 px, les trois lignes de l’en-tête partagent le MÊME bord gauche', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.route('**/api/public/invoice/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...FACTURE, invoiceNumber: 'FAC-2026-00015' }) }))
  await page.goto('/f/vente-test~AAAAAAAAAAAAAAAA')
  await page.waitForSelector('.pi-ref')
  // ⚠️ On mesure le TEXTE, pas la boîte. Les trois `<div>` sont de niveau bloc : leur
  // `getBoundingClientRect()` vaut la pleine largeur quel que soit l'alignement, donc une
  // assertion sur leurs bords est VIDE — vérifié, le sabotage passait au vert. Un `Range`
  // sur le contenu rend la boîte réellement encrée.
  const bords = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.pi-ref > div')].map(el => {
      const r = document.createRange()
      r.selectNodeContents(el)
      return Math.round(r.getBoundingClientRect().left)
    }))
  expect(bords.length, 'en-tête incomplet').toBeGreaterThanOrEqual(3)
  // Tolérance 1 px : on juge l'alignement, jamais un pixel exact (la géométrie diffère
  // entre Ubuntu et macOS).
  expect(Math.max(...bords) - Math.min(...bords), `bords : ${bords.join(', ')}`).toBeLessThanOrEqual(1)
})

test('reçu public — le montant reste lisible, pas tronqué par une ellipse', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.route('**/api/public/invoice/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FACTURE) }))
  await page.goto('/f/vente-test~AAAAAAAAAAAAAAAA')
  await page.waitForSelector('table.pi-items tbody tr')
  // Un `text-overflow:ellipsis` masquerait le défaut au lieu de le corriger : le texte
  // rendu doit porter le montant ENTIER.
  await expect(page.locator('table.pi-items .pi-total').nth(1)).toContainText('7 800')
})
