import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// ── Mocks réseau (fixtures déterministes ; hoisted pour les factories vi.mock) ──
const { EXPENSES } = vi.hoisted(() => ({
  EXPENSES: [
    { id: 'e1', date: '2026-05-03T00:00:00Z', label: 'Facture EDF',   category: 'Énergie',   amountHT: 80000,  vat: 18, mode: 'Virement', status: 'PAYÉ',       recurrent: true  },
    { id: 'e2', date: '2026-05-10T00:00:00Z', label: 'Loyer boutique', category: 'Loyer',     amountHT: 300000, vat: 0,  mode: 'Virement', status: 'EN ATTENTE', recurrent: true  },
    { id: 'e3', date: '2026-05-12T00:00:00Z', label: 'Cartouches',     category: 'Fournitures', amountHT: 25000, vat: 18, mode: 'Carte',    status: 'EN ATTENTE', recurrent: false },
  ],
}))
vi.mock('@/lib/api', () => ({
  expensesApi: {
    list:   vi.fn().mockResolvedValue(EXPENSES),
    create: vi.fn().mockResolvedValue({ id: 'e4' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  salesApi: { list: vi.fn().mockResolvedValue([]) },
  // ⚠️ La page charge désormais ses budgets depuis le serveur. Un mock partiel du
  // module fait lever `expenseBudgetsApi.get is not a function` au montage : c'est
  // le mock qu'on complète, JAMAIS la page qu'on rend défensive — un `?.` posé pour
  // satisfaire un test masquerait une vraie panne de chargement en production.
  expenseBudgetsApi: {
    get: vi.fn().mockResolvedValue({ budgets: {} }),
    put: vi.fn().mockResolvedValue({ budgets: {} }),
  },
}))
vi.mock('@/utils/export', () => ({ exportCSV: vi.fn(), openPDF: vi.fn(), htmlTable: vi.fn(() => ''), htmlKPIs: vi.fn(() => ''), exportAccountingExcel: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
// store : lang fr + currency XOF, en gardant les vraies fns (t/useFormatAmount ont besoin de getState)
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const mockState = { ...actual.DEFAULT_CONFIG, lang: 'fr', currency: 'XOF' }
  const useAppStore: any = vi.fn((sel: any) => sel(mockState))
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})

import Expenses from '@/pages/Expenses'

beforeEach(() => { vi.clearAllMocks() })

describe('Expenses — test d’ancrage (comportement à figer avant/après découpe)', () => {
  it('charge et affiche les dépenses + 4 KPIs', async () => {
    const { container } = render(<Expenses />)
    await waitFor(() => expect(screen.getByText('Facture EDF')).toBeInTheDocument())
    expect(screen.getByText('Loyer boutique')).toBeInTheDocument()
    expect(screen.getByText('Cartouches')).toBeInTheDocument()
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(4)
  })

  it('le filtre de recherche réduit le journal', async () => {
    render(<Expenses />)
    await waitFor(() => expect(screen.getByText('Facture EDF')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: 'Loyer' } })
    expect(screen.queryByText('Facture EDF')).not.toBeInTheDocument()
    expect(screen.getByText('Loyer boutique')).toBeInTheDocument()
  })

  it('le filtre par statut réduit le journal', async () => {
    render(<Expenses />)
    await waitFor(() => expect(screen.getByText('Facture EDF')).toBeInTheDocument())
    const statusSelect = screen.getByDisplayValue('Tous statuts')
    fireEvent.change(statusSelect, { target: { value: 'PAYÉ' } })
    expect(screen.getByText('Facture EDF')).toBeInTheDocument()
    expect(screen.queryByText('Loyer boutique')).not.toBeInTheDocument()
  })

  it('marque une dépense en attente comme payée → expensesApi.update', async () => {
    const { expensesApi } = await import('@/lib/api') as any
    render(<Expenses />)
    await waitFor(() => expect(screen.getByText('Loyer boutique')).toBeInTheDocument())
    fireEvent.click(screen.getAllByTitle(/Marquer payé/i)[0])
    await waitFor(() => expect(expensesApi.update).toHaveBeenCalledWith('e2', { status: 'PAYÉ' }))
  })

  it('supprime une dépense → expensesApi.delete', async () => {
    const { expensesApi } = await import('@/lib/api') as any
    render(<Expenses />)
    await waitFor(() => expect(screen.getByText('Facture EDF')).toBeInTheDocument())
    fireEvent.click(screen.getAllByTitle(/Supprimer/i)[0])
    await waitFor(() => expect(expensesApi.delete).toHaveBeenCalled())
  })

  it('bascule vers l’onglet budget et affiche le résumé mensuel', async () => {
    render(<Expenses />)
    await waitFor(() => expect(screen.getByText('Facture EDF')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Budget vs Réel'))
    await waitFor(() => expect(screen.getByText(/Résumé mensuel/i)).toBeInTheDocument())
  })
})

describe('Expenses — modale d’ajout (câblage props/état)', () => {
  it('ouvre la modale, refuse sans libellé/montant, puis crée via expensesApi.create', async () => {
    const { expensesApi } = await import('@/lib/api') as any
    const toast = (await import('react-hot-toast')).default as any
    render(<Expenses />)
    await waitFor(() => expect(screen.getByText('Facture EDF')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Nouvelle dépense/i))
    const dialog = await screen.findByRole('dialog')
    // tentative vide → erreur, pas de create
    fireEvent.click(within(dialog).getByText(/Enregistrer/i))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(expensesApi.create).not.toHaveBeenCalled()
    // remplit puis crée
    fireEvent.change(within(dialog).getByLabelText(/Libellé/i), { target: { value: 'Internet' } })
    const amount = within(dialog).getByPlaceholderText('Ex: 85000')
    fireEvent.change(amount, { target: { value: '15000' } })
    fireEvent.click(within(dialog).getByText(/Enregistrer/i))
    await waitFor(() => expect(expensesApi.create).toHaveBeenCalled())
  })
})

describe('Expenses — modale détail/édition (câblage props/état)', () => {
  it('ouvre le détail, passe en édition, sauvegarde via expensesApi.update', async () => {
    const { expensesApi } = await import('@/lib/api') as any
    render(<Expenses />)
    await waitFor(() => expect(screen.getByText('Facture EDF')).toBeInTheDocument())
    fireEvent.click(screen.getAllByTitle(/Modifier/i)[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Détail dépense/i)).toBeInTheDocument()
    // bascule en mode édition
    fireEvent.click(within(dialog).getByRole('button', { name: /^Modifier$/ }))
    fireEvent.click(within(dialog).getByText(/Sauvegarder/i))
    await waitFor(() => expect(expensesApi.update).toHaveBeenCalled())
  })
})
