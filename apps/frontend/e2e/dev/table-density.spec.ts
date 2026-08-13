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
 *
 * ─── ⚠️ AUCUN PIXEL EXACT N'EST ASSERTÉ, ET C'EST DÉLIBÉRÉ ───────────────────
 * MESURÉ le 2026-08-07, même commit, deux machines :
 *
 *     390 px    macOS local   .table-wrap 1223/342 px
 *               runner Ubuntu .table-wrap 1232/342 px      ← 9 px d'écart
 *     1440 px   les deux      1392/1392 px  (identique)
 *     2560 px   les deux      2512/2512 px  (identique)
 *
 * L'écart vient du rendu de POLICE : à 390 px la colonne élastique porte du texte, donc sa
 * largeur naturelle dépend des métriques de la fonte installée ; aux deux autres largeurs la
 * table tient dans son conteneur et la mesure est bornée par la mise en page, pas par le
 * texte. Figer « 1223 » aurait donc produit un rouge sur le runner **sans qu'aucune
 * régression n'existe** — un verrou qui crie au loup se fait désarmer.
 * Les assertions portent sur le DÉBORDEMENT (`scrollWidth > clientWidth` du conteneur, et
 * jamais de la page) et sur l'ENROULEMENT (`Range.getClientRects().length`). Ces deux
 * propriétés sont invariantes par changement de fonte ; les largeurs, non.
 */

const LARGEURS = [
  { nom: '2560 px — grand écran', w: 2560, h: 1440 },
  { nom: '1440 px — portable',    w: 1440, h: 900 },
  { nom: '390 px — téléphone',    w: 390,  h: 844 },
]

/**
 * DÉTECTEUR D'ENROULEMENT — partagé par les deux tables.
 *
 * ⚠️ Il descend jusqu'aux FEUILLES, et ce n'est pas un raffinement : la cellule Marge
 * du Stock porte DEUX unités de lecture (« 29% », puis le montant en `display:block`
 * dessous). Un `Range` posé sur le `<td>` entier y rendrait 2 rectangles et crierait
 * au loup sur un rendu correct — le troisième détecteur faux de cette famille, après
 * les deux déjà racontés plus bas. On mesure donc chaque unité SÉPARÉMENT : les nœuds
 * texte directs du `<td>`, et chaque élément descendant sans enfant élément.
 *
 * Sur une cellule qui ne contient que du texte — le cas de la console Ops — cela rend
 * exactement la mesure d'avant : une seule unité, un seul `Range`. La généralisation
 * ne perd donc rien de ce que l'ancien détecteur distinguait.
 *
 * ⚠️ Fonction AUTONOME : Playwright en sérialise la source vers le navigateur, elle ne
 * peut donc rien capturer de sa portée englobante.
 */
