import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * Page de connexion — test d'ancrage.
 *
 * Fige le résultat de la refonte : formulaire héros, un seul CTA (désactivé tant que
 * les champs sont vides), erreur INLINE annoncée, et l'absence des trois éléments
 * retirés — la fausse preuve sociale « 150+ pays », les badges SSL/TLS, et le
 * raccourci de connexion par rôle (qui ne doit apparaître qu'en démo).
 */

const { navigateMock, mockState, authState, loginMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  loginMock: vi.fn(),
  mockState: { lang: 'fr', currency: 'XOF' },
  authState: { user: { role: 'ADMIN' }, tenants: [{ id: 't1' }], activeTenantId: 't1' },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  Link: ({ children, to, ...rest }: any) => <a href={to} {...rest}>{children}</a>,
}))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const useAppStore: any = vi.fn((sel?: any) => sel ? sel(mockState) : mockState)
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})
vi.mock('@/stores/authStore', () => {
  const useAuthStore: any = vi.fn(() => ({ login: loginMock, clearError: vi.fn() }))
  useAuthStore.getState = () => authState
  return { useAuthStore, landingFor: () => '/app/dashboard' }
})

import LoginPage from '@/pages/LoginPage'

const submit = () => screen.getByTestId('login-submit')
const emailField = () => screen.getByTestId('login-email')
const pwdField = () => screen.getByTestId('login-password')

beforeEach(() => {
  vi.clearAllMocks()
  loginMock.mockResolvedValue(undefined)
})

describe('LoginPage — formulaire héros', () => {
  it('rend les trois champs ancrés par les E2E', () => {
    render(<LoginPage />)
    expect(emailField()).toBeInTheDocument()
    expect(pwdField()).toBeInTheDocument()
    expect(submit()).toBeInTheDocument()
  })

  it('le CTA est désactivé tant qu’un champ est vide, puis actif', () => {
    render(<LoginPage />)
    expect(submit()).toBeDisabled()

    fireEvent.change(emailField(), { target: { value: 'a@b.com' } })
    expect(submit()).toBeDisabled() // mot de passe encore vide

    fireEvent.change(pwdField(), { target: { value: 'secret12' } })
    expect(submit()).toBeEnabled()
  })

  it('un seul bouton de soumission — pas de CTA concurrent', () => {
    render(<LoginPage />)
    expect(screen.getAllByRole('button').filter(b => b.getAttribute('type') === 'submit')).toHaveLength(1)
  })

  it('libellés liés aux champs (a11y)', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/Adresse e-mail/i)).toBe(emailField())
    expect(screen.getByLabelText(/^Mot de passe$/i)).toBe(pwdField())
  })

  it('le bouton afficher/masquer bascule le type du champ', () => {
    render(<LoginPage />)
    expect(pwdField()).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByLabelText(/Afficher le mot de passe/i))
    expect(pwdField()).toHaveAttribute('type', 'text')
  })
})

describe('LoginPage — erreur de connexion', () => {
  it('affiche l’erreur INLINE dans une région annoncée, et rend le focus à l’e-mail', async () => {
    loginMock.mockRejectedValue(new Error('Identifiants invalides'))
    render(<LoginPage />)
    fireEvent.change(emailField(), { target: { value: 'a@b.com' } })
    fireEvent.change(pwdField(), { target: { value: 'mauvais' } })
    fireEvent.click(submit())

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Identifiants invalides')
    expect(emailField()).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(document.activeElement).toBe(emailField()))
  })

  it('l’erreur disparaît dès que l’utilisateur corrige un champ', async () => {
    loginMock.mockRejectedValue(new Error('Identifiants invalides'))
    render(<LoginPage />)
    fireEvent.change(emailField(), { target: { value: 'a@b.com' } })
    fireEvent.change(pwdField(), { target: { value: 'x' } })
    fireEvent.click(submit())
    await screen.findByText('Identifiants invalides')

    fireEvent.change(pwdField(), { target: { value: 'xy' } })
    expect(screen.queryByText('Identifiants invalides')).not.toBeInTheDocument()
  })
})

describe('LoginPage — corrections de contenu (ne doivent PAS réapparaître)', () => {
  it('aucune revendication « 150+ pays »', () => {
    const { container } = render(<LoginPage />)
    expect(container.textContent).not.toMatch(/150\s*\+/)
    expect(container.textContent).not.toMatch(/pays/i)
  })

  it('aucun badge ni mention SSL/TLS', () => {
    const { container } = render(<LoginPage />)
    expect(container.textContent).not.toMatch(/SSL|TLS/i)
  })

  it('aucune liste de fonctionnalités génériques', () => {
    const { container } = render(<LoginPage />)
    expect(container.textContent).not.toMatch(/Point de vente tactile|Gestion stock en temps réel|CRM clients/i)
  })

  it('le raccourci « connexion par rôle » est absent hors démo', () => {
    render(<LoginPage />)
    expect(screen.queryByTestId('demo-admin')).not.toBeInTheDocument()
    expect(screen.queryByTestId('demo-cashier')).not.toBeInTheDocument()
    expect(screen.queryByText(/Connexion instantanée par rôle/i)).not.toBeInTheDocument()
  })

  it('la version affichée vient de la source unique (pas de littéral « v2.0 »)', () => {
    const { container } = render(<LoginPage />)
    expect(container.textContent).toContain(`v${__APP_VERSION__}`)
    expect(container.textContent).not.toContain('v2.0 ·')
  })

  it('garde l’accroche vraie et les capacités factuelles', () => {
    render(<LoginPage />)
    expect(screen.getByText(/réseau s'arrête|réseau s’arrête/)).toBeInTheDocument()
    expect(screen.getByText(/Wave · Orange Money · MTN MoMo · PayDunya/)).toBeInTheDocument()
  })
})

describe('LoginPage — sortie de la page', () => {
  it('propose un retour à l’accueil (pas de cul-de-sac)', () => {
    render(<LoginPage />)
    const back = screen.getAllByRole('link').filter(a => a.getAttribute('href') === '/')
    expect(back.length).toBeGreaterThan(0)
  })
})
