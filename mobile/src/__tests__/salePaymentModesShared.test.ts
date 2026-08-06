import { readFileSync } from 'fs'
import { join } from 'path'
import { PAYMENT_MODES, paymentModeLabel } from '../lib/paymentLabel'

/**
 * JUMEAU — le domaine de `Sale.paymentMode`, des deux côtés.
 *
 * Le mobile portait déjà le catalogue exhaustif (`PAYMENT_MODES`) ; le web le réénumérait
 * à la main dans `Reports.tsx`, avec un mode fantôme (`mobile`, jamais écrit par le
 * serveur) et deux modes manquants (`mtn`, `mixed`). Les deux listes ne pouvaient pas se
 * contredire bruyamment : rien ne les reliait.
 *
 * ⚠️ Ce test n'existe pas pour vérifier le mobile — il passe déjà. Il existe pour que le
 * JOUR où quelqu'un ajoute un mode d'un seul côté, l'autre côté rougisse. C'est la moitié
 * mobile du verrou ; la moitié web vit dans `apps/frontend/src/tests/paymentBreakdown.test.tsx`.
 *
 * ⚠️ Fixture lue à l'EXÉCUTION (`readFileSync`), jamais par `import` : le contexte de
 * build ne contient pas `docs/` (§ Rituel commit).
 */
const CATALOGUE = JSON.parse(
  readFileSync(join(__dirname, '../../../docs/shared-fixtures/sale-payment-modes.json'), 'utf8'),
) as { modes: string[]; labels: Record<string, Record<string, string>> }

describe('catalogue des modes de paiement — jumeau mobile', () => {
  it('la fixture est lue et porte les six modes', () => {
    // Assertion de COUVERTURE : un chemin cassé rendrait un objet vide, donc un vert creux.
    expect(CATALOGUE.modes).toHaveLength(6)
    expect(Object.keys(CATALOGUE.labels)).toHaveLength(6)
  })

  it('l’ordre ET l’ensemble sont identiques à la fixture partagée', () => {
    expect([...PAYMENT_MODES]).toEqual(CATALOGUE.modes)
  })

  it('les libellés concordent dans les quatre langues', () => {
    // ⚠️ `expect` de jest ne prend PAS de message (c'est un vitest-isme) : le contexte de
    // l'échec passe par la forme comparée, pas par un second argument silencieusement ignoré.
    const rendus = CATALOGUE.modes.flatMap(m =>
      Object.keys(CATALOGUE.labels[m]).map(lang => `${m}/${lang} = ${paymentModeLabel(m, lang)}`))
    const attendus = CATALOGUE.modes.flatMap(m =>
      Object.entries(CATALOGUE.labels[m]).map(([lang, v]) => `${m}/${lang} = ${v}`))
    expect(rendus).toEqual(attendus)
  })

  it('`mobile` n’est PAS un mode — le serveur ne l’écrit jamais', () => {
    // Mesuré le 2026-08-07 : 0 occurrence sur 1 908 ventes de production. Il était pourtant
    // rendu par le camembert web, pendant que `mtn` et `mixed`, eux, disparaissaient.
    expect(CATALOGUE.modes).not.toContain('mobile')
    // Un mode inconnu se rend tel quel, jamais fondu dans un mode connu.
    expect(paymentModeLabel('mobile', 'fr')).toBe('Mobile')
  })
})
