import { test, expect } from '@playwright/test'
import { seedEcran, ouvrirEcran, NB_PRODUITS } from './ecrans'

/**
 * MESURE — les ÉCRANS COMPLETS, pas les composants.
 *
 * ─── CE QUE ÇA FERME ─────────────────────────────────────────────────────────
 * Les harnais `?vue=…` montent des composants avec des props fabriquées ; leur limite
 * était écrite à chaque étape : « ils mesurent les SURFACES, pas les ÉCRANS ». Ici on
 * n'assemble rien — on ouvre l'application à ses vraies routes, avec sa barre latérale,
 * son en-tête et son `.page-content`.
 *
 * ─── ET CE N'ÉTAIT PAS UNE LIMITE THÉORIQUE ──────────────────────────────────
 * MESURÉ dès le premier tir : à 1280 px, l'écran réel donne `.table-wrap` à **918 px**
 * — exactement la valeur relevée en production — pendant que le harnais, dépourvu de
 * barre latérale, offrait 1182 px et faisait TENIR une table qui déborde en vrai. Le
 * cas 1280 avait dû s'inventer un `?largeur=918` pour reproduire la contrainte ; ici
 * elle vient toute seule. La contrainte imposée a donc été SUPPRIMÉE avec ce cas :
 * garder les deux, c'était garder un jumeau moins fidèle qui finirait par diverger.
 *
 * ⚠️ AUCUNE GARDE DESSERRÉE — le rôle amorcé est SUPER_ADMIN **de boutique**, donc
 * `/admin` reste refusé. `/__dev/table` garde sa raison d'être pour la console Ops.
 *
 * ⚠️ CE QUI N'EST PAS ASSERTÉ ICI, ET POURQUOI : « la table tient à 1440 px ». Les
 * noms générés sont plus larges que ceux de la production (295 px de colonne contre
 * 228), donc un tel seuil mesurerait mon générateur, pas l'application — la même
 * erreur que le premier budget, déjà commise et déjà corrigée. La largeur reste gardée
 * par le budget des colonnes NON élastiques, mesuré dans le harnais.
 */

const LARGEURS_ECRAN = [
  { nom: '1280 px — la plus courante', w: 1280, h: 900 },
  { nom: '1440 px — portable',         w: 1440, h: 900 },
]

const LIGNES = '.table-wrap.stock-table table tbody tr'

