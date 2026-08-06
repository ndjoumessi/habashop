import { test, expect, type Page } from '@playwright/test'

/**
 * MESURE — la table dense de la console Ops ne déborde à AUCUNE des trois largeurs.
 *
 * ─── CE QUE CE SPEC FAIT QUE LE VERROU UNITAIRE NE PEUT PAS ──────────────────
 * `adminTableDense.test.tsx` exerce la table à 50 lignes en **jsdom**, qui ne fait aucune
 * mise en page : ni largeur, ni retour à la ligne, ni débordement. Il prouve la STRUCTURE
 * (le bon nombre de lignes, de cellules, les bonnes valeurs) — jamais la GÉOMÉTRIE.
 * Ici on mesure `scrollWidth` et des hauteurs de cellules dans un vrai moteur de rendu.
 *
 * ─── POURQUOI UN HARNAIS, ET PAS `/admin` ────────────────────────────────────
 * ⚠️ Le compte E2E est SUPER_ADMIN **de boutique** : `/admin` lui est masqué PAR CONCEPTION
 * (garde P0 d'isolation inter-tenants — `App.tsx` `PlatformAdminOnly`, `Sidebar.tsx`, figée
 * par `smoke.spec.ts`). L'échec d'accès est le BON comportement, et on ne desserre pas un
 * garde pour se donner un instrument. Mais la garde protège la ROUTE, pas le COMPOSANT :
 * `/__dev/table` rend le même composant, et n'existe qu'en développement — absence du bundle
 * livré VÉRIFIÉE par `npm run verify:demo-flag`, pas affirmée.
 *
 * ─── LANCER ──────────────────────────────────────────────────────────────────
 *   npm run e2e:density --workspace=apps/frontend      (démarre `vite dev` tout seul)
 */

const LARGEURS = [
  { nom: '2560 px — grand écran', w: 2560, h: 1440 },
  { nom: '1440 px — portable',    w: 1440, h: 900 },
  { nom: '390 px — téléphone',    w: 390,  h: 844 },
]

/**
 * ⚠️ IDENTITÉ DU SERVEUR, AVANT LA PREMIÈRE MESURE.
 * `reuseExistingServer: false` empêche de se BRANCHER sur un serveur existant ; il ne prouve
 * pas que celui auquel on parle est celui qu'on a démarré. Un port n'est pas une identité.
 * La config injecte un jeton unique par exécution ; le harnais le rend. S'il ne correspond
 * pas, on échoue ICI avec un message qui le DIT — pas par un timeout de sélecteur trente
 * secondes plus tard, qui ressemblerait à un défaut de la table.
 */
async function verifierIdentite(page: Page) {
  const attendu = process.env.HARNESS_NONCE
  const racine = page.locator('[data-harness-nonce]')
  // ⚠️ On ATTEND le marqueur — le harnais rend `null` jusqu'à son `useEffect`, donc un
  // `count()` immédiat après `goto` vaut 0 même sur le bon serveur (mesuré : 4 rouges).
  // Délai court et VOLONTAIREMENT inférieur au timeout de sélecteur qu'il remplace : la
  // question « est-ce le bon serveur ? » doit trancher vite, pas après trente secondes.
  await racine.first().waitFor({ state: 'attached', timeout: 15_000 }).catch(() => {
    throw new Error([
      'Le harnais /__dev/table n’a rendu AUCUN marqueur d’identité en 15 s.',
      'Le serveur qui répond sur ce port n’est pas celui qu’on a démarré,',
      'ou le harnais n’est pas chargé (build de production ? autre application ?).',
    ].join('\n'))
  })
  const vu = await racine.first().getAttribute('data-harness-nonce')
  expect(vu, [
    `Marqueur d’identité DIFFÉRENT — attendu « ${attendu} », vu « ${vu} ».`,
    'Un autre serveur écoute sur le port attendu : les mesures qui suivraient',
    'porteraient sur une page qui n’est pas la nôtre.',
  ].join('\n')).toBe(attendu)
}

async function ouvrir(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h })
  await page.goto('/__dev/table?n=50')
  await verifierIdentite(page)
  // ⚠️ L'onglet « Boutiques » est un `role="tab"`, pas un `button` — premier essai raté sur
  // ce détail : la table n'était jamais rendue, et les quatre cas échouaient sur un timeout
  // qui ressemblait à un défaut de données. On l'atteint par son libellé, jamais par un index.
  await page.getByRole('tab', { name: /Boutiques|Shops/i }).first().click()
  await page.locator('.table-wrap table.data-table tbody tr').first().waitFor({ timeout: 20_000 })
}

