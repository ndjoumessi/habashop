import { test, expect } from '@playwright/test'

/**
 * MESURE — contraste AA de TOUT le texte des pages légales publiques, dans les DEUX thèmes.
 *
 * ⚠️ MESURÉ EN PROD LE 2026-09-13, avant correction : `/privacy`, `/terms` et
 * `/mentions-legales` écrivaient en `#1a1a2e` et `#666` — encre pour papier blanc — sans
 * poser de fond. Sur le fond sombre de l'app (`#0A0C14`, thème par défaut), le corps du
 * texte tombait à ~1,1:1 : titres, articles, SIREN, adresse de l'hébergeur, illisibles.
 * Seuls le titre violet et l'encart ambre (qui porte son propre fond) se lisaient.
 *
 * ─── POURQUOI UN E2E ─────────────────────────────────────────────────────────
 * Le défaut n'existe que dans la COMPOSITION : une couleur de texte juste pour un fond que
 * la page ne pose pas. jsdom ne calcule ni la cascade d'`index.css` ni le fond hérité du
 * `body` ; la source lue seule avait l'air correcte.
 *
 * ─── CE QUE LA SONDE MESURE ──────────────────────────────────────────────────
 * Chaque élément qui porte un nœud texte non vide, contre son fond EFFECTIF : les fonds des
 * ancêtres composés par leur alpha jusqu'au premier opaque (le `body`). Assertion de
 * COUVERTURE : une sonde qui ne lit rien serait verte pour toujours.
 */

const PAGES = [
  { url: '/privacy', titre: 'Politique de confidentialité' },
  { url: '/terms', titre: "Conditions générales d'utilisation et de vente" },
  { url: '/mentions-legales', titre: 'Mentions légales' },
] as const
const THEMES = ['dark', 'light'] as const

for (const { url, titre } of PAGES) {
  for (const theme of THEMES) {
    test(`${url} · thème ${theme} : tout le texte ≥ 4,5:1`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem('habashop-config', JSON.stringify({ state: { theme: t, lang: 'fr' }, version: 0 }))
      }, theme)
      await page.goto(url)
      await page.getByRole('heading', { level: 1, name: titre }).waitFor({ timeout: 20_000 })

      const r = await page.evaluate(() => {
        const rgba = (c: string) => {
          const v = (c.match(/[\d.]+/g) ?? []).map(Number)
          return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 1]
        }
        const lum = ([r, g, b]: number[]) => {
          const f = (x: number) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        /** Fond effectif : on remonte en empilant les couches, puis on compose du bas vers le haut. */
        const fond = (el: Element) => {
          const couches: number[][] = []
          for (let e: Element | null = el; e; e = e.parentElement) {
            const c = rgba(getComputedStyle(e).backgroundColor)
            if (c[3] > 0) couches.push(c)
            if (c[3] >= 1) break
          }
          let base = [255, 255, 255] // repli du navigateur si rien n'est opaque
          for (const [r, g, b, a] of couches.reverse()) base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)]
          return base
        }
        const racine = document.querySelector('.legal-doc') ?? document.querySelector('#root')!
        const mesures: { texte: string; ratio: number }[] = []
        for (const el of racine.querySelectorAll('*')) {
          const aTexte = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim())
          if (!aTexte || (el as HTMLElement).offsetParent === null) continue
          const st = getComputedStyle(el)
          const [r, g, b, a] = rgba(st.color)
          const bg = fond(el)
          const txt = [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)]
          const [hi, lo] = [lum(txt), lum(bg)].sort((x, y) => y - x)
          mesures.push({ texte: el.textContent!.trim().slice(0, 50), ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100 })
        }
        return { theme: document.body.className, mesures }
      })

      // Le thème demandé est bien celui qui est rendu — sinon on mesurerait deux fois le même.
      expect(r.theme).toBe(`theme-${theme}`)
      expect(r.mesures.length, 'couverture : aucun texte mesuré').toBeGreaterThan(20)
      const echecs = r.mesures.filter(m => m.ratio < 4.5)
      expect(echecs, `textes sous 4,5:1 :\n${echecs.map(e => `  ${e.ratio}:1  « ${e.texte} »`).join('\n')}`).toEqual([])
    })
  }
}
