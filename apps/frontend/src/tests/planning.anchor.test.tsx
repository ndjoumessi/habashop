import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// ── Mocks réseau (fixtures déterministes ; hoisted pour les factories vi.mock) ──
const { EMPLOYEES } = vi.hoisted(() => ({
  EMPLOYEES: [
    { id: 'emp1', name: 'Marie Bakayoko', role: 'Caissière', dept: 'Vente',   color: '#6C47FF', isActive: true },
    { id: 'emp2', name: 'Kofi Diallo',    role: 'Magasinier', dept: 'Stock',   color: '#00B8FF', isActive: true },
    { id: 'emp3', name: 'Aminata Touré',  role: 'Manager',    dept: 'Direction', color: '#FF9500', isActive: false },
  ],
}))
vi.mock('@/lib/api', () => ({
  employeesApi: { list: vi.fn().mockResolvedValue(EMPLOYEES) },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
// store : lang fr, en gardant les vraies fns
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const mockState = { ...actual.DEFAULT_CONFIG, lang: 'fr', currency: 'XOF' }
  const useAppStore: any = vi.fn((sel?: any) => sel ? sel(mockState) : mockState)
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})

import Planning from '@/pages/Planning'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('Planning — test d’ancrage (comportement à figer avant/après découpe)', () => {
  it('charge et affiche les employés actifs (inactifs exclus)', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    expect(screen.getByText('Kofi')).toBeInTheDocument()
    // Aminata est inactive → exclue
    expect(screen.queryByText('Aminata')).not.toBeInTheDocument()
  })

  it('affiche les 7 en-têtes de jour de la semaine', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    expect(screen.getByText('Lun')).toBeInTheDocument()
    expect(screen.getByText('Dim')).toBeInTheDocument()
  })

  it('le filtre par département réduit la liste', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    const deptSelect = screen.getByDisplayValue('Tous les départements')
    fireEvent.change(deptSelect, { target: { value: 'Stock' } })
    expect(screen.queryByText('Marie')).not.toBeInTheDocument()
    expect(screen.getByText('Kofi')).toBeInTheDocument()
  })

  it('clic sur une case vide ouvre la modale d’assignation', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    // les cases vides affichent un "+"
    const plus = screen.getAllByText('+')
    fireEvent.click(plus[0])
    expect(await screen.findByText(/Assigner un shift/i)).toBeInTheDocument()
  })

  it('confirme l’assignation d’un shift → persiste et ferme la modale', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('+')[0])
    await screen.findByText(/Assigner un shift/i)
    fireEvent.click(screen.getByText(/Confirmer/i))
    await waitFor(() => expect(screen.queryByText(/Assigner un shift/i)).not.toBeInTheDocument())
    // un shift a été écrit dans localStorage
    expect(localStorage.getItem('habashop_shifts')).toBeTruthy()
  })

  it('affiche le résumé de stats après assignation', async () => {
    render(<Planning />)
    await waitFor(() => expect(screen.getByText('Marie')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('+')[0])
    await screen.findByText(/Assigner un shift/i)
    fireEvent.click(screen.getByText(/Confirmer/i))
    await waitFor(() => expect(screen.queryByText(/Assigner un shift/i)).not.toBeInTheDocument())
    // "Journée" (full = shift par défaut) apparaît dans la légende ET dans les stats
    await waitFor(() => expect(screen.getAllByText('Journée').length).toBeGreaterThan(1))
  })
})
