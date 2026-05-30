import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// ── Mocks réseau (fixtures déterministes ; hoisted pour les factories vi.mock) ──
const { EMPLOYEES } = vi.hoisted(() => ({
  EMPLOYEES: [
    { id: 1, name: 'Marie Bakayoko', role: 'Caissière', salary: 180000, active: true },
    { id: 2, name: 'Kofi Diallo',    role: 'Magasinier', salary: 150000, active: true },
    { id: 3, name: 'Aminata Touré',  role: 'Manager',    salary: 300000, active: false },
  ],
}))
vi.mock('@/lib/api', () => ({
  employeesApi: { list: vi.fn().mockResolvedValue(EMPLOYEES) },
}))
vi.mock('@/utils/export', () => ({ exportCSV: vi.fn(), openPDF: vi.fn(), htmlTable: vi.fn(() => ''), htmlInfoGrid: vi.fn(() => '') }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
// store : lang fr + currency XOF, en gardant les vraies fns (t/useFormatAmount/getState)
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const mockState = { ...actual.DEFAULT_CONFIG, lang: 'fr', currency: 'XOF' }
  const useAppStore: any = vi.fn((sel: any) => sel(mockState))
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})

import Payroll from '@/pages/Payroll'

beforeEach(() => { vi.clearAllMocks() })

describe('Payroll — test d’ancrage (comportement à figer avant/après découpe)', () => {
  it('charge les employés actifs (inactifs exclus) + 4 KPIs', async () => {
    const { container } = render(<Payroll />)
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    expect(screen.getByText('Kofi Diallo')).toBeInTheDocument()
    expect(screen.queryByText('Aminata Touré')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(4)
  })

  it('générer la paie du mois → toast de succès', async () => {
    const toast = (await import('react-hot-toast')).default as any
    render(<Payroll />)
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Générer la paie du mois/i))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('marquer payé via l’action de ligne → badge PAYÉ', async () => {
    render(<Payroll />)
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Payer')[0])
    await waitFor(() => expect(screen.getAllByText('PAYÉ').length).toBeGreaterThan(0))
  })

  it('ouvre le bulletin au clic sur « Voir » et affiche le net à payer', async () => {
    render(<Payroll />)
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Voir')[0])
    expect(await screen.findByText('NET À PAYER')).toBeInTheDocument()
  })

  it('le bulletin « Marquer comme payé » solde le bulletin et ferme la modale', async () => {
    render(<Payroll />)
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Voir')[0])
    await screen.findByText('NET À PAYER')
    fireEvent.click(screen.getByText('Marquer comme payé'))
    await waitFor(() => expect(screen.queryByText('NET À PAYER')).not.toBeInTheDocument())
    expect(screen.getAllByText('PAYÉ').length).toBeGreaterThan(0)
  })
})

describe('Payroll — sélecteur de mois', () => {
  it('changer de mois vide la table (records sur le mois courant uniquement)', async () => {
    render(<Payroll />)
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    // le sélecteur de mois = 1er combobox
    const monthSelect = screen.getAllByRole('combobox')[0]
    const otherMonth = within(monthSelect).getAllByRole('option').find(o => !(o as HTMLOptionElement).selected) as HTMLOptionElement
    fireEvent.change(monthSelect, { target: { value: otherMonth.value } })
    expect(screen.queryByText('Marie Bakayoko')).not.toBeInTheDocument()
  })
})
