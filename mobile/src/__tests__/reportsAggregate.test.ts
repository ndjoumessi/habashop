import {
  salesByWeekday, bestCalendarDay, localDateKey, formatDayLabel, bubbleLeftPx, WEEK_ORDER,
  type SaleLike,
} from '@/lib/reportsAggregate'

// ⚠️ Les dates sont construites par `new Date(y, m-1, d, h)` — constructeur LOCAL, donc
// ces tests ne dépendent pas du fuseau de la machine qui les exécute. Écrire
// `new Date('2026-07-11T10:00:00Z')` rendrait le jour de semaine attendu faux à l'ouest.
const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h)

const sale = (date: Date, total: number): SaleLike => ({ createdAt: date, total })

describe('salesByWeekday', () => {
  it('rend 7 entrées lundi→dimanche, jours sans vente compris', () => {
    const rows = salesByWeekday([sale(at(2026, 7, 15), 1000)], 'fr') // mercredi

    expect(rows).toHaveLength(7)
    expect(rows.map(r => r.label)).toEqual(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'])
    expect(rows.map(r => r.weekday)).toEqual([...WEEK_ORDER])
    expect(rows.filter(r => r.value === 0)).toHaveLength(6)
    expect(rows.find(r => r.label === 'Mer')!.value).toBe(1000)
  })

  it('agrège TOUT le tableau reçu — aucun refenêtrage sur 7 jours', () => {
    // 12 semaines de samedis : si la fonction refenêtrait, elle n'en garderait qu'un.
    const samedis = Array.from({ length: 12 }, (_, k) => sale(at(2026, 7, 4 + k * 7), 500))

    const rows = salesByWeekday(samedis, 'fr')

    expect(rows.find(r => r.label === 'Sam')!.value).toBe(12 * 500)
  })

  it('somme des XOF bruts sans conversion ni arrondi', () => {
    const rows = salesByWeekday(
      [sale(at(2026, 7, 13), 17_010), sale(at(2026, 7, 13), 2_990)],
      'fr',
    )
    expect(rows.find(r => r.label === 'Lun')!.value).toBe(20_000)
  })

  it('localise les libellés et retombe sur le français sur une langue inconnue', () => {
    const j = at(2026, 7, 12) // dimanche
    expect(salesByWeekday([sale(j, 1)], 'en').map(r => r.label))
      .toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(salesByWeekday([sale(j, 1)], 'de')[0].label).toBe('Lun')
  })

  it('ignore une date invalide ou un total absent, sans planter', () => {
    const rows = salesByWeekday(
      [
        { createdAt: 'pas-une-date', total: 9_999 },
        { createdAt: at(2026, 7, 14), total: null },
        sale(at(2026, 7, 14), 300),
      ],
      'fr',
    )
    expect(rows.reduce((a, r) => a + r.value, 0)).toBe(300)
  })

  it('rend un tableau complet à 0 sur une entrée vide', () => {
    const rows = salesByWeekday([], 'fr')
    expect(rows).toHaveLength(7)
    expect(rows.every(r => r.value === 0)).toBe(true)
  })
})

describe('bestCalendarDay', () => {
  it('rend null sur un tableau vide — jamais un jour à 0 inventé', () => {
    expect(bestCalendarDay([])).toBeNull()
    expect(bestCalendarDay([{ createdAt: 'nawak', total: 100 }])).toBeNull()
  })

  it('somme par DATE calendaire, pas par vente', () => {
    const best = bestCalendarDay([
      sale(at(2026, 7, 12, 9), 4_000),
      sale(at(2026, 7, 12, 21), 6_000),
      sale(at(2026, 7, 13, 10), 7_000),
    ])
    expect(best).toEqual({ dateISO: '2026-07-12', value: 10_000 })
  })

  // ⚠️ LE cas qui distingue les deux fonctions : sans lui, confondre « meilleur jour de
  // semaine » et « meilleure journée » passerait inaperçu — c'est exactement le bug
  // d'origine (le KPI répondait sur un fenêtrage, le graphe sur un autre).
  it('ne confond PAS meilleure journée calendaire et meilleur jour de semaine', () => {
    const rows: SaleLike[] = [
      // 4 lundis à 5 000 → le lundi domine le CUMUL hebdomadaire (20 000)…
      sale(at(2026, 7, 6), 5_000),
      sale(at(2026, 7, 13), 5_000),
      sale(at(2026, 7, 20), 5_000),
      sale(at(2026, 7, 27), 5_000),
      // …mais aucune journée lundi ne bat ce samedi-là (12 000 en une date).
      sale(at(2026, 7, 11, 8), 7_000),
      sale(at(2026, 7, 11, 19), 5_000),
    ]

    const weekly = salesByWeekday(rows, 'fr')
    const bestWeekday = weekly.reduce((b, r) => (r.value > b.value ? r : b))
    const bestDay = bestCalendarDay(rows)!

    expect(bestWeekday.label).toBe('Lun')      // meilleur JOUR DE SEMAINE
    expect(bestWeekday.value).toBe(20_000)
    expect(bestDay.dateISO).toBe('2026-07-11') // meilleure JOURNÉE — un samedi
    expect(bestDay.value).toBe(12_000)
    expect(bestDay.value).toBeLessThan(bestWeekday.value)
  })

  it('invariant : sur un jeu non vide, le meilleur jour ≥ la plus grosse vente unitaire', () => {
    const totals = [1_200, 45_000, 300, 8_800, 45_000, 90]
    const rows = totals.map((t, k) => sale(at(2026, 7, 1 + (k % 28), 12), t))

    const best = bestCalendarDay(rows)!

    expect(best.value).toBeGreaterThanOrEqual(Math.max(...totals))
  })

  it('égalité : la première date rencontrée gagne', () => {
    const best = bestCalendarDay([sale(at(2026, 7, 12), 500), sale(at(2026, 7, 13), 500)])
    expect(best!.dateISO).toBe('2026-07-12')
  })
})

describe('localDateKey / formatDayLabel', () => {
  it('clé calendaire LOCALE — une vente de fin de soirée reste le même jour', () => {
    expect(localDateKey(at(2026, 7, 12, 23))).toBe('2026-07-12')
    expect(localDateKey(at(2026, 1, 5, 0))).toBe('2026-01-05')
  })

  it('rend « Sam 12 juil. » sans décalage de fuseau', () => {
    expect(formatDayLabel('2026-07-12', 'fr')).toBe('Dim 12 juil.')
    expect(formatDayLabel('2026-07-11', 'fr')).toBe('Sam 11 juil.')
    expect(formatDayLabel('2026-07-11', 'en')).toBe('Sat 11 Jul')
  })

  it('rend la chaîne telle quelle sur une clé illisible', () => {
    expect(formatDayLabel('', 'fr')).toBe('')
    expect(formatDayLabel('bidon', 'fr')).toBe('bidon')
  })
})

describe('bubbleLeftPx — clamp de la bulle', () => {
  // Mesures réelles de l'écran : carte pleine largeur sur un téléphone courant,
  // 7 colonnes, gap Spacing.sm = 8. La bulle (« 2 095,96 € » + « Dim ») est plus LARGE
  // qu'une colonne : c'est précisément ce qui la fait déborder sans clamp.
  const CHART = 327, GAP = 8, N = 7
  const COL = (CHART - GAP * (N - 1)) / N // ≈ 38,7 px
  const BUBBLE = 96

  it('la bulle est plus large qu une colonne — sinon ce test ne prouve rien', () => {
    expect(BUBBLE).toBeGreaterThan(COL)
  })

  // ⚠️ LE cas jamais vu à l'écran (les captures du 2026-07-31 couvraient Dim, pas Lun).
  it('Lun (extrême GAUCHE) : collé au bord, jamais négatif', () => {
    const left = bubbleLeftPx(0, CHART, BUBBLE, N, GAP)
    expect(left).toBe(0)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + BUBBLE).toBeLessThanOrEqual(CHART)
  })

  it('Dim (extrême DROITE) : collé au bord opposé', () => {
    const left = bubbleLeftPx(6, CHART, BUBBLE, N, GAP)
    expect(left).toBe(CHART - BUBBLE)
    expect(left + BUBBLE).toBe(CHART)
  })

  it('barre centrale (Jeu) : centrée sur sa colonne, pas clampée', () => {
    const left = bubbleLeftPx(3, CHART, BUBBLE, N, GAP)
    const centre = 3 * (COL + GAP) + COL / 2
    expect(left + BUBBLE / 2).toBeCloseTo(centre, 5)
    expect(left).toBeGreaterThan(0)
    expect(left + BUBBLE).toBeLessThan(CHART)
  })

  it('invariant : aucune des 7 positions ne sort de la carte', () => {
    for (let i = 0; i < N; i++) {
      const left = bubbleLeftPx(i, CHART, BUBBLE, N, GAP)
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left + BUBBLE).toBeLessThanOrEqual(CHART)
    }
  })

  it('tient sur un très petit écran ET sur une tablette', () => {
    for (const w of [240, 327, 700, 1024]) {
      for (let i = 0; i < N; i++) {
        const left = bubbleLeftPx(i, w, BUBBLE, N, GAP)
        expect(left).toBeGreaterThanOrEqual(0)
        expect(left + BUBBLE).toBeLessThanOrEqual(w)
      }
    }
  })

  // Cas dégénéré : sans le `Math.max(chartWidth - bubbleWidth, 0)` de la borne haute,
  // la borne serait négative et la bulle sortirait par la gauche.
  it('bulle plus large que le graphe : left = 0, jamais négatif', () => {
    expect(bubbleLeftPx(0, 100, 400, N, GAP)).toBe(0)
    expect(bubbleLeftPx(6, 100, 400, N, GAP)).toBe(0)
  })

  it('entrées absurdes : 0 plutôt qu un NaN qui casserait le rendu', () => {
    expect(bubbleLeftPx(0, 0, BUBBLE, N, GAP)).toBe(0)   // avant le premier onLayout
    expect(bubbleLeftPx(-1, CHART, BUBBLE, N, GAP)).toBe(0)
    expect(bubbleLeftPx(9, CHART, BUBBLE, N, GAP)).toBe(0)
    expect(bubbleLeftPx(0, CHART, BUBBLE, 0, GAP)).toBe(0)
  })
})
