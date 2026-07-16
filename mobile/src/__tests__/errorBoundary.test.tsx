import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import { View, Text } from 'react-native'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

// Composant qui plante au rendu (simule un crash d'écran).
const Boom = (): React.ReactElement => { throw new Error('screen crash') }

describe('ErrorBoundary — isolation d’un crash d’écran', () => {
  it('affiche le fallback ET laisse vivre le reste de l’arbre (≠ crash global)', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    let tree: any
    act(() => {
      tree = TestRenderer.create(
        <View>
          <Text>SAFE_SIBLING</Text>
          <ErrorBoundary><Boom /></ErrorBoundary>
        </View>,
      )
    })
    const json = JSON.stringify(tree.toJSON())
    // Le frère hors-boundary survit → le crash est ISOLÉ au sous-arbre du boundary.
    expect(json).toContain('SAFE_SIBLING')
    // Le fallback d'erreur est rendu à la place du composant planté.
    expect(json).toMatch(/erreur est survenue|something went wrong/i)
    spy.mockRestore()
  })

  it('rend normalement les enfants quand aucune erreur', () => {
    let tree: any
    act(() => {
      tree = TestRenderer.create(
        <ErrorBoundary><Text>OK_CONTENT</Text></ErrorBoundary>,
      )
    })
    const json = JSON.stringify(tree.toJSON())
    expect(json).toContain('OK_CONTENT')
    expect(json).not.toMatch(/erreur est survenue/i)
  })
})
