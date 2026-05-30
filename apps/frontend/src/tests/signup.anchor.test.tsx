import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { navigateMock, registerMock, mockState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  registerMock: vi.fn().mockResolvedValue({}),
  mockState: { lang: 'fr' },
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ register: registerMock }) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
// PhoneInput lourd (picker pays) → stub simple
vi.mock('@/components/ui/PhoneInputWithCountry', () => ({ default: (p: any) => <input aria-label="phone" value={p.value} onChange={e => p.onChange(e.target.value)} /> }))
// store : useAppStore() sans sélecteur (SignupPage) ET avec sélecteur (useI18n)
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const useAppStore: any = vi.fn((sel?: any) => sel ? sel(mockState) : mockState)
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})

import SignupPage from '@/pages/SignupPage'

beforeEach(() => { vi.clearAllMocks() })

// Remplit l'étape 1 avec des valeurs valides
function fillStep1() {
  fireEvent.change(screen.getByPlaceholderText('Ex: Boutique Aminata'), { target: { value: 'Boutique Test' } })
  fireEvent.change(screen.getByPlaceholderText('Ex: Aminata Koné'), { target: { value: 'Aminata Koné' } })
  fireEvent.change(screen.getByPlaceholderText('vous@exemple.com'), { target: { value: 'a@example.com' } })
  fireEvent.change(screen.getByLabelText('phone'), { target: { value: '+221770000000' } })
}

describe('SignupPage — test d’ancrage (comportement à figer avant/après découpe)', () => {
  it('rend le branding + l’étape 1 (Votre boutique)', () => {
    render(<SignupPage />)
    expect(screen.getByText('Votre boutique')).toBeInTheDocument()
    expect(screen.getAllByText('HabaShop').length).toBeGreaterThan(0)
  })

  it('le lien « Se connecter » navigue vers /login', () => {
    render(<SignupPage />)
    fireEvent.click(screen.getByText('Se connecter'))
    expect(navigateMock).toHaveBeenCalledWith('/login')
  })

  it('le bouton Continuer est désactivé tant que l’étape 1 est invalide, puis passe à l’étape 2', () => {
    render(<SignupPage />)
    expect(screen.getByText('Remplissez tous les champs')).toBeInTheDocument()
    fillStep1()
    const next = screen.getByText('Continuer')
    fireEvent.click(next)
    expect(screen.getByText('Sécurisez votre compte')).toBeInTheDocument()
  })

  it('étape 2 : indique la non-correspondance puis la correspondance des mots de passe', () => {
    render(<SignupPage />)
    fillStep1()
    fireEvent.click(screen.getByText('Continuer'))
    fireEvent.change(screen.getByPlaceholderText('8 caractères minimum'), { target: { value: 'secret12' } })
    fireEvent.change(screen.getByPlaceholderText('Répétez le mot de passe'), { target: { value: 'different' } })
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Répétez le mot de passe'), { target: { value: 'secret12' } })
    expect(screen.getByText('Les mots de passe correspondent')).toBeInTheDocument()
  })

  it('soumission valide → register puis navigate(/onboarding)', async () => {
    render(<SignupPage />)
    fillStep1()
    fireEvent.click(screen.getByText('Continuer'))
    fireEvent.change(screen.getByPlaceholderText('8 caractères minimum'), { target: { value: 'secret12' } })
    fireEvent.change(screen.getByPlaceholderText('Répétez le mot de passe'), { target: { value: 'secret12' } })
    // accepter les CGU (la checkbox est masquée → cliquer le label)
    fireEvent.click(screen.getByText('Conditions Générales').closest('label')!)
    fireEvent.click(screen.getByText('Créer mon compte HabaShop'))
    await waitFor(() => expect(registerMock).toHaveBeenCalled())
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/onboarding'))
  })

  it('le sélecteur de pays s’ouvre et filtre par recherche', () => {
    render(<SignupPage />)
    // ouvre le dropdown pays (bouton affichant le pays sélectionné par défaut, Sénégal)
    fireEvent.click(screen.getByText('Sénégal'))
    const search = screen.getByPlaceholderText('Rechercher un pays…')
    fireEvent.change(search, { target: { value: 'Mali' } })
    expect(screen.getByText('Mali')).toBeInTheDocument()
    expect(screen.queryByText('Burkina Faso')).not.toBeInTheDocument()
  })
})