test.describe('table dense — géométrie réelle', () => {
  for (const { nom, w, h } of LARGEURS) {
    test(`${nom} : le conteneur ne déborde pas, aucune cellule monétaire n'est enroulée`, async ({ page }) => {
      await ouvrir(page, w, h)

      const lignes = page.locator('.table-wrap table.data-table tbody tr')
      // ⚠️ COUVERTURE : sans ça, une table vide rendrait tous les cas suivants verts.
      expect(await lignes.count(), 'la table doit porter les 50 lignes du harnais').toBe(50)

      // ── (1) LE DÉBORDEMENT EST-IL CONTENU ? ──────────────────────────────
      // On n'exige PAS `scrollWidth <= clientWidth` sur le conteneur : à 390 px la table est
      // volontairement plus large et `.table-wrap` DÉFILE (`overflow-x:auto`). Ce qu'on exige,
      // c'est que le débordement reste DANS le conteneur — jamais sur la page. Une page qui
      // défile horizontalement, c'est l'écran cassé ; un conteneur qui défile, c'est le dessin.
      const doc = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      expect(doc.scroll, `la PAGE défile horizontalement (${doc.scroll} > ${doc.client})`)
        .toBeLessThanOrEqual(doc.client + 1)   // +1 : arrondi sous-pixel

      const conteneur = await page.locator('.table-wrap').first().evaluate(el => ({
        scroll: el.scrollWidth, client: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
      }))
      // ⚠️ Le conteneur doit POUVOIR défiler : sans `overflow-x`, un débordement déborderait
      // sur la page — c'est le second sabotage.
      expect(['auto', 'scroll'], `.table-wrap doit défiler (overflowX = ${conteneur.overflowX})`)
        .toContain(conteneur.overflowX)

      // ── (2) AUCUNE CELLULE MONÉTAIRE ENROULÉE ────────────────────────────
      // Un montant à neuf chiffres qui passe à la ligne double la hauteur de SA ligne et
      // désaligne toute la table. C'est invisible en jsdom : il faut un moteur de rendu.
      const enroulees = await page.evaluate(() => {
        const out: { ligne: number; texte: string; nbLignes: number; hLigne: number }[] = []
        const trs = [...document.querySelectorAll('.table-wrap table.data-table tbody tr')]
        trs.forEach((tr, i) => {
          const hLigne = (tr as HTMLElement).getBoundingClientRect().height
          for (const td of [...tr.querySelectorAll('td.td-num')]) {
            const e = td as HTMLElement
            // ⚠️ DEUX détecteurs faux avant celui-ci, et les deux criaient au loup :
            //   1. hauteur du `<td>` (41 px, padding compris) vs `line-height` (~19 px) —
            //      vrai partout, le test rougissait sur du code correct ;
            //   2. hauteur de contenu ÷ `line-height` — mieux, mais un `<td>` s'étire à la
            //      hauteur de SA RANGÉE : quand le nom de boutique voisin passe à deux
            //      lignes (colonne élastique, comportement VOULU), toutes les cellules de la
            //      rangée mesurent deux lignes sans qu'aucune ne se soit enroulée.
            // On mesure donc le TEXTE lui-même : un `Range` rend un rectangle PAR LIGNE
            // RENDUE. Un montant qui tient sur une ligne en rend exactement 1.
            const r = document.createRange()
            r.selectNodeContents(e)
            const nbLignes = r.getClientRects().length
            if (nbLignes > 1) out.push({ ligne: i, texte: e.textContent ?? '', nbLignes, hLigne })
          }
        })
        return out
      })
      expect(enroulees, `cellules monétaires enroulées : ${JSON.stringify(enroulees.slice(0, 4))}`).toEqual([])
    })
  }

  test('les trois largeurs, mesurées et rendues', async ({ page }) => {
    const mesures: string[] = []
    for (const { w, h } of LARGEURS) {
      await ouvrir(page, w, h)
      const m = await page.locator('.table-wrap').first().evaluate(el => ({
        s: el.scrollWidth, c: el.clientWidth,
      }))
      const doc = await page.evaluate(() => document.documentElement.scrollWidth)
      mesures.push(`  ${String(w).padStart(4)} px → .table-wrap ${m.s}/${m.c} px (${m.s > m.c ? 'défile' : 'tient'}) · page ${doc} px`)
    }
    // eslint-disable-next-line no-console
    console.log('\n── GÉOMÉTRIE MESURÉE ──\n' + mesures.join('\n') + '\n')
  })
})
