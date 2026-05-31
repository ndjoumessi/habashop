// ─── Générateur .xlsx ZÉRO DÉPENDANCE ────────────────────────────────────────
// Produit un vrai classeur OOXML (.xlsx) multi-feuilles, sans aucune lib externe.
// Le .xlsx EST un zip de parties XML ; on l'assemble en zip STORED (sans compression)
// → pas besoin de DEFLATE, juste les en-têtes zip + CRC32. Ouvre proprement dans
// Excel / LibreOffice / Google Sheets (aucun avertissement de format).
//
// Cellules supportées : chaîne (inlineStr → pas de table sharedStrings) et nombre.
// Pas de styles (formatage par défaut) — volontairement minimal.

export type XlsxCell = string | number | null | undefined
export interface XlsxSheet {
  name: string
  headers: string[]
  rows: XlsxCell[][]
}

// ─── CRC32 (table standard) ───────────────────────────────────────────────────
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()
function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

const ENC = new TextEncoder()
const escXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

// Index 0-based → nom de colonne Excel (A, B, … Z, AA, AB, …).
export function colName(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) }
  return s
}

// Nom de feuille valide Excel : ≤31 car., sans : \ / ? * [ ], unique.
function sanitizeSheetNames(sheets: XlsxSheet[]): string[] {
  const seen = new Set<string>()
  return sheets.map((s, idx) => {
    let name = (s.name || `Feuille${idx + 1}`).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || `Feuille${idx + 1}`
    let candidate = name, n = 2
    while (seen.has(candidate.toLowerCase())) { candidate = `${name.slice(0, 28)} ${n++}` }
    seen.add(candidate.toLowerCase())
    return candidate
  })
}

function sheetXml(sheet: XlsxSheet): string {
  const allRows = [sheet.headers, ...sheet.rows]
  const rowsXml = allRows.map((row, r) => {
    const cells = row.map((cell, c) => {
      const ref = colName(c) + (r + 1)
      if (cell === null || cell === undefined || cell === '') return `<c r="${ref}"/>`
      if (typeof cell === 'number' && Number.isFinite(cell)) return `<c r="${ref}"><v>${cell}</v></c>`
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escXml(String(cell))}</t></is></c>`
    }).join('')
    return `<row r="${r + 1}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`
}

function buildParts(sheets: XlsxSheet[]): Record<string, string> {
  const names = sanitizeSheetNames(sheets)
  const parts: Record<string, string> = {}

  parts['[Content_Types].xml'] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    `</Types>`

  parts['_rels/.rels'] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`

  parts['xl/workbook.xml'] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    names.map((nm, i) => `<sheet name="${escXml(nm)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    `</sheets></workbook>`

  parts['xl/_rels/workbook.xml.rels'] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `</Relationships>`

  sheets.forEach((s, i) => { parts[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s) })
  return parts
}

// ─── ZIP STORED (sans compression) ──────────────────────────────────────────
function zipStored(parts: Record<string, string>): Uint8Array {
  // Date/heure DOS fixes (1980-01-01) → sortie déterministe, pas de dépendance à l'horloge.
  const DOS_TIME = 0, DOS_DATE = 0x0021
  const files = Object.entries(parts).map(([name, content]) => {
    const data = ENC.encode(content)
    return { name: ENC.encode(name), data, crc: crc32(data) }
  })

  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const f of files) {
    const lh = new Uint8Array(30 + f.name.length)
    const dv = new DataView(lh.buffer)
    dv.setUint32(0, 0x04034b50, true)         // signature en-tête local
    dv.setUint16(4, 20, true)                 // version requise
    dv.setUint16(6, 0, true)                  // flags
    dv.setUint16(8, 0, true)                  // méthode 0 = STORED
    dv.setUint16(10, DOS_TIME, true)
    dv.setUint16(12, DOS_DATE, true)
    dv.setUint32(14, f.crc, true)
    dv.setUint32(18, f.data.length, true)     // taille compressée (= brute)
    dv.setUint32(22, f.data.length, true)     // taille brute
    dv.setUint16(26, f.name.length, true)
    dv.setUint16(28, 0, true)                 // longueur extra
    lh.set(f.name, 30)
    local.push(lh, f.data)

    const ch = new Uint8Array(46 + f.name.length)
    const cv = new DataView(ch.buffer)
    cv.setUint32(0, 0x02014b50, true)         // signature entrée répertoire central
    cv.setUint16(4, 20, true)                 // version créateur
    cv.setUint16(6, 20, true)                 // version requise
    cv.setUint16(8, 0, true)
    cv.setUint16(10, 0, true)                 // méthode STORED
    cv.setUint16(12, DOS_TIME, true)
    cv.setUint16(14, DOS_DATE, true)
    cv.setUint32(16, f.crc, true)
    cv.setUint32(20, f.data.length, true)
    cv.setUint32(24, f.data.length, true)
    cv.setUint16(28, f.name.length, true)
    cv.setUint16(30, 0, true)                 // extra
    cv.setUint16(32, 0, true)                 // commentaire
    cv.setUint16(34, 0, true)                 // n° disque
    cv.setUint16(36, 0, true)                 // attrs internes
    cv.setUint32(38, 0, true)                 // attrs externes
    cv.setUint32(42, offset, true)            // offset en-tête local
    ch.set(f.name, 46)
    central.push(ch)
    offset += lh.length + f.data.length
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const centralOffset = offset
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)           // End Of Central Directory
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, centralOffset, true)

  const all = [...local, ...central, eocd]
  const total = all.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(total)
  let p = 0
  for (const c of all) { out.set(c, p); p += c.length }
  return out
}

/** Construit les octets d'un .xlsx multi-feuilles (pur, testable, sans DOM). */
export function buildXlsxBytes(sheets: XlsxSheet[]): Uint8Array {
  return zipStored(buildParts(sheets))
}

/** Génère et télécharge un .xlsx (wrapper DOM). */
export function writeXlsx(filename: string, sheets: XlsxSheet[]): void {
  const bytes = buildXlsxBytes(sheets)
  // cast : lib.dom typant Uint8Array<ArrayBufferLike> ne matche pas BlobPart (union SharedArrayBuffer).
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
