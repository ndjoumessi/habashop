import { describe, it, expect } from 'vitest'
import {
  buildSalesSeries, pickAxisTicks, CHART_PERIODS,
  type SaleForChart, type SalesPoint,
} from '@/components/dashboard/dashboardShared'
import type { Lang } from '@/stores/appStore'

/**
 * VERROU — le graphe de ventes est une SÉRIE TEMPORELLE CONTINUE.
 *
 * Deux bugs fermés, l'un après l'autre :
 *  1. la clé de groupement était `labels[d.getDay()]`, un NOM DE JOUR : sur « 3 mois » les
 *     ~13 mercredis s'additionnaient en un point « Mer », et l'axe sortait dans l'ordre
 *     d'apparition (« Sam · Ven · Mer · Mar · Lun · Dim · Jeu ») ;
 *  2. les jours sans vente étaient ABSENTS de la série et l'axe était catégoriel : onze jours
 *     creux occupaient la même largeur qu'un seul, donc la PENTE mentait.
 *
 * ⚠️ Toutes les dates sont construites en heure LOCALE (`new Date(y, m, d, 12)`), jamais en
 * `Z` : le groupement, la fenêtre et les libellés sont locaux, et un littéral UTC rendrait
 * ces cas dépendants du fuseau du runner.
 */

const LANGS: Lang[] = ['fr', 'en', 'es', 'it']
/** Midi local — hors d'atteinte des bornes de jour. */
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12)
const at = (y: number, m: number, d: number, total: number): SaleForChart =>
  ({ createdAt: day(y, m, d), total })

/** Repère fixe : jeudi 5 mars 2026, 14 h 30. */
const NOW = new Date(2026, 2, 5, 14, 30)
const nonZero = (pts: SalesPoint[]) => pts.filter(p => p.ventes > 0)
const DAY_MS = 86400000

