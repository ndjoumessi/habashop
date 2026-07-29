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

/**
 * ⚠️ INJECTION DE FORMULE — pourquoi le .xlsx n'a PAS besoin de `sanitizeCsv` (#173).
 *
 * Question posée à l'audit : le vecteur CSV vaut-il aussi pour le XLSX, puisque
 * `sanitizeSheetNames` neutralise les NOMS DE FEUILLE mais que rien ne touche aux CELLULES ?
 * MESURÉ sur la sortie réelle de `buildXlsxBytes`, plutôt que supposé :
 *
 *   <c r="A2" t="inlineStr"><is><t xml:space="preserve">=cmd|&apos;/c calc&apos;!A1</t></is></c>
 *
 * La différence avec le CSV est STRUCTURELLE, pas cosmétique. Un CSV ne porte AUCUN type :
 * le tableur doit deviner, et il devine « formule » sur un `=`/`+`/`-`/`@` initial — c'est
 * toute la faille. En OOXML le type est DÉCLARÉ (`t="inlineStr"`), et une formule exige un
 * élément `<f>` dédié. Il n'y a rien à deviner, donc rien à neutraliser : préfixer d'une
 * apostrophe ABÎMERAIT la donnée (l'apostrophe s'afficherait, elle, littéralement).
 *
 * Ce bloc verrouille les deux propriétés dont dépend ce raisonnement, pour qu'une évolution
 * du writer (détection de formules, passage à `sharedStrings` sans conserver le type…) ne
 * puisse pas rouvrir la question en silence.
 *
 * ⚠️ LIMITE ASSUMÉE : ce qui est mesuré ici, ce sont les octets QUE NOUS ÉMETTONS. Le fichier
 * n'a pas été ouvert dans un vrai Excel. Le résiduel connu est le ROND-TRIP — un opérateur
 * qui fait « Enregistrer sous → CSV » depuis Excel régénère un fichier sans type, et c'est
 * alors Excel qui produit le CSV, pas nous : hors de portée d'un garde côté application.
 */
describe('xlsxWriter — injection de formule (verdict MESURÉ, #173)', () => {
  const ATTAQUES = ["=cmd|'/c calc'!A1", '=1+1', '+41766778899', '-2+3', '@SUM(A1:A9)']
  const out = asUtf8(buildXlsxBytes([
    { name: 'S', headers: ['Nom'], rows: ATTAQUES.map(a => [a]) },
  ]))

  it('aucune cellule n’est émise comme FORMULE (`<f>` absent du classeur)', () => {
    expect(/<f[ >]/.test(out)).toBe(false)
  })

  it.each(ATTAQUES)('« %s » est émis en chaîne TYPÉE `inlineStr`, pas devinée', (attaque) => {
    // L'apostrophe du payload est échappée en `&apos;` par `escXml` — on compare donc sur la
    // forme réellement écrite, pas sur la chaîne d'entrée.
    const attendu = attaque.replace(/'/g, '&apos;')
    expect(out).toContain(`t="inlineStr"><is><t xml:space="preserve">${attendu}</t></is>`)
  })

  it('la donnée traverse INTACTE — pas d’apostrophe parasite ajoutée', () => {
    // Le garde CSV n'a rien à faire ici : préfixer neutraliserait une menace inexistante et
    // afficherait une apostrophe dans la cellule.
    expect(out).not.toContain(`<t xml:space="preserve">'=1+1</t>`)
  })

  it('les nombres restent des nombres (`<v>`), pas des chaînes', () => {
    const nums = asUtf8(buildXlsxBytes([{ name: 'S', headers: ['N'], rows: [[42]] }]))
    expect(nums).toContain('<v>42</v>')
  })
})
