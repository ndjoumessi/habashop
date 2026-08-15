import { test, expect } from '@playwright/test'
import { seedEcran, ouvrirEcran } from './ecrans'

/**
 * DENSITÉ ET REDONDANCE — console Ops, Rapports, RH, Planning, sur un VRAI moteur de rendu.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────────────────
 * `CLAUDE.md` portait une dette « Densité » dont les défauts avaient été mesurés SUR DES
 * CAPTURES envoyées par Nelson : la leçon écrivait noir sur blanc que « Nelson EST la session
 * authentifiée », donc que ces écrans ne pouvaient être vus autrement. **C'est devenu faux** —
 * `seedEcran` amorce la session dans `localStorage` et `ouvrirEcran` navigue partout. Ces
 * écrans se mesurent désormais tout seuls, à chaque exécution.
 *
 * ⚠️ CE QUE CE FICHIER N'ASSERT PAS, ET POURQUOI. Pas de seuil en pixels : la géométrie
 * diffère de ~9 px entre Ubuntu et macOS (rendu de police), et un seuil exact serait vert sur
 * une machine et rouge sur l'autre. On assert le DÉBORDEMENT, l'ENROULEMENT et la REDONDANCE
 * — trois propriétés binaires, portables.
 */
const ECRANS = [
  { nom: 'console Ops', chemin: '/__dev/table', temoin: /Console plateforme/ },
  { nom: 'rapports',    chemin: '/app/reports', temoin: /Rapports/ },
  { nom: 'RH',          chemin: '/app/hr',      temoin: /Ressources Humaines/ },
  { nom: 'planning',    chemin: '/app/planning', temoin: /Planning/ },
]

for (const e of ECRANS) {
  for (const w of [2560, 1440, 390]) {
    test(`${e.nom} @${w} — la page ne déborde pas, aucun montant ne s’enroule`, async ({ page }) => {
      await seedEcran(page)
      await ouvrirEcran(page, e.chemin, w, 1000)
      await page.waitForTimeout(2000)

      // ⚠️ TÉMOIN POSITIF D'ABORD. Une page vide ne déborde pas et n'enroule rien : elle
      // passerait les deux assertions suivantes en ne mesurant RIEN. Le piège est tombé
      // deux fois dans ce dépôt le 2026-08-15 — une fois sur une redirection vers /login,
      // une fois sur trois cas qui rendaient tous le même repli générique.
      await expect(page.locator('body'), `${e.nom} n’a pas rendu`).toContainText(e.temoin)

      const m = await page.evaluate(() => {
        const doc = document.documentElement
        // (1) La PAGE ne défile jamais horizontalement — c'est l'écran cassé.
        const scroll = { w: doc.scrollWidth, client: doc.clientWidth }
        // (2) Enroulement des MONTANTS : un rectangle par ligne rendue (le bon détecteur,
        //     après deux détecteurs qui criaient au loup — cf. docs/lessons/densite-mesuree.md).
        //     Scopé aux cellules NUMÉRIQUES : un nom de client qui passe à la ligne à 390 px
        //     est légitime, un montant coupé en deux ne l'est pas.
        const enroules: string[] = []
        for (const td of [...document.querySelectorAll('.td-num, .kpi-value')]) {
          for (const el of [...td.querySelectorAll('*'), td]) {
            if (el.children.length || !(el.textContent ?? '').trim()) continue
            const r = document.createRange(); r.selectNodeContents(el)
            if (r.getClientRects().length > 1) enroules.push((el.textContent ?? '').trim().slice(0, 30))
          }
        }
        return { scroll, enroules: [...new Set(enroules)] }
      })

      expect(m.scroll.w, `la PAGE déborde (${m.scroll.w} > ${m.scroll.client})`)
        .toBeLessThanOrEqual(m.scroll.client + 1)
      expect(m.enroules, `montants enroulés : ${JSON.stringify(m.enroules)}`).toEqual([])
    })
  }
}

test('planning — l’astuce de clic n’est écrite QU’UNE fois', async ({ page }) => {
  /**
   * ⚠️ LE DÉFAUT, ET LA LEÇON DE MÉTHODE QUI VA AVEC.
   *
   * Le pied de `PlanningGrid` rendait `T.clearTip` — déjà rendu par `PlanningFilters`. Une
   * correction ANTÉRIEURE avait retiré la légende des six postes en gardant cette astuce, au
   * motif ÉCRIT dans le code qu'elle était « le seul élément que la barre du haut ne porte
   * pas ». Mesuré : `PlanningFilters.tsx:45` rend `{T.assignTip} · {T.clearTip}` — les deux.
   *
   * *Le raisonnement était juste, sa prémisse ne l'était pas, et rien ne l'avait vérifiée.*
   * D'où ce cas : il ne garde pas une absence de code, il garde une propriété de L'ÉCRAN.
   */
  await seedEcran(page)
  await ouvrirEcran(page, '/app/planning', 1440, 1000)
  await page.waitForTimeout(2000)
  await expect(page.locator('body')).toContainText(/Planning/)

  const n = await page.evaluate(() => {
    const t = document.body.innerText
    return (t.match(/Suppr pour effacer/g) || []).length
  })
  expect(n, `l’astuce « Suppr pour effacer » est rendue ${n} fois — elle doit l’être UNE fois`).toBe(1)
})

test('RH — un employé sans département le DIT, il ne laisse pas un libellé orphelin', async ({ page }) => {
  /**
   * ⚠️ DEUX DÉFAUTS, UNE SEULE CAUSE : `emp.dept` peut être absent.
   *   1. le libellé « Dept » se rendait au-dessus du VIDE ;
   *   2. le repli de couleur `'var(--p)'` était CONCATÉNÉ avec une alpha (`${deptColor}0D`)
   *      → `var(--p)0D`, couleur invalide → **fond et bordure de la boîte disparaissaient**.
   * Le second est invisible pour `tsc`, pour la suite et pour la revue ; il se voit à l'écran,
   * et il est désormais gardé par le second axe de `noVarInConcatenatedColor.test.ts`.
   */
  await seedEcran(page)
  await ouvrirEcran(page, '/app/hr', 1440, 1000)
  await page.waitForTimeout(2000)
  await expect(page.locator('body')).toContainText(/Ressources Humaines/)

  const r = await page.evaluate(() => {
    const boites = [...document.querySelectorAll('div')]
      .filter(d => (d.textContent ?? '').trim() === 'Dept' && d.children.length === 0)
    return boites.map(l => {
      const valeur = l.nextElementSibling as HTMLElement | null
      const cadre = l.parentElement as HTMLElement
      const st = cadre ? getComputedStyle(cadre) : null
      return {
        texte: (valeur?.textContent ?? '').trim(),
        // ⚠️ La bordure est la preuve que la couleur concaténée est VALIDE : `var(--p)0D`
        // la faisait retomber à `none`. On lit le style CALCULÉ, pas la source.
        bordure: st?.borderTopStyle ?? 'inconnu',
      }
    })
  })
  expect(r.length, 'aucune boîte « Dept » rendue — le témoin ne vaut rien').toBeGreaterThan(0)
  expect(r.filter(x => !x.texte), 'des libellés « Dept » sans valeur').toEqual([])
  expect(r.filter(x => x.bordure === 'none'), 'boîte « Dept » sans bordure → couleur concaténée INVALIDE').toEqual([])
})
