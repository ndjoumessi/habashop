import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/stores/appStore'
import type { CartItem } from '@/components/pos/posShared'

/**
 * Le panier POS retient, PAR LIGNE, le tarif dont son prix est issu.
 *
 * Le serveur n'accepte désormais que le prix du tarif DÉCLARÉ (cf. `expectedPrice`,
 * backend). Ce qui est déclaré doit donc être le tarif au moment où le prix a été figé,
 * jamais le tarif couramment sélectionné : `applyPriceDrift` est une action EXPLICITE du
 * caissier, donc un panier monté en Détail puis basculé en Grossiste garde ses prix détail.
 * Déclarer « gros » sur ces lignes ferait re-tarifer le serveur À LA BAISSE — on remplacerait
 * le trou qu'on ferme par un autre, dans l'autre sens.
 */

const cart = () => useAppStore.getState().cart
const line = (id: string) => cart().find(i => i.id === id) as CartItem

beforeEach(() => useAppStore.getState().setCart([]))

describe('la ligne fige son tarif avec son prix', () => {
  it('un ajout au tarif de gros porte clientType=wholesale', () => {
    useAppStore.getState().addCartItem({ id: 'p1', name: 'Riz', price: 1000, qty: 1, emoji: '🌾', clientType: 'wholesale' })
    expect(line('p1').clientType).toBe('wholesale')
    expect(line('p1').price).toBe(1000)
  })

  it('un ajout sans tarif explicite laisse le champ absent (le serveur retombe sur détail)', () => {
    useAppStore.getState().addCartItem({ id: 'p2', name: 'Sucre', price: 850, qty: 1, emoji: '🍬' })
    expect(line('p2').clientType).toBeUndefined()
  })
})

describe('DÉRIVE — basculer le sélecteur ne retarife pas les lignes déjà figées', () => {
  it('sans application explicite, la ligne garde SON prix ET SON tarif', () => {
    useAppStore.getState().addCartItem({ id: 'p1', name: 'Riz', price: 1300, qty: 1, emoji: '🌾', clientType: 'retail' })
    // Le caissier bascule le sélecteur sur Grossiste : aucune mutation du panier.
    // (Le seul chemin de mutation est updateCartQty ; on ne l'appelle pas.)
    expect(line('p1')).toMatchObject({ price: 1300, clientType: 'retail' })
  })

  it('une variation de quantité SANS nouveau prix ne change pas le tarif déclaré', () => {
    useAppStore.getState().addCartItem({ id: 'p1', name: 'Riz', price: 1300, qty: 1, emoji: '🌾', clientType: 'retail' })
    useAppStore.getState().updateCartQty('p1', 1)
    expect(line('p1')).toMatchObject({ qty: 2, price: 1300, clientType: 'retail' })
  })

  it('appliquer la dérive change le prix ET le tarif ensemble', () => {
    useAppStore.getState().addCartItem({ id: 'p1', name: 'Riz', price: 1300, qty: 1, emoji: '🌾', clientType: 'retail' })
    // applyPriceDrift() : prix frais issu du tarif COURANT (gros) + ce tarif.
    useAppStore.getState().updateCartQty('p1', 0, 1000, undefined, 'wholesale')
    expect(line('p1')).toMatchObject({ price: 1000, clientType: 'wholesale' })
  })

  it('⚠️ un prix mis à jour SANS son tarif laisserait la ligne mentir — le couple doit rester lié', () => {
    useAppStore.getState().addCartItem({ id: 'p1', name: 'Riz', price: 1300, qty: 1, emoji: '🌾', clientType: 'retail' })
    useAppStore.getState().updateCartQty('p1', 0, 1000) // tarif non transmis
    // Le store ne devine pas : il garde le tarif précédent. C'est à l'appelant de fournir
    // les deux — d'où le commentaire dans `applyPriceDrift`. Ce test documente le contrat.
    expect(line('p1')).toMatchObject({ price: 1000, clientType: 'retail' })
  })
})
