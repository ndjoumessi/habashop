import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import HRModals from '@/components/hr/HRModals'

// HRModals est présentationnel (props). On le rend directement avec props mockées
// et callbacks espionnés → ce test d'ancrage prouve le câblage props/état au runtime
// AVANT et APRÈS la découpe (assertions inchangées). Priorité : la modale d'édition
// employé (la plus riche en props/état).

vi.mock('@/lib/api', () => ({ employeesApi: { update: vi.fn(() => Promise.resolve()) } }))
vi.mock('@/lib/confirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/stores/appStore', () => ({
  useConvertToXOF: () => (n: number) => n,
  useConvertFromXOF: () => (n: number) => n,
  useCurrencyInfo: () => ({ code: 'XOF', symbol: 'F', decimals: 0, currency: 'XOF' }),
  useAppStore: (sel: any) => sel({ lang: 'fr' }),
  CURRENCY_SYMBOLS: { XOF: 'FCFA', XAF: 'FCFA', EUR: '€', USD: '$', CAD: 'CA$', GBP: '£' },
  // ── Ajouts requis depuis que les modales RH passent par `payrollDisplay` (conversion UNE
  // fois). On garde la convention IDENTITÉ de ce mock : ce fichier teste le COMPORTEMENT des
  // modales, pas l'arithmétique de conversion — celle-ci est verrouillée par
  // `payrollDisplayCoherence.test.ts` et `payrollConvertOnce.test.ts` avec de vrais taux.
  useConfig: () => ({ lang: 'fr', currency: 'XOF' }),
  convertFromXOF: (n: number) => n,
  convertAmount: (n: number) => n,
  formatInCurrency: (n: number) => `${n} FCFA`,
  formatAmount: (n: number) => `${n} FCFA`,
  CURRENCY_DECIMALS: { XOF: 0, XAF: 0, EUR: 2, USD: 2, CAD: 2, GBP: 2 },
  t: (k: string) => k,
}))
// UI inputs lourds mockés en inputs simples (mêmes signatures onChange(val))
vi.mock('@/components/ui/ValidatedInput', () => ({ default: ({ label, value, onChange, placeholder }: any) => <input aria-label={label || placeholder || 'vi'} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} /> }))
vi.mock('@/components/ui/ViewField', () => ({ default: ({ label, value, editing, children }: any) => <div data-vf={label}>{editing ? children : <span>{value}</span>}</div> }))
vi.mock('@/components/ui/PhoneInputWithCountry', () => ({ default: ({ label, value, onChange }: any) => <input aria-label={label || 'phone'} value={value} onChange={e => onChange(e.target.value)} /> }))
vi.mock('@/components/ui/AddressAutocompleteInput', () => ({ default: ({ label, value, onChange }: any) => <input aria-label={label || 'address'} value={value} onChange={e => onChange(e.target.value)} /> }))

const EMP = { id: 1, name: 'Marie Bakayoko', role: 'Caissière', dept: 'Ventes', salary: 200000, type: 'CDI' as const, hiredAt: '2024-01-15', avatar: 'MB', color: '#6C3FD6', active: true, phone: '77', email: 'm@x.com', perf: 3 }

