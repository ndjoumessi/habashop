import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// ── Mocks réseau (fixtures déterministes ; hoisted pour les factories vi.mock) ──
const { USERS } = vi.hoisted(() => ({
  USERS: [
    { id: 'u1', name: 'Alice Admin',   email: 'alice@x.com', role: 'ADMIN',   isActive: true,  twoFAEnabled: true,  lastLoginAt: '', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'u2', name: 'Bob Caissier',  email: 'bob@x.com',   role: 'CASHIER', isActive: true,  twoFAEnabled: false, lastLoginAt: '', createdAt: '2026-02-01T00:00:00Z' },
    { id: 'u3', name: 'Carol Gérante', email: 'carol@x.com', role: 'MANAGER', isActive: false, twoFAEnabled: false, lastLoginAt: '', createdAt: '2026-03-01T00:00:00Z' },
  ],
}))
vi.mock('@/lib/api', () => ({
  usersApi: {
    list:         vi.fn().mockResolvedValue(USERS),
    invite:       vi.fn().mockResolvedValue({ id: 'u4', name: 'Dan Nouveau', email: 'dan@x.com', role: 'HR', isActive: true, twoFAEnabled: false, createdAt: '2026-05-01T00:00:00Z' }),
    update:       vi.fn().mockImplementation((_id, body) => Promise.resolve({ id: 'u1', ...body, isActive: true, twoFAEnabled: true })),
    toggleActive: vi.fn().mockResolvedValue({}),
    toggle2FA:    vi.fn().mockResolvedValue({}),
    delete:       vi.fn().mockResolvedValue({}),
  },
}))
vi.mock('@/lib/confirm', () => ({ confirm: vi.fn().mockResolvedValue(true) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
// authStore : utilisateur ADMIN (déverrouille édition/suppression/invitation)
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((sel: any) => sel({ user: { id: 'u1', role: 'ADMIN' } })),
}))
// store : lang fr + currency XOF, en gardant les vraies fns (t a besoin de getState)
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const mockState = { ...actual.DEFAULT_CONFIG, lang: 'fr', currency: 'XOF' }
  const useAppStore: any = vi.fn((sel: any) => sel(mockState))
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})

import Users from '@/pages/Users'

beforeEach(() => { vi.clearAllMocks() })

describe('Users — test d’ancrage (comportement à figer avant/après découpe)', () => {
  it('charge et affiche les utilisateurs + 4 KPIs', async () => {
    const { container } = render(<Users />)
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())
    expect(screen.getByText('Bob Caissier')).toBeInTheDocument()
    expect(screen.getByText('Carol Gérante')).toBeInTheDocument()
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(4)
  })

  it('le filtre de recherche réduit la liste', async () => {
    render(<Users />)
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())
    const search = screen.getByPlaceholderText(/Nom, email/i)
    fireEvent.change(search, { target: { value: 'bob' } })
    expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Caissier')).toBeInTheDocument()
  })

  it('le filtre par rôle réduit la liste', async () => {
    render(<Users />)
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())
    const roleSelect = screen.getByDisplayValue('Tous les rôles')
    fireEvent.change(roleSelect, { target: { value: 'MANAGER' } })
    expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument()
    expect(screen.getByText('Carol Gérante')).toBeInTheDocument()
  })

  it('la matrice des rôles affiche les permissions au clic', async () => {
    render(<Users />)
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())
    // section permissions masquée tant qu'aucun rôle sélectionné
    fireEvent.click(screen.getByText(/Voir détails/i))
    // ADMIN sélectionné par défaut → ses modules apparaissent
    await waitFor(() => expect(screen.getAllByText(/Utilisateurs/i).length).toBeGreaterThan(0))
  })

  it('toggle actif → appelle usersApi.toggleActive', async () => {
    const { usersApi } = await import('@/lib/api') as any
    render(<Users />)
    await waitFor(() => expect(screen.getByText('Bob Caissier')).toBeInTheDocument())
    // Bob est actif → bouton "Désactiver"
    fireEvent.click(screen.getAllByText(/Désactiver/i)[0])
    await waitFor(() => expect(usersApi.toggleActive).toHaveBeenCalled())
  })

  it('suppression → confirm puis usersApi.delete', async () => {
    const { usersApi } = await import('@/lib/api') as any
    render(<Users />)
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())
    const delBtns = screen.getAllByLabelText(/Supprimer/i)
    fireEvent.click(delBtns[0])
    await waitFor(() => expect(usersApi.delete).toHaveBeenCalled())
  })
})

describe('Users — modale d’édition (câblage props/état)', () => {
  it('ouvre la modale d’édition préremplie et enregistre via usersApi.update', async () => {
    const { usersApi } = await import('@/lib/api') as any
    render(<Users />)
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText(/^Modifier$/)[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByDisplayValue('Alice Admin')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByDisplayValue('Alice Admin'), { target: { value: 'Alice Renamed' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Enregistrer/ }))
    await waitFor(() => expect(usersApi.update).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Alice Renamed' })))
  })
})

describe('Users — modale d’invitation (câblage props/état)', () => {
  it('ouvre la modale, refuse si mots de passe différents, puis invite', async () => {
    const { usersApi } = await import('@/lib/api') as any
    const toast = (await import('react-hot-toast')).default as any
    render(<Users />)
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Inviter un utilisateur/i))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Nom complet/i), { target: { value: 'Dan Nouveau' } })
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'dan@x.com' } })
    const pwds = within(dialog).getAllByPlaceholderText('••••••••')
    fireEvent.change(pwds[0], { target: { value: 'secret12' } })
    fireEvent.change(pwds[1], { target: { value: 'different' } })
    fireEvent.click(within(dialog).getByText(/Envoyer l'invitation/i))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(usersApi.invite).not.toHaveBeenCalled()
    // corrige la confirmation → invitation envoyée
    fireEvent.change(pwds[1], { target: { value: 'secret12' } })
    fireEvent.click(within(dialog).getByText(/Envoyer l'invitation/i))
    await waitFor(() => expect(usersApi.invite).toHaveBeenCalled())
  })
})