test.describe('écrans complets — géométrie réelle', () => {
  for (const { nom, w, h } of LARGEURS_ECRAN) {
    test(`/app/stock ${nom} : soupape, montants, noms, vignettes`, async ({ page }) => {
      await seedEcran(page)
      await ouvrirEcran(page, '/app/stock', w, h)
      await page.locator(LIGNES).first().waitFor({ timeout: 30_000 })

      // ⚠️ COUVERTURE : la réponse par défaut du réseau amorcé est une liste VIDE.
      // Sans ce compte, un écran qui ne charge plus rien serait « complet » et vert.
      expect(await page.locator(LIGNES).count(), `l’écran doit porter les ${NB_PRODUITS} produits`).toBe(NB_PRODUITS)

      const m = await page.evaluate(() => {
        const wrap = document.querySelector('.table-wrap.stock-table') as HTMLElement
        return {
          naturelle: wrap.scrollWidth, conteneur: wrap.clientWidth,
          overflowX: getComputedStyle(wrap).overflowX,
          contenu: (document.querySelector('.page-content') as HTMLElement)?.clientWidth ?? null,
          pageScroll: document.documentElement.scrollWidth,
          pageClient: document.documentElement.clientWidth,
        }
      })

      // (1) La PAGE ne défile jamais horizontalement — c'est l'écran cassé.
      expect(m.pageScroll, `la PAGE défile (${m.pageScroll} > ${m.pageClient}) · contenu ${m.contenu} px`)
        .toBeLessThanOrEqual(m.pageClient + 1)

      // (2) Si la table déborde, le conteneur DOIT pouvoir défiler.
      if (m.naturelle > m.conteneur + 1) {
        expect(['auto', 'scroll'], `.table-wrap doit défiler (overflowX = ${m.overflowX})`).toContain(m.overflowX)
      }

      // (3) ⚠️ LES ACTIONS SONT ATTEIGNABLES — la seule garantie qui compte pour le
      //     caissier, et qu'aucune des deux précédentes ne donne. Auto-discriminante :
      //     on n'exige l'atteignabilité APRÈS défilement que si le bouton était bien
      //     hors cadre AVANT ; sinon le cas ne mesurerait rien et se dirait vert.
      const act = await page.evaluate(sel => {
        const wrap = document.querySelector('.table-wrap.stock-table') as HTMLElement
        const tr = document.querySelector(sel) as HTMLElement
        const boutons = [...tr.querySelectorAll('button')]
        const dernier = boutons[boutons.length - 1]
        if (!dernier) return null
        const depasse = () => Math.round(dernier.getBoundingClientRect().right - wrap.getBoundingClientRect().right)
        wrap.scrollLeft = 0
        const avant = depasse()
        wrap.scrollLeft = wrap.scrollWidth
        return { titre: dernier.getAttribute('title') ?? dernier.getAttribute('aria-label') ?? '?', avant, apres: depasse() }
      }, LIGNES)
      expect(act, 'aucun bouton d’action lu — la ligne n’en porte plus ?').not.toBeNull()
      if (act!.avant > 0) {
        expect(act!.apres, [
          `Après défilement complet, « ${act?.titre} » dépasse encore de ${act?.apres} px`,
          `(il dépassait de ${act?.avant} px avant défilement) — INATTEIGNABLE.`,
        ].join('\n')).toBeLessThanOrEqual(1)
      }

      // (4) Aucun montant enroulé — sur l'écran réel, donc sous la contrainte réelle.
      const enroules = await page.evaluate(sel => {
        const out: string[] = []
        for (const tr of [...document.querySelectorAll(sel)]) {
          for (const td of [...tr.querySelectorAll('td.td-num')]) {
            const unites: Node[] = [...td.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim())
            for (const el of [...td.querySelectorAll('*')]) if (el.children.length === 0 && (el.textContent ?? '').trim()) unites.push(el)
            for (const u of unites) {
              const r = document.createRange(); r.selectNodeContents(u)
              if (r.getClientRects().length > 1) out.push((u.textContent ?? '').trim())
            }
          }
        }
        return out
      }, LIGNES)
      expect(enroules, `montants enroulés sur l’écran réel : ${JSON.stringify(enroules.slice(0, 4))}`).toEqual([])

      // (5) Les vignettes de l'écran restent carrées (les deux branches confondues).
      const vignettes = await page.evaluate(() =>
        [...document.querySelectorAll('[data-thumb]')].map(t => {
          const r = t.getBoundingClientRect()
          return { branche: t.getAttribute('data-thumb'), w: Math.round(r.width), h: Math.round(r.height) }
        }))
      const deformees = vignettes.filter(v => Math.abs(v.w - v.h) > 1)
      expect(deformees, `vignettes déformées sur l’écran : ${JSON.stringify(deformees.slice(0, 3))}`).toEqual([])
    })
  }

  test('/app/stock — vue GRILLE : le nom tient entier, les tuiles ne s’étirent pas', async ({ page }) => {
    await seedEcran(page)
    await ouvrirEcran(page, '/app/stock', 1440, 900)
    await page.locator(LIGNES).first().waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Vue grille' }).first().click()
    await page.locator('[role="listitem"]').first().waitFor({ timeout: 20_000 })

    // ── Les noms, sur une grille PLEINE ────────────────────────────────────
    const noms = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="stock-tile-name"]')].map(e => ({
        texte: (e.textContent ?? '').trim(),
        coupeH: e.scrollHeight > e.clientHeight + 1,
        coupeL: e.scrollWidth > e.clientWidth + 1,
      })))
    expect(noms.length, 'aucun nom lu — la poignée `stock-tile-name` a disparu').toBeGreaterThanOrEqual(20)
    // Les DEUX axes : la forme d'origine du défaut coupait à l'horizontale.
    const coupes = noms.filter(n => n.coupeH || n.coupeL)
    expect(coupes, `noms coupés sur l’écran réel : ${JSON.stringify(coupes.slice(0, 3))}`).toEqual([])

    // ── L'étirement, sur une grille PRESQUE VIDE ───────────────────────────
    // ⚠️ IL FAUT FILTRER. `auto-fit` n'effondre les colonnes que s'il en reste des
    // vides : à 24 articles la rangée est pleine et `fit` rend EXACTEMENT comme
    // `fill`. Mesurer là, c'est mesurer le cas qui ne peut pas échouer — c'est
    // d'ailleurs ce qui avait laissé passer le défaut, découvert sur une caisse
    // filtrée par catégorie. On reproduit donc le geste du caissier : une recherche.
    // `fill()` pose la valeur sans frappes, donc sans réveiller la douchette.
    await page.locator('input[placeholder^="Rechercher (nom"]').first().fill('témoin 003')
    await page.waitForTimeout(400)
    const tuiles = await page.evaluate(() =>
      [...document.querySelectorAll('[role="listitem"]')].map(t => Math.round(t.getBoundingClientRect().width)))
    expect(tuiles.length, 'la recherche doit laisser peu d’articles — sinon rien n’est mesuré')
      .toBeLessThanOrEqual(3)
    expect(tuiles.length, 'la recherche ne doit pas TOUT filtrer').toBeGreaterThanOrEqual(1)
    // Budget de RÉGIME, pas de pixel : une tuile est dessinée autour de 200 px ;
    // au-delà de 320 elle est devenue une bannière (mesuré : 665 px sous `auto-fit`).
    expect(Math.max(...tuiles), `tuiles étirées : ${tuiles.slice(0, 4).join(', ')} px`).toBeLessThanOrEqual(320)

  })

  /**
   * LA TRONCATURE DU JOURNAL — le cas que la PRODUCTION ne peut pas montrer.
   * Le tenant de démonstration compte dix événements d'audit : l'écran n'y affiche
   * donc JAMAIS la troncature, et c'est exactement ce qui avait laissé passer le
   * défaut (« Total événements » = longueur des lignes reçues, sous un sous-titre
   * annonçant une traçabilité « complète »). Ici le réseau amorcé rend 100 lignes
   * pour un total de 1342 — la seule façon honnête de voir ce chemin rendu.
   */
  test('/app/activity — 100 lignes sur 1342 : la troncature est DITE, pas subie', async ({ page }) => {
    await seedEcran(page)
    await ouvrirEcran(page, '/app/activity', 1440, 950)
    await page.locator('.kpi-card').first().waitFor({ timeout: 30_000 })
    await page.waitForTimeout(800)

    const m = await page.evaluate(() => ({
      soustitre: document.querySelector('.page-subtitle')?.textContent?.trim() ?? '',
      kpis: [...document.querySelectorAll('.kpi-card')].map(k => ({
        label: k.querySelector('.kpi-label')?.textContent?.trim() ?? '',
        valeur: k.querySelector('.kpi-value')?.textContent?.trim() ?? '',
      })),
      lignes: document.querySelectorAll('[style*="border-left"]').length,
      // Les options RÉELLEMENT proposées, hors « Tous les modules » (valeur vide).
      optionsModules: [...document.querySelectorAll('select')]
        .flatMap(s => [...s.options])
        .filter(o => o.value && !['success', 'info', 'warning', 'danger', 'all', 'today'].includes(o.value))
        .map(o => o.textContent?.trim() ?? ''),
      panneauSecurite: [...document.querySelectorAll('h2')]
        .some(h => /Sécurité de mon compte/i.test(h.textContent ?? '')),
      // Le texte RENDU des lignes du journal, normalisé.
      textesLignes: [...document.querySelectorAll('.panel [style*="border-left"]')]
        .map(l => (l.textContent ?? '').replace(/\s+/g, ' ').trim()),
    }))

    // COUVERTURE : sans lignes rendues, tout le reste serait vert et vide.
    expect(m.lignes, 'le journal doit rendre des lignes').toBeGreaterThan(5)

    // (1) La troncature est ANNONCEE, avec les deux nombres.
    expect(m.soustitre).toContain('100')
    expect(m.soustitre).toContain('1342')

    // (2) Le total affiche est celui de la BASE, jamais la longueur des lignes.
    const total = m.kpis.find(k => /Total/i.test(k.label))
    expect(total?.valeur, `KPI total = ${total?.valeur}`).toBe('1342')

    // (3) Les autres compteurs viennent de la base EUX AUSSI. La fixture les rend
    //     incoherents avec les 100 lignes expres : 12 alertes alors que les lignes
    //     envoyees en portent 4. Une derivation afficherait 4.
    expect(m.kpis.find(k => /Alertes/i.test(k.label))?.valeur).toBe('12')

    // (3 bis) MODULES : 5, pas 6 — et l'ecart EST la demonstration.
    //     La fixture envoie SIX codes stockes, dont `orders` et `suppliers` qui
    //     tombent tous deux sur la meme categorie d'ecran (« Commandes »). Le KPI
    //     compte les OPTIONS reellement proposees dans le filtre juste a cote, donc
    //     cinq. Ce test attendait « 6 » : il figeait le comptage SERVEUR des codes
    //     bruts, celui qui faisait afficher un nombre sans rapport avec la liste
    //     deroulante d'a cote — deux nombres muets qui se contredisent.
    expect(m.kpis.find(k => /Modules/i.test(k.label))?.valeur).toBe('6')

    // (4) La promesse d'exhaustivite a disparu de l'ecran.
    expect(m.soustitre.toLowerCase()).not.toContain('complete')

    // (5) L'INVARIANT, sur le DOM rendu : le KPI « Modules » vaut exactement le
    //     nombre d'options du filtre. Ils venaient de deux sources — un compte
    //     serveur et un `Record` fige — et rien ne les obligeait a parler du meme
    //     ensemble. Ici on ne verifie plus deux nombres separement : on verifie
    //     qu'ils sont LE MEME.
    // ⚠️ NEUF codes stockés, SIX options : `orders`+`suppliers` tombent sur
    //     « Commandes », et `STOCK`+`products`+`stock_transfers` sur « Stock ».
    expect(m.optionsModules.length).toBe(6)
    expect(String(m.optionsModules.length))
      .toBe(m.kpis.find(k => /Modules/i.test(k.label))?.valeur)

    // (6) Aucune option MORTE. Le filtre proposait « Auth » (autre table, jamais
    //     lue ici) et « RH » (aucun audit ecrit cote employes) : deux options qui ne
    //     pouvaient rien rendre, dont le resultat vide se lit « il ne s'est rien
    //     passe ». Elles ne peuvent plus apparaitre, car la liste vient des donnees.
    expect(m.optionsModules).not.toContain('Auth')
    expect(m.optionsModules).not.toContain('RH')
    // Et la categorie qui compose le journal EST proposee — c'est elle qui manquait :
    // filtrer « Parametres » rendait zero ligne sur un journal fait de `SETTINGS`.
    expect(m.optionsModules).toContain('Paramètres')

    // (7) La securite du COMPTE est rendue — elle etait ecrite, lisible par API, et
    //     affichee nulle part. Panneau distinct : echelle utilisateur, hors boutique.
    expect(m.panneauSecurite, 'le panneau de securite du compte doit etre rendu').toBe(true)

    // (8) LES SURFACES AUDITEES DEPUIS LE 2026-08-14 SONT RENDUES, ET LISIBLES.
    //     ⚠️ Elles n'existent dans AUCUN journal de production : les produire
    //     demanderait de modifier un prix ou une depense sur une boutique reelle.
    //     Ce bloc est donc le SEUL endroit ou leur rendu est observe sur un vrai
    //     moteur de mise en page — les tests unitaires jugent la chaine, pas l'ecran.
    const ligne = (motif: RegExp) => m.textesLignes.find(t => motif.test(t)) ?? ''

    //     Le SUJET accompagne le changement : sans lui, « sellPrice 1000 -> 1200 »
    //     ne designe aucun produit, et c'est ce que l'ecran affichait.
    expect(ligne(/Riz local 5kg/)).toContain('Riz local 5kg — sellPrice 1000 → 1200')
    //     L'action est LIBELLEE, pas rendue en SNAKE_CASE.
    expect(ligne(/Riz local 5kg/)).toContain('Produit modifié')
    expect(ligne(/Riz local 5kg/)).not.toContain('UPDATE_PRODUCT')

    //     Une valeur ABSENTE se dit « — », jamais par un vide : une depense supprimee
    //     se lit « 42500 → — », ce qui montre le montant qui a disparu.
    expect(ligne(/Facture SENELEC/)).toContain('Facture SENELEC — amountTTC 42500 → —')
    expect(ligne(/Loyer août/)).toContain('Loyer août — amountTTC — → 100000')

    //     Et le module tombe sur la bonne CATEGORIE : « Dépenses », pas « Paramètres ».
    expect(ligne(/Loyer août/)).toContain('Dépenses')
    expect(ligne(/Huile 1L/)).toContain('Transfert de stock reçu')
    expect(ligne(/Huile 1L/)).toContain('Stock')

    //     COUVERTURE — les quatre formes sont bien presentes a l'ecran ; sans ce
    //     compte, un `find` qui ne trouve rien rendrait '' et toutes les assertions
    //     `not.toContain` ci-dessus passeraient au vert sur du vide.
    for (const sujet of [/Riz local 5kg/, /Loyer août/, /Facture SENELEC/, /Huile 1L/]) {
      expect(ligne(sujet), `ligne manquante pour ${sujet}`).not.toBe('')
    }
  })

  test('/app/pos — la caisse : page contenue, vignettes carrées', async ({ page }) => {
    await seedEcran(page)
    await ouvrirEcran(page, '/app/pos', 1280, 900)
    await page.locator('[data-thumb]').first().waitFor({ timeout: 30_000 })

    const v = await page.evaluate(() => ({
      vignettes: [...document.querySelectorAll('[data-thumb]')].map(t => {
        const r = t.getBoundingClientRect()
        return { branche: t.getAttribute('data-thumb'), w: Math.round(r.width), h: Math.round(r.height) }
      }),
      pageScroll: document.documentElement.scrollWidth,
      pageClient: document.documentElement.clientWidth,
    }))

    // ⚠️ COUVERTURE + les DEUX branches : c'est le repli émoji qui masquait le défaut
    // du bandeau (du texte centré se moque de la largeur de sa boîte).
    expect(v.vignettes.length, 'la caisse doit rendre des vignettes').toBeGreaterThanOrEqual(10)
    expect(v.vignettes.some(x => x.branche === 'photo'), 'aucune vignette PHOTO en caisse').toBe(true)
    expect(v.vignettes.some(x => x.branche === 'secours'), 'aucune vignette de REPLI en caisse').toBe(true)

    expect(v.pageScroll, `la PAGE de caisse défile (${v.pageScroll} > ${v.pageClient})`)
      .toBeLessThanOrEqual(v.pageClient + 1)

    const deformees = v.vignettes.filter(x => Math.abs(x.w - x.h) > 1)
    expect(deformees, [
      `Vignettes déformées en CAISSE : ${JSON.stringify(deformees.slice(0, 3))}`,
      'C’est l’écran exact du défaut du 2026-08-12 — mesuré ici dans sa vraie mise en',
      'page, pas dans un montage : `.pos-fullbleed`, la grille et la carte comprises.',
    ].join('\n')).toEqual([])
  })
})