function makeProps(overrides: any = {}) {
  return {
    showSalaryModal: false, setShowSalaryModal: vi.fn(),
    salaryTarget: null,
    lang: 'fr',
    fmt: (n: number) => `${n} F`,
    employees: [EMP] as any, setEmployees: vi.fn(),
    handleConfirmRaise: vi.fn(), handleConfirmBonus: vi.fn(),
    showModal: false, setShowModal: vi.fn(),
    showEditEmpModal: false, setShowEditEmpModal: vi.fn(),
    selectedEmp: EMP as any,
    editEmpForm: { ...EMP, isActive: true, contractEnd: '', address: '', photoUrl: '' }, setEditEmpForm: vi.fn(),
    empEditMode: false, setEmpEditMode: vi.fn(),
    salaryInput: '', setSalaryInput: vi.fn(),
    toXOF: (n: number) => n, currency: 'XOF', currencySymbol: 'F', tenantCurrency: 'XOF',
    openEditModal: vi.fn(),
    showNewContractModal: false, setShowNewContractModal: vi.fn(),
    contractForm: { empId: '', role: '', dept: 'Ventes', type: 'CDI', hiredAt: '2026-05-01', contractEnd: '', salary: 0 }, setContractForm: vi.fn(),
    showContractDetailModal: false, setShowContractDetailModal: vi.fn(),
    selectedContract: EMP as any,
    showLeaveModal: false, setShowLeaveModal: vi.fn(),
    leaveForm: { empId: 0, type: 'Congé annuel', startDate: '2026-05-01', endDate: '', notes: '' }, setLeaveForm: vi.fn(),
    onSubmitLeave: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('HRModals — modale édition employé [la plus riche en props/état]', () => {
  it('mode vue : "Modifier" → setEmpEditMode, "Fermer" → ferme', () => {
    const p = makeProps({ showEditEmpModal: true, empEditMode: false })
    render(<HRModals {...p} />)
    expect(screen.getByText(/Mode visualisation/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Modifier/ }))
    expect(p.setEmpEditMode).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByText(/Fermer/))
    expect(p.setShowEditEmpModal).toHaveBeenCalledWith(false)
  })

  it('mode édition : "Sauvegarder" appelle employeesApi.update + setEmployees + ferme', async () => {
    const { employeesApi } = await import('@/lib/api') as any
    const p = makeProps({ showEditEmpModal: true, empEditMode: true, salaryInput: '250000' })
    render(<HRModals {...p} />)
    expect(screen.getByText(/Mode édition/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Sauvegarder/))
    await waitFor(() => expect(employeesApi.update).toHaveBeenCalledWith('1', expect.objectContaining({ name: 'Marie Bakayoko' })))
    expect(p.setEmployees).toHaveBeenCalled()
    await waitFor(() => expect(p.setShowEditEmpModal).toHaveBeenCalledWith(false))
  })

  it('mode édition : "Annuler" → openEditModal, poubelle → confirm + setEmployees', async () => {
    const { confirm } = await import('@/lib/confirm') as any
    const p = makeProps({ showEditEmpModal: true, empEditMode: true })
    const { container } = render(<HRModals {...p} />)
    fireEvent.click(screen.getByText(/Annuler/))
    expect(p.openEditModal).toHaveBeenCalledWith(EMP)
    // bouton poubelle = dernier bouton de la modale (footer : Sauvegarder, Annuler, [Trash])
    const btns = container.querySelectorAll('button')
    fireEvent.click(btns[btns.length - 1])
    await waitFor(() => expect(confirm).toHaveBeenCalled())
    await waitFor(() => expect(p.setEmployees).toHaveBeenCalled())
  })
})

describe('HRModals — modale prime/augmentation', () => {
  it('mode raise : "Confirmer" appelle handleConfirmRaise', () => {
    const p = makeProps({ showSalaryModal: true, salaryTarget: { ...EMP, mode: 'raise' } })
    render(<HRModals {...p} />)
    expect(screen.getByText(/Augmentation salariale/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Confirmer/))
    expect(p.handleConfirmRaise).toHaveBeenCalled()
  })

  it('mode prime : saisie montant + "Ajouter la prime" → handleConfirmBonus', () => {
    const p = makeProps({ showSalaryModal: true, salaryTarget: { ...EMP } })
    render(<HRModals {...p} />)
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '5000' } })
    fireEvent.click(screen.getByText(/Ajouter la prime/))
    expect(p.handleConfirmBonus).toHaveBeenCalledWith('1', 5000, 'Performance')
  })
})

