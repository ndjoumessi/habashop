import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { navigateMock, mockState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  mockState: { lang: 'fr', currency: 'XOF', setLang: vi.fn(), setCurrency: vi.fn() },
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))
// store : useAppStore() sans sélecteur (LandingPage) ET avec sélecteur (useI18n) ; convertAmount réel
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const useAppStore: any = vi.fn((sel?: any) => sel ? sel(mockState) : mockState)
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})

import LandingPage from '@/pages/LandingPage'

beforeEach(() => { vi.clearAllMocks() })

describe('LandingPage — test d’ancrage (comportement à figer avant/après découpe)', () => {
  it('rend le hero (titre + sous-titre) et les liens de navigation', () => {
    render(<LandingPage />)
    // H1 réparti sur plusieurs nœuds (préfixe + <span>clarté</span> + « . ») → on ancre sur le
    // mot d'accent, et le sous-titre (nœud unique) prouve le rendu du hero.
    expect(screen.getByText('clarté')).toBeInTheDocument()
    expect(screen.getByText(/une seule plateforme, même hors-ligne/)).toBeInTheDocument()
    // liens nav (présents en double : nav desktop + ancres) → getAllByText
    expect(screen.getAllByText('Fonctionnalités').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Tarifs').length).toBeGreaterThan(0)
  })

  it('le CTA hero « Démarrer gratuitement » navigue vers /signup', () => {
    render(<LandingPage />)
    fireEvent.click(screen.getAllByText('Démarrer gratuitement')[0])
    expect(navigateMock).toHaveBeenCalledWith('/signup')
  })

  it('le bouton « Connexion » navigue vers /login', () => {
    render(<LandingPage />)
    fireEvent.click(screen.getByText('Connexion'))
    expect(navigateMock).toHaveBeenCalledWith('/login')
  })

  it('affiche les prix des plans formatés en FCFA (conversion XOF)', () => {
    render(<LandingPage />)
    // Starter 14400 XOF → "14 400 FCFA" (Intl fr-FR insère un espace insécable)
    expect(screen.getByText(/14\s?400\s*FCFA/)).toBeInTheDocument()
    expect(screen.getByText('Le plus populaire')).toBeInTheDocument()
  })

  it('affiche la FAQ et le footer', () => {
    render(<LandingPage />)
    expect(screen.getByText('HabaShop fonctionne-t-il sans internet ?')).toBeInTheDocument()
    expect(screen.getByText(/Logiciel SaaS pour commerces africains/)).toBeInTheDocument()
  })

  it('le chip langue (section devises) appelle setLang', () => {
    render(<LandingPage />)
    // chips langue : Español dans la section devises
    fireEvent.click(screen.getByText('Español'))
    expect(mockState.setLang).toHaveBeenCalledWith('es')
  })
})
