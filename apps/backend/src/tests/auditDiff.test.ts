import { describe, it, expect } from 'vitest'
import { diffAudite, descriptionAudit } from '../lib/auditDiff'

/**
 * LE DIFF D'AUDIT — la RÈGLE. Le câblage est jugé par `auditSurfaces.test.ts` :
 * un invariant pur ne dit rien de qui l'appelle, ni de ce qu'il lui passe.
 */

describe('diffAudite — ce qui a changé, et rien d’autre', () => {
  it('ne retient QUE les champs de la liste blanche', () => {
    // ⚠️ Écrire le corps entier ferait entrer dans la table d'audit tout ce qu'un
    // futur appelant y mettrait. La liste est un paramètre obligatoire pour que le
    // compilateur force le choix, comme `owner` sur `sendWhatsApp`.
    const d = diffAudite(
      { sellPrice: 1000, notes: 'ancienne note' },
      { sellPrice: 1200, notes: 'avance Awa Diop — 0771234567' },
      ['sellPrice'],
    )
    expect(d).toEqual({ sellPrice: { avant: 1000, apres: 1200 } })
    expect(JSON.stringify(d)).not.toContain('Awa')
    expect(JSON.stringify(d)).not.toContain('0771234567')
  })

  it('⚠️ RIEN N’A CHANGÉ ⇒ `null`, jamais un objet vide', () => {
    // Le journal plafonne à 100 lignes : une entrée par enregistrement, même sans
    // changement, y chasse littéralement le signal. Et `null` ne peut pas être
    // confondu par l'appelant avec « un changement sans détail ».
    expect(diffAudite({ a: 1 }, { a: 1 }, ['a'])).toBeNull()
    expect(diffAudite({ a: 1 }, {}, ['a'])).toBeNull()
    expect(diffAudite({ a: 1 }, { b: 2 }, ['a'])).toBeNull()
  })

  it('⚠️ un champ ABSENT du corps n’a pas changé — il n’a pas été soumis', () => {
    // Le confondre avec « mis à undefined » ferait consigner la disparition de tout
    // ce qu'un PATCH partiel ne mentionne pas.
    const d = diffAudite({ a: 1, b: 2 }, { a: 9 }, ['a', 'b'])
    expect(d).toEqual({ a: { avant: 1, apres: 9 } })
    expect(d && 'b' in d).toBe(false)
  })

  it('⚠️ NE CONSIGNE PAS un changement qui n’en est pas un — les deux côtés ne viennent pas de la même source', () => {
    // `avant` sort de Prisma (nombre, Date, null) ; `apres` peut sortir d'un
    // formulaire (chaîne, ''). Sans normalisation on écrirait « taxRate 18 → 18 »
    // à CHAQUE enregistrement : une entrée qui affirme un changement qui n'a pas eu
    // lieu est pire qu'une entrée absente, parce qu'on la croit.
    expect(diffAudite({ taxRate: 18 }, { taxRate: '18' }, ['taxRate'])).toBeNull()
    expect(diffAudite({ taxRate: 18 }, { taxRate: '18.0' }, ['taxRate'])).toBeNull()
    expect(diffAudite({ actif: true }, { actif: 'true' }, ['actif'])).toBeNull()
    expect(diffAudite({ note: null }, { note: '' }, ['note'])).toBeNull()
    expect(diffAudite({ note: undefined }, { note: null }, ['note'])).toBeNull()
    const d = new Date('2026-08-14T00:00:00.000Z')
    expect(diffAudite({ fin: d }, { fin: '2026-08-14T00:00:00.000Z' }, ['fin'])).toBeNull()
    expect(diffAudite({ fin: d }, { fin: '2026-08-14' }, ['fin'])).toBeNull()
  })

  it('DISCRIMINANT — il consigne bien les VRAIS changements, y compris les vidages', () => {
    // ⚠️ Sans ce cas, une normalisation trop large (« tout est égal ») passerait les
    // quatre assertions ci-dessus en ne gardant plus rien du tout.
    expect(diffAudite({ taxRate: 18 }, { taxRate: 19.25 }, ['taxRate']))
      .toEqual({ taxRate: { avant: 18, apres: 19.25 } })
    expect(diffAudite({ actif: true }, { actif: false }, ['actif']))
      .toEqual({ actif: { avant: true, apres: false } })
    // Vider un champ QUI AVAIT une valeur est un changement — l'écran le rend « → — ».
    // ⚠️ La valeur VIDE est conservée telle quelle (`''`), pas convertie en `null` :
    // on consigne ce qui a été écrit, et `parseDescription` traite déjà `''`, `null`
    // et `undefined` comme la même absence à l'affichage. Le `?? null` du module ne
    // sert qu'à faire SURVIVRE `undefined` à `JSON.stringify`, qui le supprimerait —
    // et un `avant` disparu ferait lire un changement comme une création.
    expect(diffAudite({ note: 'x' }, { note: '' }, ['note']))
      .toEqual({ note: { avant: 'x', apres: '' } })
    expect(diffAudite({ fin: new Date('2026-08-14') }, { fin: '2026-09-01' }, ['fin']))
      .not.toBeNull()
    // Une création (aucun état avant) consigne tout ce qui est soumis.
    expect(diffAudite(null, { a: 5 }, ['a'])).toEqual({ a: { avant: null, apres: 5 } })
  })

  it('⚠️ `0` et `false` ne sont PAS des absences', () => {
    // Le piège classique du `||` : un stock ramené à 0, ou une promo désactivée, sont
    // exactement les changements qu'on veut voir.
    expect(diffAudite({ stockQty: 12 }, { stockQty: 0 }, ['stockQty']))
      .toEqual({ stockQty: { avant: 12, apres: 0 } })
    expect(diffAudite({ stockQty: 0 }, { stockQty: 12 }, ['stockQty']))
      .toEqual({ stockQty: { avant: 0, apres: 12 } })
    expect(diffAudite({ promo: false }, { promo: false }, ['promo'])).toBeNull()
  })
})

describe('descriptionAudit — le sujet accompagne le changement', () => {
  it('rend une forme que l’écran sait lire', () => {
    const s = descriptionAudit('Riz local 5kg', { sellPrice: { avant: 1000, apres: 1200 } })
    expect(JSON.parse(s)).toEqual({ name: 'Riz local 5kg', sellPrice: { avant: 1000, apres: 1200 } })
  })

  it('un sujet SEUL, ou un changement SEUL, restent valides', () => {
    expect(JSON.parse(descriptionAudit('Riz', null))).toEqual({ name: 'Riz' })
    expect(JSON.parse(descriptionAudit(null, { a: { avant: 1, apres: 2 } })))
      .toEqual({ a: { avant: 1, apres: 2 } })
    expect(descriptionAudit(null, null)).toBe('{}')
  })
})