describe('HRModals — modale ajout employé (EmpModal)', () => {
  it('saisie nom + poste + "Ajouter" → onSave câblé (setEmployees)', () => {
    const p = makeProps({ showModal: true })
    render(<HRModals {...p} />)
    expect(screen.getByText(/Nouvel employé/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nom complet *'), { target: { value: 'Jean Test' } })
    fireEvent.change(screen.getByLabelText('Poste *'), { target: { value: 'Vendeur' } })
    fireEvent.click(screen.getByText(/Ajouter/))
    expect(p.setEmployees).toHaveBeenCalled()
  })
})

describe('HRModals — modale nouveau contrat', () => {
  it('formulaire rempli + "Créer le contrat" → setEmployees + ferme', () => {
    const p = makeProps({ showNewContractModal: true, contractForm: { empId: 'Jean Test', role: 'Vendeur', dept: 'Ventes', type: 'CDI', hiredAt: '2026-05-01', contractEnd: '', salary: 150000 } })
    render(<HRModals {...p} />)
    fireEvent.click(screen.getByText(/Créer le contrat/))
    expect(p.setEmployees).toHaveBeenCalled()
    expect(p.setShowNewContractModal).toHaveBeenCalledWith(false)
  })

  it('formulaire vide → validation bloque (toast.error, pas de setEmployees)', async () => {
    const toast = (await import('react-hot-toast')).default as any
    const p = makeProps({ showNewContractModal: true })
    render(<HRModals {...p} />)
    fireEvent.click(screen.getByText(/Créer le contrat/))
    expect(toast.error).toHaveBeenCalled()
    expect(p.setEmployees).not.toHaveBeenCalled()
  })
})

describe('HRModals — modale détail contrat', () => {
  it('affiche l\'employé + "Modifier" → openEditModal + ferme', () => {
    const p = makeProps({ showContractDetailModal: true })
    render(<HRModals {...p} />)
    expect(screen.getByText('Marie Bakayoko')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Modifier/))
    expect(p.openEditModal).toHaveBeenCalledWith(EMP)
    expect(p.setShowContractDetailModal).toHaveBeenCalledWith(false)
  })
})

describe('HRModals — modale demande de congé', () => {
  it('demande valide + "Soumettre" → onSubmitLeave(form) + ferme (POST géré par le parent)', () => {
    const p = makeProps({ showLeaveModal: true, leaveForm: { empId: 1, type: 'Congé annuel', startDate: '2026-05-01', endDate: '2026-05-05', notes: 'Repos' } })
    render(<HRModals {...p} />)
    fireEvent.click(screen.getByText(/Soumettre/))
    expect(p.onSubmitLeave).toHaveBeenCalled()
    expect(p.setShowLeaveModal).toHaveBeenCalledWith(false)
  })

  // Bug : le dropdown employé doit lister les employés ACTIFS et la sélection doit
  // marcher avec des id STRING (cuid en prod, ex. 'demo-emp-Marie') — pas seulement
  // des id numériques. Avant le fix, onChange faisait Number(cuid)=NaN → injélectable.
  it('liste les employés actifs et sélectionne via un id string (cuid)', () => {
    const EMP_S = { ...EMP, id: 'demo-emp-marie', name: 'Marie Bakayoko', active: true }
    const EMP_INACTIVE = { ...EMP, id: 'demo-emp-bob', name: 'Bob Inactif', active: false }
    // Harnais stateful : le select contrôlé doit réellement retenir la sélection.
    function Harness() {
      const [leaveForm, setLeaveForm] = useState<any>({ empId: '', type: 'Congé annuel', startDate: '', endDate: '', notes: '' })
      return <HRModals {...makeProps({ showLeaveModal: true, employees: [EMP_S, EMP_INACTIVE], leaveForm, setLeaveForm })} />
    }
    render(<Harness />)
    // option active présente, option inactive absente
    expect(screen.getByRole('option', { name: 'Marie Bakayoko' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Bob Inactif' })).toBeNull()
    // sélection par id STRING → la valeur reste (avec l'ancien Number(cuid)=NaN, elle retombait à '')
    const select = screen.getByLabelText('EMPLOYÉ') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'demo-emp-marie' } })
    expect(select.value).toBe('demo-emp-marie')
  })
})

describe('HRModals — NewContractModal : suffixe = devise d\'AFFICHAGE (SYMBOLE)', () => {
  it('affiche le SYMBOLE de la devise d\'affichage (EUR → "€"), pas le code ni "FCFA" hardcodé', () => {
    const p = makeProps({ showNewContractModal: true, currencySymbol: '€' })
    render(<HRModals {...p} />)
    expect(screen.getByText('€')).toBeInTheDocument()
    expect(screen.queryByText('EUR')).toBeNull()
    expect(screen.queryByText('FCFA')).toBeNull()
  })
  it('devise XOF → suffixe "FCFA" (symbole)', () => {
    const p = makeProps({ showNewContractModal: true, currencySymbol: 'FCFA' })
    render(<HRModals {...p} />)
    expect(screen.getByText('FCFA')).toBeInTheDocument()
  })
})
