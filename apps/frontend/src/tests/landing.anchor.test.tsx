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
    // H1 réparti sur plusieurs nœuds (préfixe + <span>accent</span> + « . ») → on ancre sur le
    // mot d'accent, et le sous-titre (nœud unique) prouve le rendu du hero.
    // ⚠️ L'accroche hors-ligne A ÉTÉ PROMUE de la page de connexion au H1 de la vitrine
    // (2026-08) : c'est le seul argument qu'un concurrent ne copie pas en un sprint.
    expect(screen.getByText("réseau s'arrête")).toBeInTheDocument()
    expect(screen.getByText(/rejoue à la reconnexion/)).toBeInTheDocument()
    // liens nav (présents en double : nav desktop + ancres) → getAllByText
    expect(screen.getAllByText('Fonctionnalités').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Tarifs').length).toBeGreaterThan(0)
  })

  it('le CTA hero « Créer ma boutique » navigue vers /signup', () => {
    render(<LandingPage />)
    fireEvent.click(screen.getAllByText('Créer ma boutique')[0])
    expect(navigateMock).toHaveBeenCalledWith('/signup')
  })

  it('le bouton « Connexion » navigue vers /login', () => {
    render(<LandingPage />)
    fireEvent.click(screen.getByText('Connexion'))
    expect(navigateMock).toHaveBeenCalledWith('/login')
  })

  it('affiche les prix en FCFA, avec l’euro à la parité FIXE et sans « ≈ »', () => {
    render(<LandingPage />)
    // ⚠️ Le prix ne suit PLUS le sélecteur de devise : ces montants sont TARIFÉS en franc
    // CFA (même règle que la console plateforme, #165). Intl fr-FR insère une espace
    // insécable étroite dans les milliers, d'où le \s? des motifs.
    // getAllBy : les montants apparaissent AUSSI dans la réponse FAQ « Combien coûte… ».
    expect(screen.getAllByText(/8\s?000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/25\s?000/).length).toBeGreaterThan(0)
    // 8000 / 655,957 = 12,1959… → 12,20 ; 25000 / 655,957 = 38,1122… → 38,11
    expect(screen.getByText(/par mois · 12,20 €/)).toBeInTheDocument()
    expect(screen.getByText(/par mois · 38,11 €/)).toBeInTheDocument()
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument()
    // « Le plus populaire » (fait invérifiable) → « Recommandé » (avis qu'on a le droit d'émettre)
    expect(screen.getByText('Recommandé')).toBeInTheDocument()
    expect(screen.queryByText(/plus populaire/i)).not.toBeInTheDocument()
  })

  it('ne rend plus les sections retirées (témoignages, compteurs, bandeau pays)', () => {
    render(<LandingPage />)
    for (const gone of ['Mamadou Diallo', 'Fatou Koné', 'Ibrahim Touré']) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument()
    }
    expect(screen.queryByText(/500\+/)).not.toBeInTheDocument()
    expect(screen.queryByText(/4,9\/5/)).not.toBeInTheDocument()
    expect(screen.queryByText(/autres pays/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/SLA/)).not.toBeInTheDocument()
  })

  it('affiche la FAQ et le footer', () => {
    render(<LandingPage />)
    expect(screen.getByText('La caisse fonctionne-t-elle sans internet ?')).toBeInTheDocument()
    // Année CALCULÉE (lib/publicYear) — il y avait six littéraux « 2026 » sur les surfaces publiques.
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} HabaShop`))).toBeInTheDocument()
  })

  it('le chip langue (section devises) appelle setLang', () => {
    render(<LandingPage />)
    // chips langue : Español dans la section devises
    fireEvent.click(screen.getByText('Español'))
    expect(mockState.setLang).toHaveBeenCalledWith('es')
  })
})
