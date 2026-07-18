import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { normalizeBarcode, isValidBarcode, generateEAN13, barcodeFormat } from '@/lib/barcode'

// Anti-dérive du miroir backend ↔ mobile ↔ frontend : ce test ET ses jumeaux
// (apps/backend/src/tests/barcodeShared.test.ts, mobile/src/__tests__/barcodeShared.test.ts)
// lisent le MÊME fichier de cas. Si la règle change d'un côté sans les autres,
// un des trois tests échoue. Les tests frontend tournent depuis apps/frontend
// (cf. CLAUDE.md) → la fixture est à ../../docs/ depuis le cwd.
interface Case { label: string; raw: string; canonical: string; valid: boolean }
const fixture = JSON.parse(
  readFileSync(join(process.cwd(), '../../docs/shared-fixtures/barcode-cases.json'), 'utf8'),
) as { cases: Case[] }

describe('barcode — cas PARTAGÉS backend/mobile/frontend (anti-dérive)', () => {
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

describe('generateEAN13 — second recours', () => {
  it('produit un EAN-13 valide, préfixe interne 200', () => {
    const code = generateEAN13(() => 0.5) // rnd déterministe
    expect(code).toHaveLength(13)
    expect(code.startsWith('200')).toBe(true)
    expect(isValidBarcode(code)).toBe(true)
    expect(barcodeFormat(code)).toBe('EAN13')
  })
})

describe('barcodeFormat', () => {
  it('EAN-13 / EAN-8 / inconnu', () => {
    expect(barcodeFormat('4006381333931')).toBe('EAN13')
    expect(barcodeFormat('96385074')).toBe('EAN8')
    expect(barcodeFormat('12345')).toBe(null)
  })
})
