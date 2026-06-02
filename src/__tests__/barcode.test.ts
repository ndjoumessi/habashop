import { normalizeBarcode } from '@/lib/barcode'

describe('normalizeBarcode (scan ↔ base)', () => {
  it('laisse intact un EAN-13 propre', () => {
    expect(normalizeBarcode('6111245050034')).toBe('6111245050034')
  })

  it('réconcilie UPC-A (12) et EAN-13 (13) via le zéro de tête', () => {
    expect(normalizeBarcode('0123456789012')).toBe(normalizeBarcode('123456789012'))
  })

  it('supprime les espaces / sauts de ligne parasites', () => {
    expect(normalizeBarcode(' 6111245050034\n')).toBe('6111245050034')
  })

  it('renvoie une chaîne vide pour null / undefined / vide', () => {
    expect(normalizeBarcode(null)).toBe('')
    expect(normalizeBarcode(undefined)).toBe('')
    expect(normalizeBarcode('')).toBe('')
  })

  it('un code tout en zéros se normalise en vide (à ignorer côté appelant)', () => {
    expect(normalizeBarcode('0000')).toBe('')
  })
})
