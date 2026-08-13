import { test, expect } from '@playwright/test'
import { seedEcran, ouvrirEcran } from './ecrans'

/**
 * MESURE — LE CONTRAT GÉOMÉTRIQUE, SUR TOUS LES ÉCRANS DE L'APPLICATION.
 *
 * `ecrans-density.spec.ts` mesure Stock et POS en PROFONDEUR, parce que c'est là que
 * les défauts ont été trouvés (largeur naturelle, atteignabilité des actions,
 * troncature des noms). Ici on va en LARGEUR : les 20 autres écrans, avec le contrat
 * minimal qu'aucun d'eux ne doit violer.
 *
 * ─── CE QUE « COUVRIR » VEUT DIRE ICI, ET CE QUE ÇA NE VEUT PAS DIRE ─────────
 * ⚠️ Un écran qui rend son état VIDE serait « complet » et ne mesurerait RIEN — le
 * faux vert le plus facile à obtenir sur ce terrain. Chaque écran doit donc franchir
 * un seuil de CONTENU (`seuil`), vérifié par écran et non en somme : un écran muet
 * serait sinon compensé par les autres. C'est la leçon déjà payée sur les surfaces.
 *
 * ⚠️ Et ce contrat reste MINIMAL : il dit qu'aucun écran ne casse la page ni n'enroule
 * un montant. Il ne dit rien de la qualité de leur mise en page — un écran peut le
 * satisfaire en étant laid ou vide de sens. On ne prétend pas mesurer le dessin.
 *
 * ⚠️ La liste des écrans est DÉRIVÉE d'`App.tsx` par `densityJobScope.test.ts`, qui
 * rougit si un écran ouvert ici cesse d'être couvert par le filtre du workflow. Celle
 * ci-dessous est écrite à la main et c'est le point faible ASSUMÉ : un écran AJOUTÉ à
 * l'application n'y entrera pas tout seul. Le compte ci-dessous en est la parade
 * partielle — il échoue si l'application gagne des routes sans qu'on les mesure.
 */

/** Écrans mesurés en LARGEUR. Stock et POS sont traités à part, en profondeur. */
const ECRANS: { slug: string; seuil: number }[] = [
  { slug: 'dashboard', seuil: 40 }, { slug: 'orders', seuil: 30 },
  { slug: 'suppliers', seuil: 25 }, { slug: 'customers', seuil: 30 },
  { slug: 'subscriptions', seuil: 15 }, { slug: 'reports', seuil: 30 },
  { slug: 'hr', seuil: 30 }, { slug: 'planning', seuil: 25 },
  { slug: 'payroll', seuil: 20 }, { slug: 'expenses', seuil: 30 },
  { slug: 'forecasts', seuil: 20 }, { slug: 'users', seuil: 20 },
  { slug: 'activity', seuil: 20 }, { slug: 'notifications', seuil: 15 },
  { slug: 'settings', seuil: 30 }, { slug: 'marketing', seuil: 15 },
  { slug: 'ai', seuil: 10 }, { slug: 'goals', seuil: 15 },
  { slug: 'api-docs', seuil: 20 }, { slug: 'integrations', seuil: 20 },
]

