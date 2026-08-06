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

  /**
   * ⚠️ CE TEST FIGEAIT LE DÉFAUT. Il exigeait « Remplissez tous les champs » — c'est-à-dire
   * un bouton DÉSACTIVÉ, gris, qui gronde avant toute erreur et ne dit pas CE QUI manque
   * (et n'affiche aucune infobulle au toucher). Le bouton est désormais toujours actif,
   * porte un libellé invariable, et NOMME les champs manquants au clic.
   */
  it('le bouton Continuer est TOUJOURS actif et nomme ce qui manque', () => {
    render(<SignupPage />)
    const next = screen.getByRole('button', { name: /Continuer/ })
    expect(next).toBeEnabled()
    expect(screen.queryByText('Remplissez tous les champs')).not.toBeInTheDocument()

    // Clic à vide : on reste à l'étape 1, et les champs manquants sont énoncés.
    fireEvent.click(next)
    expect(screen.getByText(/Il manque encore/)).toBeInTheDocument()
    expect(screen.queryByText('Sécurisez votre compte')).not.toBeInTheDocument()
  })

  it('étape 1 valide → le clic fait avancer', () => {
    render(<SignupPage />)
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }))
    expect(screen.getByText('Sécurisez votre compte')).toBeInTheDocument()
  })

  it('la mention sur le paiement non actif est visible AVANT la soumission', () => {
    // Un visiteur arrivé par un lien direct vers /signup ne voit jamais la page tarifs.
    const { container } = render(<SignupPage />)
    expect(container.textContent).toMatch(/paiement en ligne n'est pas encore actif|paiement en ligne n’est pas encore actif/)
  })

  it('étape 2 : indique la non-correspondance puis la correspondance des mots de passe', () => {
    render(<SignupPage />)
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }))
    fireEvent.change(screen.getByPlaceholderText('8 caractères minimum'), { target: { value: 'secret12' } })
    fireEvent.change(screen.getByPlaceholderText('Répétez le mot de passe'), { target: { value: 'different' } })
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Répétez le mot de passe'), { target: { value: 'secret12' } })
    expect(screen.getByText('Les mots de passe correspondent')).toBeInTheDocument()
  })

  it('soumission valide → register puis navigate(/onboarding)', async () => {
    render(<SignupPage />)
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }))
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
