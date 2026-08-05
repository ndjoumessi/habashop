import { describe, it, expect } from 'vitest'
import { mapApiCustomer, clientTypeToLabel, clientTypeToValue } from '@/components/customers/customersShared'

/**
 * Traversée du palier client à l'écran (#215).
 *
 * `mapApiCustomer` ne reconnaissait QUE l'anglais et repliait tout le reste sur « Détail ».
 * Comme les deux formulaires envoyaient le libellé français, la base s'est remplie de
 * valeurs que le lecteur ne comprenait pas : 3 grossistes et 2 semi-gros affichés
 * « Détail » en production.
 */

describe('mapApiCustomer — le palier survit à l’aller-retour', () => {
  it('enum canonique du serveur → clé d’affichage', () => {
    expect(mapApiCustomer({ id: 'c', name: 'X', type: 'wholesale' }).type).toBe('Grossiste')
    expect(mapApiCustomer({ id: 'c', name: 'X', type: 'semi-wholesale' }).type).toBe('Semi-gros')
    expect(mapApiCustomer({ id: 'c', name: 'X', type: 'loyal' }).type).toBe('Fidèle')
    expect(mapApiCustomer({ id: 'c', name: 'X', type: 'retail' }).type).toBe('Détail')
  })

  it('⚠️ libellé HÉRITÉ en base → le bon palier, plus « Détail » pour tout le monde', () => {
    // Les 9 lignes de prod sont dans ce format ; sans ce cas, elles resteraient fausses.
    expect(mapApiCustomer({ id: 'c', name: 'X', type: 'Grossiste' }).type).toBe('Grossiste')
    expect(mapApiCustomer({ id: 'c', name: 'X', type: 'Semi-gros' }).type).toBe('Semi-gros')
    expect(mapApiCustomer({ id: 'c', name: 'X', type: 'Fidèle' }).type).toBe('Fidèle')
  })

  it('valeur inconnue ou absente → « Détail », le défaut de la colonne', () => {
    expect(mapApiCustomer({ id: 'c', name: 'X', type: 'n’importe quoi' }).type).toBe('Détail')
    expect(mapApiCustomer({ id: 'c', name: 'X' }).type).toBe('Détail')
  })
})

describe('clientTypeToValue — ce que les formulaires envoient', () => {
  it('convertit la clé d’écran en enum serveur', () => {
    expect(clientTypeToValue('Grossiste')).toBe('wholesale')
    expect(clientTypeToValue('Semi-gros')).toBe('semi-wholesale')
    expect(clientTypeToValue('Fidèle')).toBe('loyal')
    expect(clientTypeToValue('Détail')).toBe('retail')
  })

  it('⚠️ aller-retour STABLE : ce qu’on écrit se relit à l’identique', () => {
    // C'est la propriété qui manquait — l'écriture et la lecture parlaient deux langues.
    for (const label of ['Grossiste', 'Semi-gros', 'Fidèle', 'Détail'] as const) {
      const written = clientTypeToValue(label)
      expect(mapApiCustomer({ id: 'c', name: 'X', type: written }).type).toBe(label)
    }
  })

  it('clientTypeToLabel est l’inverse exact', () => {
    for (const v of ['wholesale', 'semi-wholesale', 'loyal', 'retail'] as const) {
      expect(clientTypeToValue(clientTypeToLabel(v))).toBe(v)
    }
  })
})
