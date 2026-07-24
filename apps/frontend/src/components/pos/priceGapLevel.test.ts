import { describe, it, expect } from 'vitest'
import { priceDivergenceRows, priceGapLevel, staleUntilLabel, promoBadgeVisible, type DivRow } from './POSProductGrid'

// ⚠️ AUDIT DES ÉCARTS DE PRIX — Chantier B, PR2.
// Avant la qualification serveur (`staleCatalogAt`), un catalogue POS périmé produisait la
// MÊME ligne ambre « à regarder » qu'un prix forgé : l'écran accusait un caissier honnête.
// Ces tests verrouillent la dérivation qui sépare les deux, et son biais de PRUDENCE
// (mêler expliqué et inexpliqué reste « à regarder »).

const ligne = (over: Partial<DivRow> = {}): DivRow => ({
  name: 'Café', qty: 1, submitted: 1000, catalog: 1200, corrected: true, deltaXOF: -200, staleAt: null, ...over,
})

describe('priceGapLevel — trois traitements distincts', () => {
  it('écart EN LIGNE que le serveur n’explique pas → « à regarder »', () => {
    expect(priceGapLevel([ligne()])).toBe('look')
  })

  it('écart expliqué par un tarif précédent → « tarif précédent », PAS une alerte', () => {
    expect(priceGapLevel([ligne({ staleAt: '2026-07-24T08:00:00.000Z' })])).toBe('previous')
  })

  it('montant honoré hors-ligne, sans qualification → « hors-ligne » (bénin, historique)', () => {
    expect(priceGapLevel([ligne({ corrected: false })])).toBe('offline')
  })

  it('montant honoré hors-ligne MAIS qualifié → « tarif précédent » (on sait pourquoi)', () => {
    expect(priceGapLevel([ligne({ corrected: false, staleAt: '2026-07-24T08:00:00.000Z' })])).toBe('previous')
  })

  // Le biais de prudence : un écart inexpliqué ne doit jamais être noyé par un écart expliqué
  // présent sur la même vente.
  it('PRUDENCE : vente mêlant un écart expliqué et un inexpliqué → « à regarder »', () => {
    expect(priceGapLevel([
      ligne({ staleAt: '2026-07-24T08:00:00.000Z' }),
      ligne({ name: 'Sucre', submitted: 1 }),
    ])).toBe('look')
  })
})

describe('priceDivergenceRows — dérivation depuis les lignes stockées', () => {
  const vente = (items: unknown[]) => ({ items })

  it('ne retient que les lignes réellement divergentes', () => {
    const rows = priceDivergenceRows(vente([
      { qty: 1, unitPrice: 1200, submittedPrice: 1000, catalogPrice: 1200, product: { name: 'Café' } },
      { qty: 2, unitPrice: 500, submittedPrice: null, catalogPrice: null, product: { name: 'Sucre' } },
      { qty: 1, unitPrice: 900, submittedPrice: 900, catalogPrice: 900, product: { name: 'Sel' } },
    ]))
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Café')
  })

  it('reporte la qualification serveur telle quelle (jamais recalculée côté client)', () => {
    const rows = priceDivergenceRows(vente([
      { qty: 1, unitPrice: 1200, submittedPrice: 1000, catalogPrice: 1200, staleCatalogAt: '2026-07-24T08:00:00.000Z', product: { name: 'Café' } },
    ]))
    expect(rows[0].staleAt).toBe('2026-07-24T08:00:00.000Z')
  })

  it('absence de qualification → null (et non « expliqué par défaut »)', () => {
    const rows = priceDivergenceRows(vente([
      { qty: 1, unitPrice: 1200, submittedPrice: 1, catalogPrice: 1200, product: { name: 'Café' } },
    ]))
    expect(rows[0].staleAt).toBeNull()
    expect(priceGapLevel(rows)).toBe('look')
  })

  it('écart en argent SIGNÉ et multiplié par la quantité', () => {
    const rows = priceDivergenceRows(vente([
      { qty: 3, unitPrice: 1200, submittedPrice: 1000, catalogPrice: 1200, product: { name: 'Café' } },
    ]))
    expect(rows[0].deltaXOF).toBe(-600)
  })
})

describe('promoBadgeVisible — le badge PROMO ne ment pas (bug #125)', () => {
  const FUTUR = '2999-12-31'
  const PASSE = '2020-01-01'
  const now = new Date('2026-07-24T09:00:00.000Z')

  it('promo active + client détail → badge', () => {
    expect(promoBadgeVisible(true, FUTUR, 'retail', now)).toBe(true)
  })

  it('promo EXPIRÉE + client détail → PAS de badge (le prix est déjà normal)', () => {
    expect(promoBadgeVisible(true, PASSE, 'retail', now)).toBe(false)
  })

  it('promo active mais client GROS → pas de badge (tarif de gros, pas la promo détail)', () => {
    expect(promoBadgeVisible(true, FUTUR, 'wholesale', now)).toBe(false)
  })

  it('pas de promo → pas de badge', () => {
    expect(promoBadgeVisible(false, null, 'retail', now)).toBe(false)
  })

  it('promo sans date de fin + détail → badge (comportement historique)', () => {
    expect(promoBadgeVisible(true, null, 'retail', now)).toBe(true)
  })
})

describe('staleUntilLabel', () => {
  it('rend jour/mois + heure, sans année', () => {
    const s = staleUntilLabel('2026-07-24T08:30:00.000Z', 'fr')
    expect(s).toMatch(/\d{2}\/\d{2}/)
    expect(s).not.toMatch(/2026/)
  })

  it('date invalide → chaîne vide (jamais « Invalid Date » à l’écran)', () => {
    expect(staleUntilLabel('pas-une-date', 'fr')).toBe('')
  })
})