test.describe('tous les écrans — contrat géométrique', () => {
  for (const { slug, seuil } of ECRANS) {
    test(`/app/${slug} : page contenue, montants entiers, vignettes carrées`, async ({ page }) => {
      await seedEcran(page)
      await ouvrirEcran(page, `/app/${slug}`, 1280, 900)
      await page.locator('.page-content').first().waitFor({ timeout: 30_000 })
      // Les écrans chargent en deux temps (squelette, puis données).
      await page.waitForTimeout(1200)

      const m = await page.evaluate(() => {
        const elements = document.querySelectorAll('.page-content *').length
        const wraps = [...document.querySelectorAll('.table-wrap')].map(w => ({
          scroll: w.scrollWidth, client: w.clientWidth, overflowX: getComputedStyle(w).overflowX,
        }))
        // Montants enroulés : mêmes unités de lecture que les autres specs — les
        // FEUILLES, jamais le `<td>` entier (une cellule peut en porter deux).
        const enroules: string[] = []
        for (const td of [...document.querySelectorAll('td.td-num')]) {
          const unites: Node[] = [...td.childNodes].filter(nd => nd.nodeType === Node.TEXT_NODE && (nd.textContent ?? '').trim())
          for (const el of [...td.querySelectorAll('*')]) if (el.children.length === 0 && (el.textContent ?? '').trim()) unites.push(el)
          for (const u of unites) {
            const r = document.createRange(); r.selectNodeContents(u)
            if (r.getClientRects().length > 1) enroules.push((u.textContent ?? '').trim())
          }
        }
        const vignettes = [...document.querySelectorAll('[data-thumb]')].map(t => {
          const r = t.getBoundingClientRect()
          return { w: Math.round(r.width), h: Math.round(r.height) }
        })
        return {
          url: location.pathname, elements, wraps, enroules, vignettes,
          pageScroll: document.documentElement.scrollWidth,
          pageClient: document.documentElement.clientWidth,
        }
      })

      // (0) ⚠️ ON EST BIEN SUR L'ÉCRAN — une redirection silencieuse (garde de rôle,
      //     session perdue) rendrait un AUTRE écran, mesurable et hors sujet.
      expect(m.url, `redirigé vers ${m.url} au lieu de /app/${slug}`).toBe(`/app/${slug}`)

      // (1) ⚠️ COUVERTURE — l'écran a RENDU quelque chose. Seuil par écran, jamais en
      //     somme : un écran muet serait sinon masqué par les autres.
      expect(m.elements, `/app/${slug} n’a rendu que ${m.elements} éléments — écran vide ou en erreur ?`)
        .toBeGreaterThanOrEqual(seuil)

      // (2) La PAGE ne défile jamais horizontalement — c'est l'écran cassé.
      expect(m.pageScroll, `la PAGE défile (${m.pageScroll} > ${m.pageClient})`)
        .toBeLessThanOrEqual(m.pageClient + 1)

      // (3) Toute table qui déborde doit pouvoir défiler, sinon sa fin est perdue.
      const muettes = m.wraps.filter(w => w.scroll > w.client + 1 && !['auto', 'scroll'].includes(w.overflowX))
      expect(muettes, `des tables débordent SANS défilement : ${JSON.stringify(muettes)}`).toEqual([])

      // (4) Aucun montant coupé en deux lignes.
      expect(m.enroules, `montants enroulés : ${JSON.stringify(m.enroules.slice(0, 4))}`).toEqual([])

      // (5) Aucune vignette déformée.
      const deformees = m.vignettes.filter(v => Math.abs(v.w - v.h) > 1)
      expect(deformees, `vignettes déformées : ${JSON.stringify(deformees.slice(0, 3))}`).toEqual([])
    })
  }

  /**
   * ⚠️ LA LISTE CI-DESSUS EST ÉCRITE À LA MAIN — donc fausse dès qu'un écran est
   * ajouté. Ce cas la confronte aux routes RÉELLES d'`App.tsx` : il ne peut pas
   * deviner ce qu'il faut mesurer, mais il refuse de laisser un écran entrer dans
   * l'application sans qu'on ait DÉCIDÉ de le mesurer ou non.
   */
  test('aucun écran de l’application n’échappe à la mesure sans être NOMMÉ', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const app = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8')
    const routes = [...app.matchAll(/<Route\s+path="([a-z-]+)"/g)].map(x => x[1])
    expect(routes.length, 'aucune route lue — le scan ne garde rien').toBeGreaterThanOrEqual(15)

    // Traités ailleurs, en PROFONDEUR, ou hors périmètre — chacun avec sa raison.
    const AILLEURS: Record<string, string> = {
      stock: 'mesuré en profondeur — ecrans-density.spec.ts',
      pos: 'mesuré en profondeur — ecrans-density.spec.ts',
      upgrade: 'tunnel de paiement : aucune géométrie dense, et un appel prestataire',
    }
    const mesures = new Set([...ECRANS.map(e => e.slug), ...Object.keys(AILLEURS)])
    const oublies = routes.filter(r => !mesures.has(r))
    expect(oublies, [
      `Ces écrans existent et ne sont NI mesurés NI exemptés : ${oublies.join(', ')}`,
      'Les ajouter à ECRANS, ou les nommer dans AILLEURS avec la raison.',
    ].join('\n')).toEqual([])
  })
})
