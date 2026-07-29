import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportCSV, exportAccountingExcel } from '@/utils/export'

/**
 * ⚠️ INJECTION CSV — preuve COMPORTEMENTALE sur `exportCSV` (#173).
 *
 * `csvInjection.test.ts` est un méta-test : il vérifie que chaque producteur MENTIONNE
 * `sanitizeCsv`. Ça ne suffit pas, et c'est MESURÉ : en retirant l'appel du helper tout en
 * gardant l'import, la suite restait VERTE. Le méta-test prouve la SOURCE, pas l'APPLICATION.
 *
 * `exportCSV` est le point de passage de DIX écrans (stock, clients, dépenses, paie, RH,
 * commandes, fournisseurs, rapports, activité, comptabilité) : une régression ici les expose
 * tous d'un coup. On capture donc le contenu réellement écrit dans le Blob.
 */

let capture: string[]

beforeEach(() => {
  capture = []
  // On intercepte le contenu passé au Blob — c'est l'octet exact qui part dans le fichier.
  vi.stubGlobal('Blob', class {
    constructor(parts: string[]) { capture.push(parts.join('')) }
  })
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} })
  // `exportCSV` crée un <a> et le clique : on neutralise le clic, pas le reste.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const ATTAQUE = "=cmd|'/c calc'!A1"

describe('exportCSV — le fichier écrit est neutralisé', () => {
  it('le harnais capture bien le contenu (sinon tout ce bloc serait vert pour rien)', () => {
    exportCSV('t', ['A'], [['ordinaire']])
    expect(capture).toHaveLength(1)
    expect(capture[0]).toContain('ordinaire')
  })

  it('une cellule en FORMULE sort préfixée d’une apostrophe', () => {
    exportCSV('t', ['Nom'], [[ATTAQUE]])
    expect(capture[0]).toContain(`'${ATTAQUE}`)
    // …et jamais la formule nue juste après un guillemet ouvrant de cellule.
    expect(capture[0]).not.toContain(`"${ATTAQUE}`)
  })

  it.each([['=1+1'], ['+41766778899'], ['-2+3'], ['@SUM(A1:A9)']])(
    'déclencheur %s neutralisé', (valeur) => {
      exportCSV('t', ['Nom'], [[valeur]])
      expect(capture[0]).toContain(`'${valeur}`)
    },
  )

  it('une valeur ORDINAIRE traverse intacte — le garde n’abîme pas les données', () => {
    exportCSV('t', ['Nom'], [['Riz parfumé 5kg'], ['Awa Diop'], ['Prix = 500']])
    expect(capture[0]).toContain('Riz parfumé 5kg')
    expect(capture[0]).not.toContain("'Riz")
    expect(capture[0]).not.toContain("'Awa")
    // `=` NON initial : rien à neutraliser.
    expect(capture[0]).toContain('Prix = 500')
    expect(capture[0]).not.toContain("'Prix")
  })

  it('l’échappement des guillemets reste appliqué APRÈS le garde', () => {
    // Les deux protections sont orthogonales : l'une contre la formule, l'autre contre la
    // rupture de cellule. Elles doivent coexister, dans cet ordre.
    exportCSV('t', ['Nom'], [['="a";"b"']])
    const cellule = capture[0].split('\r\n')[1]
    // Sortie reelle MESUREE : apostrophe en tete (formule neutralisee) ET guillemets
    // internes doubles (cellule non rompue). Les deux protections, dans cet ordre.
    expect(cellule.startsWith(`"'=`)).toBe(true)
    expect(cellule).toContain('""a""')
    expect(cellule).toContain('""b""')
  })
})

/**
 * ⚠️ LE SECOND PRODUCTEUR DU MÊME FICHIER (#173).
 *
 * `exportAccountingExcel` porte « Excel » dans son nom mais écrit un `text/csv` — c'est ce
 * qui l'a fait passer sous le radar : le méta-test raisonnait par FICHIER, `utils/export.ts`
 * contenait déjà `sanitizeCsv` pour `exportCSV`, donc le fichier était réputé propre. Le
 * libellé de dépense, saisi librement par le commerçant, partait pourtant nu.
 *
 * On exerce donc le CSV réellement écrit, pas la mention du garde dans la source.
 */
describe('exportAccountingExcel — le CSV comptable est neutralisé lui aussi', () => {
  const depense = (label: string, category = 'Loyer') => ({
    date: '2026-07-01', label, category,
    amount: 100000, vat: 18, amountTTC: 118000, mode: 'cash', status: 'Payé',
  })
  const params = { sales: [], period: 'Juillet 2026', shopName: 'HabaShop', currency: 'XOF', lang: 'fr' }

  it('un LIBELLÉ de dépense en formule sort préfixé d’une apostrophe', () => {
    exportAccountingExcel({ ...params, expenses: [depense(ATTAQUE)] })
    expect(capture[0]).toContain(`'${ATTAQUE}`)
    // …et jamais la formule nue juste après le guillemet ouvrant de la cellule.
    expect(capture[0]).not.toContain(`"${ATTAQUE}`)
  })

  it.each([['=1+1'], ['+41766778899'], ['-2+3'], ['@SUM(A1:A9)']])(
    'déclencheur %s neutralisé dans le libellé', (valeur) => {
      exportAccountingExcel({ ...params, expenses: [depense(valeur)] })
      expect(capture[0]).toContain(`'${valeur}`)
    },
  )

  it('la CATÉGORIE aussi (second champ libre de la même ligne)', () => {
    exportAccountingExcel({ ...params, expenses: [depense('Loyer', '=1+1')] })
    expect(capture[0]).toContain("'=1+1")
  })

  it('une dépense ORDINAIRE traverse intacte — le garde n’abîme pas la compta', () => {
    exportAccountingExcel({ ...params, expenses: [depense('Loyer boutique', 'Charges')] })
    expect(capture[0]).toContain('Loyer boutique')
    expect(capture[0]).not.toContain("'Loyer")
    expect(capture[0]).not.toContain("'Charges")
  })
})
