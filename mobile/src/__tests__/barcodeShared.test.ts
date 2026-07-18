import { readFileSync } from 'fs'
import { join } from 'path'
import { normalizeBarcode, isValidBarcode, barcodeMatches, matchesScannedCode } from '@/lib/barcode'

// Anti-dérive du miroir backend ↔ mobile ↔ frontend : ce test ET ses jumeaux
// (apps/backend, apps/frontend) lisent le MÊME fichier de cas.
// Si la règle change d'un côté sans les autres, un des tests échoue.
interface Case { label: string; raw: string; canonical: string; valid: boolean }
interface SearchCase { label: string; stored: string; query: string; match: boolean }
interface ScanCase { label: string; barcode: string; sku: string; scanned: string; match: boolean }
const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../docs/shared-fixtures/barcode-cases.json'), 'utf8'),
) as { cases: Case[]; searchCases: SearchCase[]; scanCases: ScanCase[] }

describe('barcode — cas PARTAGÉS backend/mobile (anti-dérive)', () => {
  for (const c of fixture.cases) {
    it(`canonical: ${c.label}`, () => {
      expect(normalizeBarcode(c.raw)).toBe(c.canonical)
    })
    it(`valid: ${c.label}`, () => {
      expect(isValidBarcode(c.canonical)).toBe(c.valid)
    })
  }

  it('round-trip : UPC-A saisi (12) et son EAN-13 stocké (13) canonicalisent pareil', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452')
    expect(normalizeBarcode('036000291452')).toBe(normalizeBarcode('0036000291452'))
  })
})

// Verrouille la RECHERCHE par code-barres mobile — G7 (stock), G8 (recherche globale).
describe('barcodeMatches — cas PARTAGÉS (recherche)', () => {
  for (const c of fixture.searchCases) {
    it(c.label, () => {
      expect(barcodeMatches(c.stored, c.query)).toBe(c.match)
    })
  }
})

// Verrouille la RÉSOLUTION d'un code scanné → produit (POS mobile) — G10.
describe('matchesScannedCode — cas PARTAGÉS (scan → panier)', () => {
  for (const c of fixture.scanCases) {
    it(c.label, () => {
      expect(matchesScannedCode({ barcode: c.barcode, sku: c.sku }, c.scanned)).toBe(c.match)
    })
  }
})
