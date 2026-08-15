import { test, expect } from '@playwright/test'

/**
 * MESURE — aucun contrôle des PAGES PUBLIQUES sous 40×40 px de zone de frappe.
 *
 * ─── POURQUOI UN E2E ET PAS UN VERROU UNITAIRE ───────────────────────────────
 * `touchTargets.test.ts` dérive son périmètre des classes `*btn*` de la feuille PLUS
 * celles posées sur un `<button>` **qui déclarent une `min-height`**. Les classes `lp-*`
 * de la landing n'en déclaraient aucune : elles n'entraient donc pas dans le périmètre,
 * et le verrou était VERT pendant que `lp-nav-login` faisait 35 px en production.
 * C'est le quatrième angle mort de PÉRIMÈTRE de l'audit du 2026-08 — et le seul outil qui
 * l'a trouvé est celui-ci : lire le DOM RENDU au lieu de la source.
 *
 * ⚠️ MESURÉ EN PROD LE 2026-08-15, avant correction : `/` portait 8 contrôles sous le
 * seuil (nav 35 px, puces de langue 39, bascule tarifaire 33) et `/signup` 2 (sélecteur
 * d'indicatif 38, lien de bas de page 16). `/login` en portait 0 — il avait été traité au
 * lot 1, les pages marketing pas.
 *
 * ─── CE QUE « ZONE DE FRAPPE » VEUT DIRE ─────────────────────────────────────
 * Ce que iOS HIG et WCAG 2.5.8 mesurent est la RÉGION QUI ACCEPTE LE POINTEUR, pas le
 * dessin. Un `::before` en absolu, ou un padding annulé par une marge négative, l'élargit
 * sans rien déplacer — c'est le motif de `.login-eye`, de `.switch-hit` et du lien
 * « Se connecter » de `/signup`. La sonde ci-dessous les prend donc en compte.
 *
 * ⚠️ SEUIL 40, PAS 44. `--touch-sm` (40) est une concession de densité assumée pour les
 * contrôles segmentés ; la figer à 44 ici ferait rougir un choix délibéré. Le plancher
 * ABSOLU est 40 — en dessous, plus rien n'est légitime dans ce dépôt.
 */

const PAGES = ['/', '/login', '/signup'] as const
const LARGEURS = [
  { nom: '390 px — téléphone', w: 390, h: 844 },
  { nom: '1280 px — bureau', w: 1280, h: 900 },
] as const

/** Sélecteur d'attente par page — un `waitForLoadState` seul rend une page encore vide. */
const ATTENTE: Record<string, string> = {
  '/': 'h1',
  '/login': '[data-testid="login-submit"]',
  '/signup': 'input',
}

for (const url of PAGES) {
  for (const { nom, w, h } of LARGEURS) {
    test(`${url} @ ${nom} : aucun contrôle sous 40×40`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await page.goto(url)
      await page.locator(ATTENTE[url]).first().waitFor({ timeout: 20_000 })
      // Les transitions sont neutralisées : lire juste après un resize rend des valeurs
      // INTERMÉDIAIRES, et le banc mesurerait sa propre latence.
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' })
      await page.waitForTimeout(400)

      const r = await page.evaluate(() => {
        const zone = (el: Element) => {
          const q = el.getBoundingClientRect()
          let hh = q.height, ww = q.width
          for (const pseudo of ['::before', '::after']) {
            const cs = getComputedStyle(el, pseudo)
            if (cs.content === 'none' || cs.position !== 'absolute') continue
            const i = ['top', 'right', 'bottom', 'left'].map(k => parseFloat(cs[k as never]) || 0)
            hh = Math.max(hh, q.height - i[0] - i[2])
            ww = Math.max(ww, q.width - i[1] - i[3])
          }
          // padding annulé par une marge négative : la zone dépasse le dessin
          const cs = getComputedStyle(el)
          const mv = (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0)
          const mh = (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0)
          if (mv < 0) hh = q.height
          if (mh < 0) ww = q.width
          return { w: Math.round(ww), h: Math.round(hh) }
        }
        const sous: string[] = []
        let vus = 0
        for (const el of document.querySelectorAll('button, a[href], [role="switch"], [role="button"]')) {
          const q = el.getBoundingClientRect()
          if (!q.width || !q.height) continue          // masqué : pas une cible
          if (getComputedStyle(el).visibility === 'hidden') continue
          vus++
          const c = zone(el)
          if (c.h < 40 || c.w < 40) {
            const lbl = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 32)
            sous.push(`${c.w}x${c.h}  [${el.className || 'inline'}]  "${lbl}"`)
          }
        }
        return { vus, sous }
      })

      // COUVERTURE — une page qui ne rendrait aucun contrôle passerait « 0 sous le seuil »
      // en ne vérifiant rien. C'est la vérité vacante, et elle se lit comme un succès.
      console.log(`  ${url} @ ${w}px — ${r.vus} contrôles mesurés, ${r.sous.length} sous le seuil`)
      // COUVERTURE — une page qui ne rendrait aucun contrôle passerait « 0 sous le seuil »
      // en ne vérifiant rien. C'est la vérité vacante, et elle se lit comme un succès.
      expect(r.vus, `aucun contrôle sur ${url} — la page n'a pas rendu`).toBeGreaterThan(2)
      expect(r.sous, `contrôles sous 40×40 sur ${url} @ ${w}px`).toEqual([])
    })
  }
}
