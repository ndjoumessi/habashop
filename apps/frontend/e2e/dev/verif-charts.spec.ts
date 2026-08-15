import { test, expect } from '@playwright/test'
import { seedEcran, ouvrirEcran } from './ecrans'

/**
 * LES GRAPHIQUES SONT RÉELLEMENT DESSINÉS — visx, après la sortie de recharts.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. jsdom ne fait AUCUNE mise en page : la suite unitaire
 * monte les composants et reste verte même si aucun `<path>` n'est produit. Une migration
 * de bibliothèque de graphiques est exactement le cas où « ça compile et les tests passent »
 * ne prouve rien.
 *
 * ⚠️ ET LE PREMIER TIR DE CE FICHIER ÉTAIT VACANT : le Dashboard rendait son ÉTAT VIDE
 * (aucune vente dans le harnais), donc « 0 anneau, 0 aire » — et le test passait. Un harnais
 * qui ne fournit pas la donnée ne teste pas l'absence de défaut, il teste l'absence d'écran.
 * D'où les seuils STRICTEMENT POSITIFS ci-dessous : ils échouent sur un écran vide.
 */
const ATTENDU = [
  { nom: 'dashboard', chemin: '/app/dashboard', anneaux: 1, secteurs: 4, aires: 1 },
  { nom: 'reports',   chemin: '/app/reports',   anneaux: 1, secteurs: 1, aires: 1 },
] as const

for (const c of ATTENDU) {
  test(`graphiques ${c.nom} — dessinés, sans erreur JS`, async ({ page }) => {
    const err: string[] = []
    page.on('pageerror', e => err.push(String(e)))
    await seedEcran(page)
    await ouvrirEcran(page, c.chemin, 1440, 1000)
    await page.waitForTimeout(3000)

    const m = await page.evaluate(() => {
      const q = (s: string) => document.querySelectorAll(s).length
      const chemins = [...document.querySelectorAll('[data-testid="donut-sector"]')]
        .map(p => p.getAttribute('d') ?? '')
      return {
        anneaux: q('[data-testid="chart-donut"]'), secteurs: chemins.length,
        aires: q('[data-testid="chart-area"]'),
        tickX: q('[data-testid="axe-x-tick"]'), tickY: q('[data-testid="axe-y-tick"]'),
        // Un `<path>` sans `d`, ou avec un `d` de deux caractères, c'est un secteur qui
        // n'a pas été calculé — visible uniquement ici.
        cheminsVides: chemins.filter(d => d.trim().length < 10).length,
        // Une aire sans tracé : la courbe n'a pas été générée.
        traces: q('[data-testid="chart-area"] path'),
      }
    })

    expect(err, `erreurs JS sur ${c.nom}`).toEqual([])
    expect(m.anneaux, 'anneau non monté').toBe(c.anneaux)
    expect(m.secteurs, 'secteurs du donut non dessinés').toBe(c.secteurs)
    expect(m.cheminsVides, 'un secteur a un `d` vide — arc non calculé').toBe(0)
    expect(m.aires, 'aire non montée').toBe(c.aires)
    expect(m.traces, 'aucun tracé dans l’aire — la courbe n’est pas dessinée').toBeGreaterThan(0)
    expect(m.tickX, 'axe X sans graduation').toBeGreaterThan(0)
    expect(m.tickY, 'axe Y sans graduation').toBeGreaterThan(0)
  })
}
