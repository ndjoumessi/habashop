import { readFileSync } from 'fs'
import { join } from 'path'
import { clientTypeLabel } from '@/lib/clientType'

/**
 * Le mobile est lié aux MÊMES cas partagés que les jumeaux front/back (#215).
 *
 * ⚠️ Sans ce test, la table de `mobile/src/lib/clientType.ts` DÉRIVERAIT : c'est un
 * troisième exemplaire de la même connaissance, et le mobile est justement l'endroit où
 * une divergence se voit le plus tard (parc installé, OTA, runtime figé).
 *
 * ⚠️ Le mobile ne NORMALISE pas : il AFFICHE. On vérifie donc la propriété qui compte
 * pour lui — « une entrée que la règle partagée résout produit un libellé, une entrée
 * qu'elle refuse n'en produit AUCUN » — plutôt que de comparer une valeur canonique que
 * cette couche n'expose pas.
 */
const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, '../../../docs/shared-fixtures/client-type-cases.json'), 'utf8'),
) as { canonical: string[]; cases: { in: unknown; out: string | null; why: string }[] }

/** `i()` du mobile, figé en français pour rendre les libellés comparables. */
const fr = (f: string) => f

/** Libellé français attendu pour chaque valeur canonique de la fixture. */
const EXPECTED: Record<string, string> = {
  retail: 'Détail', 'semi-wholesale': 'Semi-gros', wholesale: 'Grossiste', loyal: 'Fidèle',
}

describe('clientTypeLabel — aligné sur les cas PARTAGÉS', () => {
  it('le scan couvre bien des cas (une fixture vide ne garderait rien)', () => {
    expect(FIXTURE.cases.length).toBeGreaterThan(15)
  })

  it('couvre TOUTES les valeurs canoniques de la fixture', () => {
    for (const v of FIXTURE.canonical) expect(EXPECTED[v]).toBeDefined()
    expect(Object.keys(EXPECTED).sort()).toEqual([...FIXTURE.canonical].sort())
  })

  for (const c of FIXTURE.cases) {
    const attendu = c.out === null ? 'AUCUN libellé' : `« ${EXPECTED[c.out]} »`
    it(`${JSON.stringify(c.in)} → ${attendu} — ${c.why}`, () => {
      const got = clientTypeLabel(c.in as string | null | undefined, fr)
      if (c.out === null) {
        // ⚠️ `null`, JAMAIS « Détail » : un repli implicite rendrait indistinguables
        // « client au détail » et « type jamais saisi ».
        expect(got).toBeNull()
      } else {
        expect(got).toBe(EXPECTED[c.out])
      }
    })
  }
})

describe('clientTypeLabel — traduction', () => {
  it('suit la langue passée par l’appelant', () => {
    const en = (_f: string, e: string) => e
    expect(clientTypeLabel('wholesale', en)).toBe('Wholesaler')
    expect(clientTypeLabel('Grossiste', en)).toBe('Wholesaler')
  })
})
