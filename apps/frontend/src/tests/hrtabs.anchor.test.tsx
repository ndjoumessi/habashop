import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import HRTabs from '@/components/hr/HRTabs'

// HRTabs est purement présentationnel (tout vient des props). On rend le composant
// directement avec des props mockées et on espionne les callbacks → ce test d'ancrage
// prouve le câblage props/état au runtime AVANT et APRÈS la découpe (assertions inchangées).

vi.mock('@/lib/api', () => ({ bonusesApi: { delete: vi.fn(() => Promise.resolve()) } }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const EMPLOYEES = [
  { id: 1, name: 'Marie Bakayoko', role: 'Caissière', dept: 'Ventes', salary: 200000, type: 'CDI' as const, hiredAt: '2024-01-15', avatar: 'MB', color: '#6C3FD6', active: true, phone: '77', email: 'marie@x.com' },
  { id: 2, name: 'Kofi Diallo', role: 'Magasinier', dept: 'Stock', salary: 150000, type: 'CDD' as const, hiredAt: '2024-03-01', endAt: '2026-06-01', avatar: 'KD', color: '#3B82F6', active: true, phone: '78', email: 'kofi@x.com' },
]

function makeProps(overrides: any = {}) {
  return {
    tab: 'contracts',
    employees: EMPLOYEES as any,
    fmt: (n: number) => `${n} F`,
    lang: 'fr',
    payTab: 'grid', setPayTab: vi.fn(),
    payrollMonth: '2026-05', setPayrollMonth: vi.fn(),
    bonuses: {} as Record<string, number>, setBonuses: vi.fn(),
    bonusList: [] as any[], setBonusList: vi.fn(),
    salaryHistory: [] as any[],
    onDeleteSalaryHistory: vi.fn(),
    generateAllPayslips: vi.fn(),
    generatePayslipPDF: vi.fn(),
    setSalaryTarget: vi.fn(), setShowSalaryModal: vi.fn(),
    setSelectedContract: vi.fn(), setShowContractDetailModal: vi.fn(),
    setContractForm: vi.fn(), setShowNewContractModal: vi.fn(),
    attendance: {} as any, onSaveAttendance: vi.fn(),
    attendanceDate: '2026-05-15', setAttendanceDate: vi.fn(),
    pendingLeaves: 1,
    leaves: [{ id: 1, empId: 1, type: 'Congé annuel', from: '2026-05-01', to: '2026-05-05', days: 5, motif: 'Repos', status: 'pending' as const }] as any,
    setLeaveForm: vi.fn(), setShowLeaveModal: vi.fn(),
    handleLeaveAction: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('HRTabs — onglet Contrats', () => {
  it('affiche les contrats + clic ligne ouvre le détail, clic "Nouveau contrat" ouvre la modale', () => {
    const p = makeProps({ tab: 'contracts' })
    render(<HRTabs {...p} />)
    expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument()
    expect(screen.getByText('Kofi Diallo')).toBeInTheDocument()
    // clic sur une ligne → setSelectedContract + ouverture modale détail
    fireEvent.click(screen.getByText('Marie Bakayoko').closest('tr')!)
    expect(p.setSelectedContract).toHaveBeenCalled()
    expect(p.setShowContractDetailModal).toHaveBeenCalledWith(true)
    // bouton nouveau contrat
    fireEvent.click(screen.getByText(/Nouveau contrat/))
    expect(p.setContractForm).toHaveBeenCalled()
    expect(p.setShowNewContractModal).toHaveBeenCalledWith(true)
  })
})

describe('HRTabs — onglet Paie (grille)', () => {
  it('affiche le détail paie + "Augmenter" cible un employé, "Prime collective" ouvre la modale', () => {
    const p = makeProps({ tab: 'payroll', payTab: 'grid', bonuses: { '1': 5000 } })
    render(<HRTabs {...p} />)
    expect(screen.getByText(/Détail de la paie/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByText(/Augmenter/)[0])
    expect(p.setSalaryTarget).toHaveBeenCalled()
    expect(p.setShowSalaryModal).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByText(/Prime collective/))
    expect(p.setSalaryTarget).toHaveBeenCalledWith(null)
  })
})

describe('HRTabs — onglet Paie (primes) [extraction la plus riche en props/état]', () => {
  it('liste les primes, déplie le détail, et "Supprimer" met à jour bonuses + bonusList', () => {
    const p = makeProps({
      tab: 'payroll', payTab: 'bonuses',
      bonuses: { '1': 5000 },
      bonusList: [{ id: 'b1', empId: '1', amount: 5000, reason: 'Performance', date: '2026-05-01' }],
    })
    render(<HRTabs {...p} />)
    expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument()
    // détail replié au départ : la raison "Performance" n'est pas visible
    expect(screen.queryByText('Performance')).not.toBeInTheDocument()
    // déplier via le chevron (title "Voir le détail")
    fireEvent.click(screen.getByTitle('Voir le détail'))
    expect(screen.getByText('Performance')).toBeInTheDocument()
    // supprimer la prime de la ligne → setBonuses + setBonusList
    fireEvent.click(screen.getAllByText(/Supprimer/)[0])
    expect(p.setBonuses).toHaveBeenCalled()
    expect(p.setBonusList).toHaveBeenCalled()
  })
})

describe('HRTabs — onglet Paie (bulletins)', () => {
  it('rend une carte bulletin par employé actif + "Télécharger" et "Générer tous" câblés', () => {
    const p = makeProps({ tab: 'payroll', payTab: 'payslip', bonuses: { '1': 5000 } })
    render(<HRTabs {...p} />)
    expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument()
    expect(screen.getAllByText(/NET À PAYER/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText(/Générer tous les bulletins/))
    expect(p.generateAllPayslips).toHaveBeenCalled()
    fireEvent.click(screen.getAllByText(/Télécharger bulletin/)[0])
    expect(p.generatePayslipPDF).toHaveBeenCalled()
  })
})

describe('HRTabs — onglet Paie (historique) [isMobile + useEffect resize]', () => {
  it('état vide : "Aucune révision" + bouton première révision câblé', () => {
    const p = makeProps({ tab: 'payroll', payTab: 'history', salaryHistory: [] })
    render(<HRTabs {...p} />)
    expect(screen.getByText(/Aucune révision salariale/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Première révision salariale/))
    expect(p.setSalaryTarget).toHaveBeenCalled()
    expect(p.setShowSalaryModal).toHaveBeenCalledWith(true)
  })

  it('rend la timeline + survit à un resize (effet isMobile) + supprime une révision', () => {
    const p = makeProps({
      tab: 'payroll', payTab: 'history',
      salaryHistory: [{ id: 'h1', empId: '1', oldSalary: 180000, newSalary: 200000, reason: 'Promotion', date: '2026-04-01' }],
    })
    render(<HRTabs {...p} />)
    expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument()
    expect(screen.getByText('Promotion')).toBeInTheDocument()
    // l'effet resize/isMobile ne doit pas casser le rendu
    fireEvent(window, new Event('resize'))
    expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument()
    // suppression d'une révision (onDeleteSalaryHistory + h.id présents)
    fireEvent.click(screen.getByText(/Supprimer/))
    expect(p.onDeleteSalaryHistory).toHaveBeenCalledWith('h1')
  })
})

describe('HRTabs — onglet Pointage', () => {
  it('affiche la feuille de présence + "Tous présents" et un bouton de statut écrivent attendance', () => {
    const p = makeProps({ tab: 'pointage' })
    render(<HRTabs {...p} />)
    expect(screen.getByText(/Feuille de présence/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Tous présents/))
    expect(p.onSaveAttendance).toHaveBeenCalled()
  })
})

describe('HRTabs — onglet Congés', () => {
  it('affiche les demandes + "Approuver"/"Refuser" déclenchent handleLeaveAction', () => {
    const p = makeProps({ tab: 'leaves' })
    render(<HRTabs {...p} />)
    expect(screen.getByText(/Demandes de congés/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Approuver/))
    expect(p.handleLeaveAction).toHaveBeenCalledWith(1, 'approved')
    fireEvent.click(screen.getByText(/Refuser/))
    expect(p.handleLeaveAction).toHaveBeenCalledWith(1, 'refused')
  })
})
