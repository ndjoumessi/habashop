import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// ── Mocks réseau (fixtures déterministes ; hoisted pour les factories vi.mock) ──
//
// ⚠️ `payrollApi` est mocké par un petit STORE qui respecte réellement le mois et
// l'idempotence. Un `mockResolvedValue([])` figé resterait vert même si la page cessait
// d'envoyer le mois ou réécrivait un bulletin payé — il décrirait un monde qui n'existe pas.
const { EMPLOYEES, store } = vi.hoisted(() => ({
  EMPLOYEES: [
    { id: 1, name: 'Marie Bakayoko', role: 'Caissière', salary: 180000, active: true },
    { id: 2, name: 'Kofi Diallo',    role: 'Magasinier', salary: 150000, active: true },
    { id: 3, name: 'Aminata Touré',  role: 'Manager',    salary: 300000, active: false },
  ],
  store: { rows: [] as any[] },
}))

vi.mock('@/lib/api', () => ({
  employeesApi: { list: vi.fn().mockResolvedValue(EMPLOYEES) },
  payrollApi: {
    list: vi.fn(async (month: string) => store.rows.filter(r => r.month === month)),
    generate: vi.fn(async (month: string) => {
      let created = 0
      for (const e of EMPLOYEES.filter(x => x.active)) {
        // Idempotence : jamais deux bulletins pour (employé, mois) — et jamais de réécriture.
        if (store.rows.some(r => r.month === month && r.employeeId === String(e.id))) continue
        store.rows.push({
          id: `p${store.rows.length + 1}`, employeeId: String(e.id), month,
          status: 'GÉNÉRÉ', employeeName: e.name, role: e.role,
          baseSalary: e.salary, bonus: 0, overtime: 0, deductions: 0, absences: 0,
          net: e.salary, paidAt: null,
        })
        created++
      }
      return { created, rows: store.rows.filter(r => r.month === month) }
    }),
    setStatus: vi.fn(async (id: string, status: string) => {
      const r = store.rows.find(x => x.id === id)
      if (!r) throw new Error('introuvable')
      r.status = status
      r.paidAt = status === 'PAYÉ' ? new Date().toISOString() : null
      return r
    }),
  },
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

beforeEach(() => { vi.clearAllMocks(); store.rows = [] })

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

describe('Payroll — PERSISTANCE des statuts', () => {
  /**
   * ⚠️ CHANGEMENT DE COMPORTEMENT ASSUMÉ. L'ancien test figeait « changer de mois VIDE la
   * table » — ce n'était pas une règle métier, c'était la LIMITE de l'implémentation : les
   * records étaient épinglés à `currentMonthLabel`, donc tout autre mois était vide et le
   * sélecteur ne servait à rien. Chaque mois a désormais ses propres bulletins.
   */
  it('changer de mois recharge les bulletins DE CE MOIS (le sélecteur sert enfin)', async () => {
    render(<Payroll />)
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    const monthSelect = screen.getAllByRole('combobox')[0]
    const autre = within(monthSelect).getAllByRole('option').find(o => !(o as HTMLOptionElement).selected) as HTMLOptionElement
    fireEvent.change(monthSelect, { target: { value: autre.value } })
    // Les employés restent listés — mais en attente, ce mois-là n'ayant pas de bulletin.
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    expect(screen.getAllByText('EN ATTENTE').length).toBeGreaterThan(0)
  })

  it('un statut PAYÉ SURVIT à un remontage (c’est tout l’objet du chantier)', async () => {
    const { unmount } = render(<Payroll />)
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Payer')[0])
    await waitFor(() => expect(screen.getAllByText('PAYÉ').length).toBeGreaterThan(0))

    // Rafraîchissement de la page : avant, l'état vivait dans un useState et tout revenait
    // à « EN ATTENTE » — on ne savait plus qui avait été payé.
    unmount()
    render(<Payroll />)
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    expect(screen.getAllByText('PAYÉ').length).toBeGreaterThan(0)
  })

  it('le statut PAYÉ d’un mois ne DÉTEINT pas sur un autre mois', async () => {
    render(<Payroll />)
    await waitFor(() => expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Payer')[0])
    await waitFor(() => expect(screen.getAllByText('PAYÉ').length).toBeGreaterThan(0))

    const monthSelect = screen.getAllByRole('combobox')[0]
    const autre = within(monthSelect).getAllByRole('option').find(o => !(o as HTMLOptionElement).selected) as HTMLOptionElement
    fireEvent.change(monthSelect, { target: { value: autre.value } })
    await waitFor(() => expect(screen.queryAllByText('PAYÉ')).toHaveLength(0))
  })
})
