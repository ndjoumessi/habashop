import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { normalizeBarcode, isValidBarcode, generateEAN13, barcodeFormat, isAcceptableBarcode, barcodeMatches } from '@/lib/barcode'

// Anti-dérive du miroir backend ↔ mobile ↔ frontend : ce test ET ses jumeaux
// (apps/backend/src/tests/barcodeShared.test.ts, mobile/src/__tests__/barcodeShared.test.ts)
// lisent le MÊME fichier de cas. Si la règle change d'un côté sans les autres,
// un des trois tests échoue. Les tests frontend tournent depuis apps/frontend
// (cf. CLAUDE.md) → la fixture est à ../../docs/ depuis le cwd.
interface Case { label: string; raw: string; canonical: string; valid: boolean }
interface SearchCase { label: string; stored: string; query: string; match: boolean }
const fixture = JSON.parse(
  readFileSync(join(process.cwd(), '../../docs/shared-fixtures/barcode-cases.json'), 'utf8'),
) as { cases: Case[]; searchCases: SearchCase[] }

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

// Verrouille la garde de saisie (fiche produit, save, lookup) — G2/G4.
describe('isAcceptableBarcode — garde de saisie unique', () => {
  it('vide accepté ; EAN-13/EAN-8/UPC-A acceptés ; invalide refusé', () => {
    expect(isAcceptableBarcode('')).toBe(true)          // pas de code
    expect(isAcceptableBarcode('4006381333931')).toBe(true) // EAN-13
    expect(isAcceptableBarcode('96385074')).toBe(true)      // EAN-8
    expect(isAcceptableBarcode('036000291452')).toBe(true)  // UPC-A → EAN-13
    expect(isAcceptableBarcode('4006381333930')).toBe(false) // clé fausse
    expect(isAcceptableBarcode('12345')).toBe(false)        // trop court
  })
})

// Verrouille la RECHERCHE par code-barres — G1 (inventaire), G5 (POS), G7/G8 (mobile).
describe('barcodeMatches — cas PARTAGÉS (recherche)', () => {
  for (const c of fixture.searchCases) {
    it(c.label, () => {
      expect(barcodeMatches(c.stored, c.query)).toBe(c.match)
    })
  }
})

// Méta-test anti-régression : la SIGNATURE des 5 ruptures était une garde « 13
// chiffres » locale (regex \d{13}) dupliquée hors du lib. Ce test échoue si une
// telle regex réapparaît N'IMPORTE OÙ dans src, sauf le lib (source unique de la
// règle) et les tests. → plus de règle barcode locale possible sans casser un test.
describe('anti-régression : aucune garde « 13 chiffres » locale hors du lib', () => {
  it('aucun /\\d{13}/ hors src/lib/barcode.ts', () => {
    const root = join(process.cwd(), 'src')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) { walk(p); continue }
        if (!/\.(ts|tsx)$/.test(p)) continue
        if (p.endsWith('.test.ts') || p.endsWith('.test.tsx')) continue
        if (p.endsWith(join('lib', 'barcode.ts'))) continue // source unique légitime
        // Cible la signature regex EAN « \d{13} » (pas les size={13} des icônes).
        if (/\\d\{13\}/.test(readFileSync(p, 'utf8'))) offenders.push(p)
      }
    }
    walk(root)
    expect(offenders, `Garde « 13 chiffres » locale détectée — utilisez isValidBarcode/isAcceptableBarcode : ${offenders.join(', ')}`).toEqual([])
  })
})
