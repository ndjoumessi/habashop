import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { normalizeBarcode, isValidBarcode, matchesScannedCode } from '../lib/barcode'

// Anti-dérive du miroir backend ↔ mobile : ce test ET son jumeau
// mobile/src/__tests__/barcodeShared.test.ts lisent le MÊME fichier de cas.
// Si la règle change d'un côté sans l'autre, l'un des deux tests échoue.
interface Case { label: string; raw: string; canonical: string; valid: boolean }
interface ScanCase { label: string; barcode: string; sku: string; scanned: string; match: boolean }
const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../../docs/shared-fixtures/barcode-cases.json'), 'utf8'),
) as { cases: Case[]; scanCases: ScanCase[] }

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
    // Un UPC-A scanné (12 ch.) doit retrouver le produit stocké en EAN-13 (13 ch.).
    expect(normalizeBarcode('036000291452')).toBe('0036000291452')
    expect(normalizeBarcode('036000291452')).toBe(normalizeBarcode('0036000291452'))
  })
})

// ── scanCases : le backend rejoint le miroir (web + mobile les lisaient déjà) ──────────
describe('matchesScannedCode — cas PARTAGÉS (anti-dérive backend ↔ web ↔ mobile)', () => {
  for (const c of fixture.scanCases) {
    it(`scan: ${c.label}`, () => {
      expect(matchesScannedCode({ barcode: c.barcode, sku: c.sku }, c.scanned)).toBe(c.match)
    })
  }
})
