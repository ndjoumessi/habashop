import { normalizeBarcode, isValidBarcode } from '@/lib/barcode'

describe('normalizeBarcode (scan ↔ base)', () => {
  it('laisse intact un EAN-13 propre', () => {
    expect(normalizeBarcode('6111245050034')).toBe('6111245050034')
  })

  it('réconcilie UPC-A (12) et son EAN-13 (13) — round-trip scan', () => {
    // 123456789012 est un UPC-A valide → EAN-13 « 0123456789012 » sans perte.
    expect(normalizeBarcode('123456789012')).toBe('0123456789012')
    expect(normalizeBarcode('123456789012')).toBe(normalizeBarcode('0123456789012'))
  })

  it('conserve un EAN-8 (zéros de tête préservés)', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074')
  })

  it('supprime les espaces / sauts de ligne parasites', () => {
    expect(normalizeBarcode(' 6111245050034\n')).toBe('6111245050034')
  })

  it('renvoie une chaîne vide pour null / undefined / vide', () => {
    expect(normalizeBarcode(null)).toBe('')
    expect(normalizeBarcode(undefined)).toBe('')
    expect(normalizeBarcode('')).toBe('')
  })

  it('isValidBarcode : accepte EAN-13 / EAN-8, refuse clé fausse', () => {
    expect(isValidBarcode('4006381333931')).toBe(true) // EAN-13
    expect(isValidBarcode('96385074')).toBe(true)       // EAN-8
    expect(isValidBarcode('4006381333930')).toBe(false) // clé fausse
    expect(isValidBarcode('036000291452')).toBe(false)  // UPC-A brut (à canonicaliser d'abord)
  })
})
