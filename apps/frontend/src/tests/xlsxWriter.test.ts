import { describe, it, expect } from 'vitest'
import { buildXlsxBytes, colName, type XlsxSheet } from '@/utils/xlsxWriter'

// Le zip STORED n'étant PAS compressé, le XML des feuilles est lisible tel quel dans les
// octets → on peut vérifier la structure + le contenu sans lecteur zip externe.
// latin1 : pour les signatures binaires (octet-à-octet). utf8 : pour le contenu XML (é, …).
const asLatin1 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s }
const asUtf8 = (b: Uint8Array) => new TextDecoder('utf-8').decode(b)

describe('xlsxWriter — colName', () => {
  it('mappe les index 0-based vers A, B, Z, AA, AB', () => {
    expect(colName(0)).toBe('A')
    expect(colName(1)).toBe('B')
    expect(colName(25)).toBe('Z')
    expect(colName(26)).toBe('AA')
    expect(colName(27)).toBe('AB')
  })
})

describe('xlsxWriter — buildXlsxBytes', () => {
  const sheets: XlsxSheet[] = [
    { name: 'Ventes', headers: ['Date', 'Montant'], rows: [['2026-05-01', 1500], ['2026-05-02', 2300]] },
    { name: 'Dépenses', headers: ['Libellé', 'Montant'], rows: [['Loyer', 200000]] },
  ]
  const bytes = buildXlsxBytes(sheets)
  const bin = asLatin1(bytes)
  const text = asUtf8(bytes)

  it('produit un zip valide (signatures PK locale + EOCD)', () => {
    expect(bytes[0]).toBe(0x50) // 'P'
    expect(bytes[1]).toBe(0x4B) // 'K'
    expect(bin.includes('PK\x05\x06')).toBe(true) // End Of Central Directory
  })

  it('contient les parties OOXML obligatoires', () => {
    expect(text).toContain('[Content_Types].xml')
    expect(text).toContain('xl/workbook.xml')
    expect(text).toContain('xl/worksheets/sheet1.xml')
    expect(text).toContain('xl/worksheets/sheet2.xml')
  })

  it('écrit les noms de feuilles, en-têtes et données (chaînes inlineStr + nombres)', () => {
    expect(text).toContain('name="Ventes"')
    expect(text).toContain('name="Dépenses"')
    expect(text).toContain('<t xml:space="preserve">Date</t>')
    expect(text).toContain('<v>1500</v>')
    expect(text).toContain('<v>200000</v>')
  })

  it('échappe le XML et dédoublonne/tronque les noms de feuilles', () => {
    const out = asUtf8(buildXlsxBytes([
      { name: 'A & B <x>', headers: ['H'], rows: [['v"q']] },
      { name: 'A & B <x>', headers: ['H'], rows: [[1]] }, // doublon → suffixé
    ]))
    expect(out).toContain('&amp;')
    expect(out).toContain('&lt;x&gt;')
    expect(out).toContain('v&quot;q')
    // 2 feuilles malgré le nom identique (dédoublonnage)
    expect(out).toContain('sheetId="1"')
    expect(out).toContain('sheetId="2"')
  })
})
