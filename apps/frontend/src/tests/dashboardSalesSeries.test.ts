import { describe, it, expect } from 'vitest'
import { buildSalesSeries, CHART_PERIODS, type SaleForChart } from '@/components/dashboard/dashboardShared'
import type { Lang } from '@/stores/appStore'

/**
 * VERROU — le graphe de ventes est une SÉRIE TEMPORELLE, pas un histogramme par jour de semaine.
 *
 * Le bug fermé : la clé de groupement était `labels[d.getDay()]`, un NOM DE JOUR. Sur « 3 mois »,
 * les ~13 mercredis s'additionnaient en un point unique « Mer », et `Object.values` rendait
 * l'ordre d'apparition — d'où l'axe « Sam · Ven · Mer · Mar · Lun · Dim · Jeu ». Tracé en courbe
 * continue, un pic s'y lisait comme une bonne journée alors qu'il cumulait un trimestre.
 *
 * ⚠️ Les fixtures sont horodatées à **T12:00:00Z** : la clé de groupement est la date UTC
 * (`toISOString`), donc midi met les cas hors d'atteinte des bornes de fuseau et rend le test
 * déterministe quel que soit le TZ de la machine. (Le seam UTC/local résiduel est décrit plus bas.)
 */

const LANGS: Lang[] = ['fr', 'en', 'es', 'it']
const at = (iso: string, total: number): SaleForChart => ({ createdAt: `${iso}T12:00:00Z`, total })

describe('graphe de ventes — série temporelle', () => {
  // ── (a) le bug exact ──────────────────────────────────────────────────────────
  it('deux ventes de MÊME jour de semaine mais de dates différentes → DEUX points', () => {
    // 2026-07-01, 2026-07-08 et 2026-07-15 sont trois MERCREDIS. L'ancienne version les
    // fusionnait en un seul point « Mer » portant la somme des trois.
    const sales = [at('2026-07-01', 100), at('2026-07-08', 200), at('2026-07-15', 300)]

    for (const period of CHART_PERIODS) {
      const points = buildSalesSeries(sales, period, 'fr')
      expect(points, `${period} : les mercredis ont fusionné`).toHaveLength(3)
      expect(points.map(p => p.ventes)).toEqual([100, 200, 300])
      expect(points.map(p => p.transactions)).toEqual([1, 1, 1])
    }
  })

  it('deux ventes du MÊME jour, elles, fusionnent bien en un point cumulé', () => {
    // Contre-épreuve : le correctif ne doit pas avoir désactivé tout regroupement.
    const points = buildSalesSeries([at('2026-07-01', 100), at('2026-07-01', 250)], '3months', 'fr')
    expect(points).toHaveLength(1)
    expect(points[0].ventes).toBe(350)
    expect(points[0].transactions).toBe(2)
  })

  // ── (b) ordre chronologique ───────────────────────────────────────────────────
  it('les points sortent en ordre chronologique croissant, quel que soit l\'ordre d\'entrée', () => {
    // `ventes` encode le RANG chronologique attendu → l'assertion ne dépend d'aucun libellé
    // (donc d'aucune locale) : elle lit l'ordre réel de la série.
    const chronological = ['2026-05-30', '2026-06-02', '2026-06-17', '2026-07-01', '2026-08-04']
    const shuffled = [
      at('2026-07-01', 4), at('2026-05-30', 1), at('2026-08-04', 5),
      at('2026-06-17', 3), at('2026-06-02', 2),
    ]
    expect(shuffled.map(s => String(s.createdAt))).not.toEqual(
      chronological.map(d => `${d}T12:00:00Z`),
    ) // le fixture est bien désordonné — sinon le test ne prouverait rien

    for (const period of CHART_PERIODS) {
      for (const lang of LANGS) {
        const ranks = buildSalesSeries(shuffled, period, lang).map(p => p.ventes)
        expect(ranks, `${period}/${lang} : série non triée`).toEqual([1, 2, 3, 4, 5])
      }
    }
  })

  it('le tri est chronologique, pas alphabétique sur le libellé affiché', () => {
    // Piège : trié sur « 01/09 » vs « 02/08 », l'alphabétique placerait septembre AVANT août.
    const points = buildSalesSeries([at('2026-09-01', 2), at('2026-08-02', 1)], '3months', 'fr')
    expect(points.map(p => p.ventes)).toEqual([1, 2])
  })

  // ── (c) unicité des libellés au-delà de 7 jours ───────────────────────────────
  it('à 30 j / 3 mois, aucun libellé n\'apparaît deux fois', () => {
    // 13 mercredis consécutifs : le cas qui produisait treize fois « Mer ».
    const wednesdays = Array.from({ length: 13 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 4, 6 + i * 7, 12))
      return { createdAt: d.toISOString(), total: 10 + i }
    })

    for (const period of ['30days', '3months'] as const) {
      for (const lang of LANGS) {
        const names = buildSalesSeries(wednesdays, period, lang).map(p => p.name)
        expect(names).toHaveLength(13)
        expect(new Set(names).size, `${period}/${lang} : libellés dupliqués — ${names.join(' · ')}`)
          .toBe(names.length)
      }
    }
  })

  it('la FORME du libellé change avec la période (nom de jour à 7 j, date au-delà)', () => {
    // C'est la contrepartie visible à l'écran : l'axe doit changer d'allure à la bascule.
    //
    // ⚠️ MESURÉ (ICU 78.2) — `{ day: '2-digit', month: '2-digit' }` n'est qu'une DEMANDE :
    // es-ES rend « 1/7 », non « 01/07 » (fr-FR, it-IT padent ; en-US pade et inverse en
    // « 07/01 »). C'est la convention de la locale, pas un défaut : le libellé reste une date
    // distincte et ordonnée. D'où `\d{1,2}` — une assertion en `\d{2}` rougirait sur l'espagnol
    // et pousserait à « corriger » un rendu correct.
    const sales = [at('2026-07-01', 1), at('2026-07-02', 2)]
    for (const lang of LANGS) {
      for (const name of buildSalesSeries(sales, '7days', lang).map(p => p.name)) {
        expect(name, `7 j/${lang} : « ${name} » n'est pas un nom de jour`).not.toMatch(/\d/)
      }
      for (const period of ['30days', '3months'] as const) {
        for (const name of buildSalesSeries(sales, period, lang).map(p => p.name)) {
          expect(name, `${period}/${lang} : « ${name} » n'est pas une date`).toMatch(/\d{1,2}\D\d{1,2}/)
        }
      }
    }
  })

  // ── garde-fous ────────────────────────────────────────────────────────────────
  it('une série vide reste vide (aucun point fantôme)', () => {
    expect(buildSalesSeries([], '7days', 'fr')).toEqual([])
  })

  it('`total` absent ou null compte la transaction sans fausser le CA', () => {
    const points = buildSalesSeries(
      [{ createdAt: '2026-07-01T12:00:00Z' }, { createdAt: '2026-07-01T12:00:00Z', total: null }],
      '7days', 'fr',
    )
    expect(points[0]).toMatchObject({ ventes: 0, transactions: 2 })
  })

  it('le libellé ne recule pas d\'un jour (piège `new Date(iso)` = minuit UTC)', () => {
    // Sans le `T00:00:00` local, le 1er se rendrait « 30/06 » en fuseau négatif.
    const [point] = buildSalesSeries([at('2026-07-01', 1)], '30days', 'fr')
    expect(point.name).toBe('01/07')
  })
})