function detecterEnroulement(selecteurLignes: string) {
  const out: { ligne: number; texte: string; nbLignes: number }[] = []
  const trs = [...document.querySelectorAll(selecteurLignes)]
  trs.forEach((tr, i) => {
    for (const td of [...tr.querySelectorAll('td.td-num')]) {
      const unites: Node[] = []
      for (const n of [...td.childNodes]) {
        if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim()) unites.push(n)
      }
      for (const el of [...td.querySelectorAll('*')]) {
        if (el.children.length === 0 && (el.textContent ?? '').trim()) unites.push(el)
      }
      for (const u of unites) {
        const r = document.createRange()
        r.selectNodeContents(u)
        const nbLignes = r.getClientRects().length
        if (nbLignes > 1) out.push({ ligne: i, texte: (u.textContent ?? '').trim(), nbLignes })
      }
    }
  })
  return out
}

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
      // ⚠️ DEUX détecteurs faux avant celui-ci, et les deux criaient au loup :
      //   1. hauteur du `<td>` (41 px, padding compris) vs `line-height` (~19 px) —
      //      vrai partout, le test rougissait sur du code correct ;
      //   2. hauteur de contenu ÷ `line-height` — mieux, mais un `<td>` s'étire à la
      //      hauteur de SA RANGÉE : quand le nom de boutique voisin passe à deux
      //      lignes (colonne élastique, comportement VOULU), toutes les cellules de la
      //      rangée mesurent deux lignes sans qu'aucune ne se soit enroulée.
      // On mesure donc le TEXTE lui-même : un `Range` rend un rectangle PAR LIGNE
      // RENDUE. Un montant qui tient sur une ligne en rend exactement 1. (Le troisième
      // piège — une cellule à deux unités de lecture — est traité dans le détecteur.)
      const enroulees = await page.evaluate(detecterEnroulement, '.table-wrap table.data-table tbody tr')
      expect(enroulees, `cellules monétaires enroulées : ${JSON.stringify(enroulees.slice(0, 4))}`).toEqual([])
    })
  }

  test('les trois largeurs, mesurées et rendues (console Ops)', async ({ page }) => {
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

/* ════════════════════════════════════════════════════════════════════════════
   TABLE DU STOCK — vue LISTE
   ════════════════════════════════════════════════════════════════════════════
   Ajoutée le 2026-08-13, après DEUX défauts trouvés à l'œil sur une capture de
   production et qu'aucun garde du dépôt ne pouvait voir :
     • la table débordait de 80 px À TOUTES les largeurs, 1440 comprise — le bouton
       Supprimer était coupé en deux ;
     • le montant de la cellule Marge s'enroulait, donnant des rangées inégales.
   Les deux sont des propriétés de MISE EN PAGE : `tsc`, les 1 390 tests unitaires et
   la revue les ont tous laissés passer, parce qu'aucun ne fait de mise en page.

   ─── ⚠️ CE QUE CE HARNAIS NE PROUVE PAS ────────────────────────────────────
   Il rend `StockInventory` SANS la barre latérale de l'application : son conteneur
   est donc PLUS LARGE que celui de l'écran réel (mesuré à 1 078 px pour une fenêtre
   de 1 440 px). Un « ça tient » mesuré ici ne dirait rien de l'application.

   ─── LE BUDGET NE PORTE PAS SUR LA LARGEUR TOTALE, ET C'EST MESURÉ ─────────
   Première tentative : « largeur naturelle ≤ 1 078 px ». Elle a rougi à 1 147 px sur
   du code CORRECT. La colonne Produit est ÉLASTIQUE — elle prend la largeur du plus
   long nom — et les noms générés ici sont un peu plus larges que ceux de la
   production (295 px contre 228). Le budget mesurait donc mon générateur de noms.

   Le budget porte sur les colonnes NON ÉLASTIQUES — tout sauf Produit. Ce sont
   elles qu'une colonne ajoutée fait grossir, et elles ne dépendent pas des noms :
   montants, pastilles, boutons. Mesuré 850 px ici, 849 px en production — l'écart
   entre le harnais et le produit est de 1 px sur cette somme, contre 67 sur le total.
   C'est ce qui en fait une grandeur mesurable, et pas une observation recopiée.     */

/**
 * 1 078 px = largeur de CONTENU de l'application à 1440 px (fenêtre moins la barre
 * latérale et les marges, mesurée en production). On en réserve ~200 px au nom du
 * produit : le reste des colonnes doit tenir dans 880.
 * ⚠️ Mesuré à 850 px — 30 px de marge, calibrés sur la variation de police observée
 * entre macOS et Ubuntu sur l'autre table (9 px). Une colonne ajoutée en coûte 65 à
 * 160 : la sensibilité au défaut reste largement supérieure au bruit.
 */
const BUDGET_COLONNES_FIXES = 880

async function ouvrirStock(page: Page, w: number, h: number, extremes = false, n = 24) {
  await page.setViewportSize({ width: w, height: h })
  await page.goto(`/__dev/table?vue=stock&n=${n}${extremes ? '&extremes=1' : ''}`)
  await verifierIdentite(page)
  await page.locator('.table-wrap.stock-table table tbody tr').first().waitFor({ timeout: 20_000 })
}

const LIGNES_STOCK = '.table-wrap.stock-table table tbody tr'

test.describe('table du Stock (vue liste) — géométrie réelle', () => {
  test(`colonnes non élastiques ≤ ${BUDGET_COLONNES_FIXES} px — la table entre dans l'écran de l'application`, async ({ page }) => {
    // À 390 px la table est plus large que son conteneur : les colonnes sont alors à
    // leur largeur NATURELLE, celle qu'elles réclament si on les laisse faire. Au-delà,
    // la table s'étire (`width:100%`) et les mesures ne diraient plus rien.
    await ouvrirStock(page, 390, 844)

    // ⚠️ COUVERTURE : sans ça, une table vide rendrait les assertions suivantes vertes.
    // 24 = la taille de page de `usePagination` dans `Stock.tsx`, pas un nombre choisi.
    expect(await page.locator(LIGNES_STOCK).count(), 'la table doit porter les 24 lignes de la page').toBe(24)

    const cols = await page.evaluate(() =>
      [...document.querySelectorAll('.table-wrap.stock-table thead th')]
        .map(th => ({ titre: (th.textContent || '(case)').trim(), w: th.getBoundingClientRect().width })))
    expect(cols.length, 'aucune colonne lue — le sélecteur ne garde rien').toBeGreaterThanOrEqual(8)

    // ⚠️ La colonne élastique est écartée par sa POSITION (la 2e), jamais par son
    // libellé : « Produit » se traduit, et un verrou qui juge un libellé rougit à la
    // première traduction. Elle est nommée dans le message, pas dans le critère.
    const elastique = cols[1]
    const fixes = cols.filter((_, i) => i !== 1)
    const somme = Math.round(fixes.reduce((a, c) => a + c.w, 0))

    expect(somme, [
      `Les colonnes non élastiques réclament ${somme} px, budget ${BUDGET_COLONNES_FIXES} px.`,
      `Détail : ${fixes.map(c => `${c.titre} ${Math.round(c.w)}`).join(' · ')}`,
      `(colonne élastique écartée : « ${elastique.titre} » ${Math.round(elastique.w)} px)`,
      '',
      'Au-delà du budget, la table déborde de l’écran de l’application à 1440 px — la',
      'plus large des largeurs testées — et les colonnes de droite (Statut, Actions)',
      'sont coupées. C’est exactement le défaut du 2026-08-13 : le bouton Supprimer',
      'était rendu à moitié.',
      '',
      'Ne PAS relever ce budget pour faire passer un commit. Une colonne se paie sur les',
      'autres : c’est le retrait de « Fournisseur » — 118 px pour UNE valeur sur les 37',
      'produits de la production — qui avait rendu la place.',
    ].join('\n')).toBeLessThanOrEqual(BUDGET_COLONNES_FIXES)
  })

  for (const { nom, w, h } of LARGEURS) {
    test(`${nom} : la page ne défile pas, aucun montant n'est enroulé`, async ({ page }) => {
      // ⚠️ Jeu de données EXTRÊME ici — montants à neuf chiffres, noms très longs.
      // L'enroulement ne se déclenche que sous contrainte : le mesurer sur des valeurs
      // confortables reviendrait à démontrer sur le cas qui ne peut pas échouer.
      await ouvrirStock(page, w, h, true)

      expect(await page.locator(LIGNES_STOCK).count(), 'la table doit porter les 24 lignes').toBe(24)

      // ── (1) LE DÉBORDEMENT RESTE-T-IL DANS LE CONTENEUR ? ────────────────
      // Une PAGE qui défile horizontalement, c'est l'écran cassé ; un conteneur qui
      // défile, c'est le dessin. On n'exige donc pas que la table tienne — à 390 px et
      // sur des montants à neuf chiffres, elle ne le peut pas.
      const doc = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      expect(doc.scroll, `la PAGE défile horizontalement (${doc.scroll} > ${doc.client})`)
        .toBeLessThanOrEqual(doc.client + 1)

      const overflowX = await page.locator('.table-wrap.stock-table').first()
        .evaluate(el => getComputedStyle(el).overflowX)
      expect(['auto', 'scroll'], `.table-wrap doit défiler (overflowX = ${overflowX})`).toContain(overflowX)

      // ── (2) AUCUN MONTANT ENROULÉ ────────────────────────────────────────
      // Le défaut exact du 2026-08-13 : « 2 000 FCFA » passait à la ligne dans la
      // colonne Marge (73 px), donnant une cellule à trois lignes.
      const enroulees = await page.evaluate(detecterEnroulement, LIGNES_STOCK)
      expect(enroulees, `montants enroulés : ${JSON.stringify(enroulees.slice(0, 4))}`).toEqual([])
    })
  }

  /* ══════════════════════════════════════════════════════════════════════════
     VUE GRILLE — les tuiles
     ══════════════════════════════════════════════════════════════════════════
     Deux défauts corrigés le 2026-08-12/13, tous deux trouvés sur une capture :
       • les tuiles s'ÉTIRAIENT quand il en restait peu (`auto-fit` effondre les
         colonnes vides) — deux cartes de 900 px portant un émoji de 38 px ;
       • le NOM du produit ne disposait que de 43 px pour en réclamer 96 à 117,
         donc six produits sur six tronqués au tiers.
     Les deux sont invisibles en jsdom, et le second ne se voit QUE sur des noms de
     longueur réaliste : c'est pourquoi le cas ci-dessous n'utilise pas le jeu extrême. */

  const TUILES = '[role="listitem"]'
  /**
   * Une tuile est DESSINÉE autour de 200 px (`min` de la grille) ; les colonnes
   * s'élargissent un peu pour remplir la rangée. 320 px est le seuil au-delà duquel
   * elle n'est plus une tuile mais une bannière : sous `auto-fit`, deux articles dans
   * un conteneur de 1 342 px en faisaient 666 chacune. Le budget discrimine donc
   * largement — il ne mesure pas un pixel, il sépare deux régimes.
   */
  const BUDGET_TUILE = 320

  async function ouvrirGrille(page: Page, w: number, h: number, n: number) {
    await ouvrirStock(page, w, h, false, n)
    await page.getByRole('button', { name: 'Vue grille' }).first().click()
    await page.locator(TUILES).first().waitFor({ timeout: 20_000 })
  }

  test(`peu d'articles : les tuiles ne s'étirent pas (≤ ${BUDGET_TUILE} px)`, async ({ page }) => {
    // ⚠️ DEUX articles — le défaut ne se voit QUE lorsqu'il en reste moins que de
    // colonnes. Une grille pleine masque `auto-fit` : c'est ce qui l'avait laissé
    // passer, et c'est la même leçon que le camembert calé sur 6 catégories.
    await ouvrirGrille(page, 1440, 900, 2)

    const tuiles = page.locator(TUILES)
    expect(await tuiles.count(), 'la grille doit porter les 2 articles').toBe(2)

    const l = await page.evaluate(sel => ({
      largeurs: [...document.querySelectorAll(sel)].map(e => Math.round(e.getBoundingClientRect().width)),
      conteneur: Math.round((document.querySelector(sel)!.parentElement as HTMLElement).getBoundingClientRect().width),
    }), TUILES)

    expect(Math.max(...l.largeurs), [
      `Tuiles de ${l.largeurs.join(' et ')} px dans un conteneur de ${l.conteneur} px.`,
      '',
      'Au-delà du budget, les tuiles ABSORBENT la largeur laissée libre : c’est la',
      'signature d’`auto-fit`, qui effondre les colonnes vides. `ResponsiveGrid` doit',
      'recevoir `mode="fill"` sur une grille d’ARTICLES — jamais sur un formulaire, où',
      'un champ DOIT remplir sa colonne.',
    ].join('\n')).toBeLessThanOrEqual(BUDGET_TUILE)
  })

  for (const { nom, w, h } of [LARGEURS[0], LARGEURS[1]]) {
    test(`${nom} : le nom du produit tient ENTIER dans la tuile`, async ({ page }) => {
      // Noms de longueur RÉALISTE : c'est la seule échelle où la question a un sens.
      // Sur un nom de 62 caractères le clamp à 2 lignes coupe — et c'est VOULU, il
      // borne la hauteur pour que les tuiles de la grille restent alignées.
      await ouvrirGrille(page, w, h, 24)
      expect(await page.locator(TUILES).count(), 'la grille doit porter les 24 articles').toBe(24)

      // ⚠️ ON MESURE LES DEUX AXES, et ce n'est pas de la prudence : la forme
      // d'ORIGINE du défaut coupait à l'HORIZONTALE (`overflow:hidden` +
      // `textOverflow:ellipsis` + `nowrap`), pas à la verticale. Un détecteur limité à
      // la hauteur serait resté VERT sur le défaut exact qu'il prétend garder —
      // vérifié en rejouant le sabotage. C'est l'angle mort « forme » : un verrou qui
      // cherche ce que le défaut ne produit pas ne garde rien.
      const noms = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="stock-tile-name"]')].map(e => ({
          texte: (e.textContent ?? '').trim(),
          hVisible: Math.round(e.clientHeight), hReel: Math.round(e.scrollHeight),
          lVisible: Math.round(e.clientWidth), lReel: Math.round(e.scrollWidth),
        })))
      expect(noms.length, 'aucun nom lu — la poignée `stock-tile-name` a disparu').toBe(24)

      const coupes = noms.filter(n => n.hReel > n.hVisible + 1 || n.lReel > n.lVisible + 1)
      expect(coupes, [
        `Noms coupés : ${JSON.stringify(coupes.slice(0, 3))}`,
        '',
        'Un nom de longueur ordinaire doit tenir entier dans la tuile. Le 2026-08-13 il',
        'ne disposait que de 43 px — partagés avec la vignette, la case à cocher et le',
        'badge de statut, ce dernier en `flexShrink:0` — pour en réclamer 96 à 117.',
        'La correction lui a donné sa propre ligne : ne pas le remettre dans la rangée',
        'des badges.',
      ].join('\n')).toEqual([])
    })
  }

  /* ══════════════════════════════════════════════════════════════════════════
     LA VIGNETTE PRODUIT — géométrie RENDUE
     ══════════════════════════════════════════════════════════════════════════
     `productThumb.test.tsx` garde la FORME des appels et écrit lui-même sa limite :
     « Ce verrou juge donc la FORME de l'appel, faute de pouvoir juger le rendu. »
     C'est ce rendu qu'on mesure ici — et le défaut du 2026-08-12 est exactement de
     ceux qu'une règle de source rate par un autre chemin : la vignette était livrée
     ÉTIRÉE EN BANDEAU, une tranche de photo illisible.

     ⚠️ IL AVAIT DORMI DEPUIS LE CÂBLAGE DES DIX SURFACES, parce qu'un émoji est du
     TEXTE CENTRÉ : il se moque de la largeur de sa boîte. Une vignette peut donc être
     complètement cassée et paraître saine tant qu'aucun produit n'a de photo. D'où
     l'image RÉELLE ci-dessous — une `data:` URI, sans réseau ni stockage objet.      */

  test('la vignette est CARRÉE et la photo la remplit, à toutes les tailles', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/__dev/table?vue=photo')
    await verifierIdentite(page)
    await page.locator('[data-variante="photo"] img').first().waitFor({ timeout: 20_000 })

    const v = await page.evaluate(() => {
      const out: { variante: string; taille: number; boite: [number, number]; image: [number, number] | null; objectFit: string | null }[] = []
      for (const bloc of [...document.querySelectorAll('[data-variante]')]) {
        for (const ligne of [...bloc.querySelectorAll('[data-taille]')]) {
          // La vignette est le PREMIER enfant de la ligne — repérée par sa position,
          // jamais par une classe ni un style : les deux se changent légitimement.
          const boite = ligne.firstElementChild as HTMLElement
          const r = boite.getBoundingClientRect()
          const img = boite.querySelector('img')
          const ri = img?.getBoundingClientRect()
          out.push({
            variante: bloc.getAttribute('data-variante')!,
            taille: Number(ligne.getAttribute('data-taille')),
            boite: [Math.round(r.width), Math.round(r.height)],
            image: ri ? [Math.round(ri.width), Math.round(ri.height)] : null,
            objectFit: img ? getComputedStyle(img).objectFit : null,
          })
        }
      }
      return out
    })

    // ⚠️ COUVERTURE : 2 variantes × 7 tailles. Sans ce compte, un sélecteur cassé
    // rendrait une liste vide et TOUTES les assertions suivantes seraient vertes.
    expect(v.length, 'aucune vignette lue — le harnais ou le sélecteur a changé').toBe(14)
    expect(v.filter(x => x.variante === 'photo' && x.image).length, 'aucune image rendue').toBe(7)

    // (1) CARRÉE — le défaut exact : la largeur suivait le conteneur, la hauteur non.
    const bancales = v.filter(x => Math.abs(x.boite[0] - x.boite[1]) > 1 || x.boite[0] !== x.taille)
    expect(bancales, [
      `Vignettes non carrées : ${JSON.stringify(bancales.slice(0, 3))}`,
      'La boîte doit faire exactement `size` × `size`. Le 2026-08-12 la largeur suivait',
      'la carte pendant que la hauteur restait à 38 px : `objectFit:cover` rognait alors',
      'la photo en un bandeau de quelques pixels.',
    ].join('\n')).toEqual([])

    // (2) L'IMAGE REMPLIT SA BOÎTE — `inset:0` + 100 % ; sinon la photo est posée à sa
    //     taille naturelle et déborde ou laisse un vide.
    const malRemplies = v.filter(x => x.image && (x.image[0] !== x.boite[0] || x.image[1] !== x.boite[1]))
    expect(malRemplies, `l’image ne couvre pas sa boîte : ${JSON.stringify(malRemplies.slice(0, 3))}`).toEqual([])

    // (3) ⚠️ `object-fit: cover` — lu en style CALCULÉ, donc ce que le moteur applique
    //     vraiment, pas ce que la source écrit. LIMITE ASSUMÉE : cela prouve la règle,
    //     pas les pixels. Une preuve pixel exigerait de décoder une capture ; l'image à
    //     trois bandes est là pour ça le jour où on la voudra. Sans `cover`, une photo
    //     3:1 dans une boîte carrée est ÉCRASÉE — invisible à toute mesure de rectangle.
    const mauvaisFit = v.filter(x => x.objectFit !== null && x.objectFit !== 'cover')
    expect(mauvaisFit, `object-fit doit rester « cover » : ${JSON.stringify(mauvaisFit.slice(0, 3))}`).toEqual([])

    // (4) La variante ÉMOJI est carrée elle aussi — c'est elle qui masquait le défaut.
    expect(v.filter(x => x.variante === 'emoji' && x.image).length, 'une variante sans photo ne doit rendre aucun <img>').toBe(0)
  })

  test('la géométrie du Stock, mesurée et rendue', async ({ page }) => {
    const mesures: string[] = []
    for (const extremes of [false, true]) {
      for (const { w, h } of LARGEURS) {
        await ouvrirStock(page, w, h, extremes)
        const m = await page.locator('.table-wrap.stock-table').first()
          .evaluate(el => ({ s: el.scrollWidth, c: el.clientWidth }))
        const doc = await page.evaluate(() => document.documentElement.scrollWidth)
        mesures.push(`  ${extremes ? 'extrêmes ' : 'réalistes'} ${String(w).padStart(4)} px → table ${m.s}/${m.c} px (${m.s > m.c ? 'défile' : 'tient'}) · page ${doc} px`)
      }
    }
    // Le détail par COLONNE : quand le budget de largeur naturelle rougit, c'est la
    // seule information qui dit OÙ les pixels sont partis. Sans lui on ajusterait au jugé.
    await ouvrirStock(page, 390, 844)
    const cols = await page.evaluate(() => [...document.querySelectorAll('.table-wrap.stock-table thead th')]
      .map(th => `${(th.textContent || '(case)').trim()} ${Math.round(th.getBoundingClientRect().width)}`))
    const large = await page.evaluate(() => {
      const w = document.documentElement.clientWidth
      return [...document.querySelectorAll('body *')]
        .filter(el => el.getBoundingClientRect().width > w + 1)
        .slice(0, 6)
        .map(el => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${Math.round(el.getBoundingClientRect().width)}`)
    })
    // eslint-disable-next-line no-console
    console.log('\n── GÉOMÉTRIE STOCK MESURÉE ──\n' + mesures.join('\n')
      + '\n  colonnes (390 px, réalistes) : ' + cols.join(' · ')
      + '\n  plus larges que la page      : ' + (large.join(' · ') || 'aucun') + '\n')
  })
})