describe('graphe de ventes — série temporelle continue', () => {
  // ── (a) le bug d'origine ──────────────────────────────────────────────────────
  it('trois ventes de MÊME jour de semaine, dates différentes → TROIS points distincts', () => {
    // 11, 18 et 25 février 2026 sont trois MERCREDIS. L'ancienne version les fusionnait en
    // un unique point « Mer » portant 600.
    const sales = [at(2026, 2, 11, 100), at(2026, 2, 18, 200), at(2026, 2, 25, 300)]
    for (const period of ['30days', '3months'] as const) {
      const hits = nonZero(buildSalesSeries(sales, period, 'fr', NOW))
      expect(hits, `${period} : les mercredis ont fusionné`).toHaveLength(3)
      expect(hits.map(p => p.ventes)).toEqual([100, 200, 300])
      expect(hits.map(p => p.transactions)).toEqual([1, 1, 1])
    }
  })

  it('deux ventes du MÊME jour fusionnent bien en un point cumulé', () => {
    // Contre-épreuve : le correctif ne doit pas avoir désactivé tout regroupement.
    const hits = nonZero(buildSalesSeries([at(2026, 2, 18, 100), at(2026, 2, 18, 250)], '30days', 'fr', NOW))
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ ventes: 350, transactions: 2 })
  })

  // ── (b) ordre chronologique ───────────────────────────────────────────────────
  it('les points sortent en ordre chronologique croissant, quel que soit l\'ordre d\'entrée', () => {
    const shuffled = [at(2026, 2, 25, 4), at(2026, 2, 11, 1), at(2026, 3, 2, 5), at(2026, 2, 18, 3), at(2026, 2, 14, 2)]
    for (const period of ['30days', '3months'] as const) {
      for (const lang of LANGS) {
        // `ventes` encode le RANG chronologique → l'assertion ne lit aucun libellé, donc ne
        // dépend d'aucune locale.
        expect(nonZero(buildSalesSeries(shuffled, period, lang, NOW)).map(p => p.ventes),
          `${period}/${lang} : série non triée`).toEqual([1, 2, 3, 4, 5])
      }
    }
  })

  it('`ts` est strictement croissant et avance d\'un jour exactement', () => {
    // C'est ce qui rend l'axe temporel exploitable : `scale="time"` lit `ts`, pas l'index.
    for (const period of CHART_PERIODS) {
      const ts = buildSalesSeries([], period, 'fr', NOW).map(p => p.ts)
      expect(ts.length).toBeGreaterThan(1)
      for (let i = 1; i < ts.length; i++) {
        expect(ts[i] - ts[i - 1], `${period} : trou ou doublon à l'index ${i}`).toBe(DAY_MS)
      }
    }
  })

  // ── (c) unicité des libellés ──────────────────────────────────────────────────
  it('à 30 j / 3 mois, aucun libellé n\'apparaît deux fois', () => {
    for (const period of ['30days', '3months'] as const) {
      for (const lang of LANGS) {
        const names = buildSalesSeries([], period, lang, NOW).map(p => p.name)
        expect(new Set(names).size, `${period}/${lang} : libellés dupliqués`).toBe(names.length)
      }
    }
  })

  it('« 7 jours » rend 7 points, donc 7 jours de semaine DISTINCTS', () => {
    // ⚠️ C'est pour ça que le premier jour (partiel) de la fenêtre glissante est exclu : à
    // 8 points, le premier et le dernier tombent le même jour de semaine et le libellé
    // « mer. » apparaîtrait deux fois.
    for (const lang of LANGS) {
      const names = buildSalesSeries([], '7days', lang, NOW).map(p => p.name)
      expect(names).toHaveLength(7)
      expect(new Set(names).size, `7 j/${lang} : ${names.join(' · ')}`).toBe(7)
    }
  })

  // ── remplissage à 0 ───────────────────────────────────────────────────────────
  it('les jours sans vente valent 0 — ils ne sont pas absents', () => {
    // Deux ventes séparées par 13 jours creux : la série doit porter les 13 zéros.
    const pts = buildSalesSeries([at(2026, 2, 18, 500), at(2026, 3, 4, 700)], '30days', 'fr', NOW)
    expect(pts).toHaveLength(30)
    expect(nonZero(pts)).toHaveLength(2)

    const iA = pts.findIndex(p => p.ventes === 500)
    const iB = pts.findIndex(p => p.ventes === 700)
    expect(iB - iA, 'les jours creux ont été écrasés').toBe(14)
    for (const p of pts.slice(iA + 1, iB)) {
      expect(p).toMatchObject({ ventes: 0, transactions: 0 })
    }
  })

  it('la fenêtre affichée compte exactement 7 / 30 jours, et ~3 mois', () => {
    expect(buildSalesSeries([], '7days', 'fr', NOW)).toHaveLength(7)
    expect(buildSalesSeries([], '30days', 'fr', NOW)).toHaveLength(30)
    const q = buildSalesSeries([], '3months', 'fr', NOW)
    expect(q.length).toBeGreaterThanOrEqual(89)
    expect(q.length).toBeLessThanOrEqual(93)
  })

  it('la série se termine AUJOURD\'HUI, même sans vente ce jour-là', () => {
    for (const period of CHART_PERIODS) {
      const pts = buildSalesSeries([], period, 'fr', NOW)
      expect(new Date(pts[pts.length - 1].ts).getDate()).toBe(NOW.getDate())
    }
  })

  it('une vente hors fenêtre n\'est pas tracée', () => {
    // Un an plus tôt : hors des trois périodes.
    const pts = buildSalesSeries([at(2025, 2, 18, 900)], '30days', 'fr', NOW)
    expect(nonZero(pts)).toHaveLength(0)
    expect(pts).toHaveLength(30)
  })

  // ── graduations ───────────────────────────────────────────────────────────────
  it('les graduations sont bornées, ordonnées, et gardent les extrémités', () => {
    const q = buildSalesSeries([], '3months', 'fr', NOW)
    const ticks = pickAxisTicks(q, 7)
    expect(ticks.length).toBeLessThanOrEqual(7)
    expect(ticks[0]).toBe(q[0].ts)
    expect(ticks[ticks.length - 1]).toBe(q[q.length - 1].ts)
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks)
    // Série courte : toutes les graduations, aucune perte.
    const week = buildSalesSeries([], '7days', 'fr', NOW)
    expect(pickAxisTicks(week, 7)).toEqual(week.map(p => p.ts))
  })

  // ── garde-fous ────────────────────────────────────────────────────────────────
  it('`total` absent ou null compte la transaction sans fausser le CA', () => {
    const pts = buildSalesSeries(
      [{ createdAt: day(2026, 2, 18) }, { createdAt: day(2026, 2, 18), total: null }],
      '30days', 'fr', NOW,
    )
    const hit = pts.find(p => p.transactions > 0)
    expect(hit).toMatchObject({ ventes: 0, transactions: 2 })
  })

  it('une vente en BORD de journée locale reste dans SON jour', () => {
    // ⚠️ Ce cas existe parce qu'un sabotage l'a exigé. Repasser la clé en `toISOString()`
    // (jour UTC) ne cassait AUCUN test : avec des fixtures à midi, la vente et le jour affiché
    // se décalent tous deux du même nombre d'heures, donc les deux erreurs s'annulent et le
    // seau retombe juste. Le défaut n'apparaît qu'en bord de journée — 23 h 30 en UTC+1 part
    // dans le seau du LENDEMAIN. Un verrou qui n'exerce que midi est vert pour la mauvaise raison.
    const late = new Date(2026, 1, 18, 23, 30)   // 18 février, 23 h 30 LOCAL
    const early = new Date(2026, 1, 19, 0, 30)   // 19 février, 00 h 30 LOCAL
    const pts = buildSalesSeries(
      [{ createdAt: late, total: 111 }, { createdAt: early, total: 222 }],
      '30days', 'fr', NOW,
    )
    const dayOf = (v: number) => new Date(pts.find(p => p.ventes === v)!.ts).getDate()
    expect(dayOf(111), '23 h 30 a glissé hors de son jour').toBe(18)
    expect(dayOf(222), '00 h 30 a glissé hors de son jour').toBe(19)
  })

  it('le libellé ne recule pas d\'un jour (piège du jour UTC)', () => {
    const pts = buildSalesSeries([], '30days', 'fr', NOW)
    const last = pts[pts.length - 1]
    expect(last.name).toBe('05/03')
  })
})
