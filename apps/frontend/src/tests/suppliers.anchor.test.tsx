import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// ── Mocks réseau (fixtures déterministes ; hoisted pour les factories vi.mock) ──
const { SUPPLIERS } = vi.hoisted(() => ({
  SUPPLIERS: [
    { id: 's1', name: 'Sococim', categories: 'Ciment,BTP', phone: '770000001', email: 'a@x.com', address: 'Dakar', leadTime: 3, rating: 4, status: 'Actif',  notes: '' },
    { id: 's2', name: 'Patisen', categories: 'Alimentaire', phone: '770000002', email: 'b@x.com', address: 'Rufisque', leadTime: 5, rating: 5, status: 'Pause', notes: 'Bon partenaire' },
    { id: 's3', name: 'NMA',     categories: 'Agro',        phone: '770000003', email: 'c@x.com', address: 'Thiès',    leadTime: 7, rating: 3, status: 'Inactif', notes: '' },
  ],
}))
vi.mock('@/lib/api', () => ({
  suppliersApi: {
    list:   vi.fn().mockResolvedValue(SUPPLIERS),
    create: vi.fn().mockResolvedValue({ id: 's4' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    // Historique de la fiche fournisseur (#214) : la modale le DEMANDE désormais.
    orders: vi.fn().mockResolvedValue([]),
  },
  // Le KPI « commandes en cours » compte de VRAIES commandes depuis #214 — il se
  // calculait avant sur `supplier.orders`, un tableau toujours vide.
  ordersApi: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/lib/confirm', () => ({ confirm: vi.fn().mockResolvedValue(true) }))
vi.mock('@/utils/export', () => ({ exportCSV: vi.fn(), openPDF: vi.fn(), htmlTable: vi.fn(() => '') }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
// inputs lourds (Google Maps / picker pays) → stubs simples
vi.mock('@/components/ui/AddressAutocompleteInput', () => ({ default: (p: any) => <input aria-label="address" value={p.value} onChange={e => p.onChange(e.target.value)} /> }))
vi.mock('@/components/ui/PhoneInputWithCountry', () => ({ default: (p: any) => <input aria-label="phone" value={p.value} onChange={e => p.onChange(e.target.value)} /> }))
// store : lang fr + currency XOF, en gardant les vraies fns (t/useFormatAmount/useI18n ont besoin de useAppStore)
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const mockState = { ...actual.DEFAULT_CONFIG, lang: 'fr', currency: 'XOF' }
  const useAppStore: any = vi.fn((sel: any) => sel(mockState))
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})

import Suppliers from '@/pages/Suppliers'

beforeEach(() => { vi.clearAllMocks() })

describe('Suppliers — test d’ancrage (comportement à figer avant/après découpe)', () => {
  it('charge et affiche les fournisseurs + 4 KPIs', async () => {
    const { container } = render(<Suppliers />)
    await waitFor(() => expect(screen.getByText('Sococim')).toBeInTheDocument())
    expect(screen.getByText('Patisen')).toBeInTheDocument()
    expect(screen.getByText('NMA')).toBeInTheDocument()
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(4)
  })

  it('le filtre de recherche réduit la liste', async () => {
    render(<Suppliers />)
    await waitFor(() => expect(screen.getByText('Sococim')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/Nom, contact/i), { target: { value: 'Patisen' } })
    expect(screen.queryByText('Sococim')).not.toBeInTheDocument()
    expect(screen.getByText('Patisen')).toBeInTheDocument()
  })

  it('ouvre la fiche fournisseur au clic sur « Voir »', async () => {
    render(<Suppliers />)
    await waitFor(() => expect(screen.getByText('Sococim')).toBeInTheDocument())
    fireEvent.click(screen.getAllByTitle(/Voir fiche/i)[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Historique commandes/i)).toBeInTheDocument()
  })

  it('supprime un fournisseur → confirm puis suppliersApi.delete', async () => {
    const { suppliersApi } = await import('@/lib/api') as any
    render(<Suppliers />)
    await waitFor(() => expect(screen.getByText('Sococim')).toBeInTheDocument())
    fireEvent.click(screen.getAllByLabelText(/^Supprimer /)[0])
    await waitFor(() => expect(suppliersApi.delete).toHaveBeenCalled())
  })

  it('ouvre la modale d’édition, passe en édition, enregistre via suppliersApi.update', async () => {
    const { suppliersApi } = await import('@/lib/api') as any
    render(<Suppliers />)
    await waitFor(() => expect(screen.getByText('Sococim')).toBeInTheDocument())
    fireEvent.click(screen.getAllByTitle(/^Modifier$/)[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText(/^Modifier$/))
    fireEvent.click(within(dialog).getByText(/Enregistrer/i))
    await waitFor(() => expect(suppliersApi.update).toHaveBeenCalled())
  })
})

describe('Suppliers — modale création (câblage props/état)', () => {
  it('ouvre la modale, bouton créer ACTIF qui nomme le champ manquant, puis crée', async () => {
    const { suppliersApi } = await import('@/lib/api') as any
    render(<Suppliers />)
    await waitFor(() => expect(screen.getByText('Sococim')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Nouveau fournisseur/i))
    const dialog = await screen.findByRole('dialog')
    const createBtn = within(dialog).getByRole('button', { name: /Créer le fournisseur/i })
    // ⚠️ ACTIF : le clic à vide nomme le champ manquant, il ne refuse pas en silence.
    expect(createBtn).toBeEnabled()
    fireEvent.click(createBtn)
    expect(within(dialog).getByText(/Il manque encore/)).toBeInTheDocument()
    expect(suppliersApi.create).not.toHaveBeenCalled()
    // 1er champ texte = Nom / Raison sociale (label non associé → on cible par position)
    fireEvent.change(within(dialog).getAllByRole('textbox')[0], { target: { value: 'Nouveau' } })
    expect(createBtn).toBeEnabled()
    fireEvent.click(createBtn)
    await waitFor(() => expect(suppliersApi.create).toHaveBeenCalled())
  })
})
