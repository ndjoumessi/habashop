import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// ── Mocks réseau (fixtures déterministes ; hoisted pour les factories vi.mock) ──
const { ORDERS } = vi.hoisted(() => ({
  ORDERS: [
    { id: '1', ref: 'PO-001', supplier: { name: 'Fournisseur Alpha' }, createdAt: '2026-05-01T00:00:00Z', expectedAt: '2026-05-08T00:00:00Z', status: 'SENT', total: 50000, items: [{ productName: 'Riz', qty: 2, unitPrice: 25000 }], notes: 'note alpha' },
    { id: '2', ref: 'PO-002', supplier: { name: 'Fournisseur Beta' }, createdAt: '2026-05-02T00:00:00Z', expectedAt: '2026-05-09T00:00:00Z', status: 'RECEIVED', total: 30000, items: [{ productName: 'Huile', qty: 1, unitPrice: 30000 }], notes: '' },
  ],
}))
vi.mock('@/lib/api', () => ({
  ordersApi:    { list: vi.fn().mockResolvedValue(ORDERS), updateStatus: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) },
  productsApi:  { list: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Riz', sellPrice: 25000, emoji: '🍚', category: 'X' }]) },
  // ⚠️ Forme FIL RÉELLE (`ApiSupplier`, ligne Prisma brute). L'ancienne fixture inventait
  // `specialty: 'Alim'`, `leadTime: '3j'` et `status: 'active'` — trois valeurs qu'aucune
  // API n'a jamais renvoyées. Elle restait VERTE pendant que l'écran affichait du vide.
  suppliersApi: { list: vi.fn().mockResolvedValue([{
    id: 's1', tenantId: 't1', name: 'Fournisseur Alpha',
    categories: 'Alimentaire, Boissons', phone: '77', email: null, address: null,
    leadTime: 3, rating: 4, status: 'Actif', notes: null,
    createdAt: '2026-07-01T10:00:00.000Z', updatedAt: '2026-07-01T10:00:00.000Z', deletedAt: null,
  }]) },
  customersApi: { list: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Aminata', phone: '70', type: 'Fidèle', totalCA: 1000 }]) },
}))
// export utils inertes (pas de window.open / download en test)
vi.mock('@/utils/export', () => ({ exportCSV: vi.fn(), openPDF: vi.fn(), htmlTable: vi.fn(() => ''), htmlKPIs: vi.fn(() => ''), htmlInfoGrid: vi.fn(() => '') }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
// store : lang fr + currency XOF, en gardant les vraies fns (t a besoin de getState)
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const mockState = { ...actual.DEFAULT_CONFIG, lang: 'fr', currency: 'XOF' }
  const useAppStore: any = vi.fn((sel: any) => sel(mockState))
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})

import Orders from '@/pages/Orders'

beforeEach(() => { vi.clearAllMocks() })

describe('Orders — test d’ancrage (comportement à figer avant/après découpe)', () => {
  it('charge et affiche les commandes + 4 KPIs', async () => {
    const { container } = render(<Orders />)
    await waitFor(() => expect(screen.getByText('PO-001')).toBeInTheDocument())
    expect(screen.getByText('PO-002')).toBeInTheDocument()
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(4)
  })

  it('le filtre de recherche réduit la liste', async () => {
    render(<Orders />)
    await waitFor(() => expect(screen.getByText('PO-001')).toBeInTheDocument())
    const search = screen.getByPlaceholderText(/Référence/i)
    fireEvent.change(search, { target: { value: 'PO-002' } })
    expect(screen.queryByText('PO-001')).not.toBeInTheDocument()
    expect(screen.getByText('PO-002')).toBeInTheDocument()
  })

  it('ouvre la modale de détail au clic sur « Voir détails »', async () => {
    render(<Orders />)
    await waitFor(() => expect(screen.getByText('PO-001')).toBeInTheDocument())
    const viewBtns = screen.getAllByTitle(/Voir détails/i)
    fireEvent.click(viewBtns[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('PO-001')).toBeInTheDocument()
  })

  it('bascule vers la vue calendrier', async () => {
    render(<Orders />)
    await waitFor(() => expect(screen.getByText('PO-001')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/^Calendrier$/))
    expect(await screen.findByText('Lun')).toBeInTheDocument() // en-tête de jour
  })

  it('change le statut d’une commande BROUILLON→… via l’action de ligne', async () => {
    const { ordersApi } = await import('@/lib/api') as any
    render(<Orders />)
    await waitFor(() => expect(screen.getByText('PO-002')).toBeInTheDocument())
    // PO-002 = REÇUE (pas d'action de progression). PO-001 = ENVOYÉE → bouton "Confirmer"
    const confirmBtns = screen.getAllByText(/Confirmer/i)
    fireEvent.click(confirmBtns[0])
    await waitFor(() => expect(ordersApi.updateStatus).toHaveBeenCalled())
  })
})

describe('Orders — NewOrderModal : flux de création (câblage props/état)', () => {
  const openModal = async () => {
    render(<Orders />)
    await waitFor(() => expect(screen.getByText('PO-001')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText(/Nouvelle commande/i)[0]) // bouton header
    return screen.findByRole('dialog')
  }

  it('ouvre la modale, bouton créer ACTIF qui nomme client + article manquants', async () => {
    const dialog = await openModal()
    expect(within(dialog).getByText(/Commande client/)).toBeInTheDocument()
    const createBtn = within(dialog).getByRole('button', { name: /Créer la commande/ })
    // ⚠️ ACTIF : au clic à vide, la modale NOMME ce qui manque au lieu de refuser en silence.
    expect(createBtn).toBeEnabled()
    fireEvent.click(createBtn)
    expect(within(dialog).getByText(/Il manque encore/)).toBeInTheDocument()
  })

  it('commande CLIENT : AUCUN appel serveur — locale et éphémère (décision produit)', async () => {
    const { ordersApi } = await import('@/lib/api') as any
    const dialog = await openModal()
    // saisir un client
    fireEvent.change(within(dialog).getByPlaceholderText(/Rechercher ou saisir un client/), { target: { value: 'Client Test' } })
    // sélectionner un produit via le picker (fixture: "Riz")
    fireEvent.click(within(dialog).getByText('Riz'))
    const createBtn = within(dialog).getByRole('button', { name: /Créer la commande/ })
    expect(createBtn).toBeEnabled()
    fireEvent.click(createBtn)
    // ⚠️ Ce test affirmait l'INVERSE — que `ordersApi.create` était appelé. Cet appel partait
    // sans `supplierId` et se faisait refuser en 400 à CHAQUE fois (0 commande en base) :
    // le test verrouillait le bug. `PurchaseOrder` ne sait pas représenter une commande
    // client (pas de `clientName`, `supplierId` en FK obligatoire) → elle reste locale.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()) // modale fermée
    expect(ordersApi.create).not.toHaveBeenCalled()
    // …et la commande apparaît bien à l'écran, en mémoire.
    expect(screen.getByText(/Client Test/)).toBeInTheDocument()
  })

  it('bascule type fournisseur → picker fournisseur, crée un BON DE COMMANDE', async () => {
    const { ordersApi } = await import('@/lib/api') as any
    const dialog = await openModal()
    fireEvent.click(within(dialog).getByText(/Bon de commande/)) // toggle supplier
    // le picker fournisseur affiche la fixture "Fournisseur Alpha"
    fireEvent.click(within(dialog).getByText('Fournisseur Alpha'))
    fireEvent.click(within(dialog).getByText('Riz'))
    const createBtn = within(dialog).getByRole('button', { name: /Créer le bon de commande/ })
    expect(createBtn).toBeEnabled()
    fireEvent.click(createBtn)
    await waitFor(() => expect(ordersApi.create).toHaveBeenCalledTimes(1))
    // ⚠️ La charge utile doit satisfaire le zod : `product` / `unitPrice`, PAS les lignes du
    // formulaire (`name`/`price`), qui faisaient 400. Cf. `orderCreatePayload.test.ts`.
    const envoye = (ordersApi.create as any).mock.calls[0][0]
    expect(envoye.supplierId).toBe('s1')
    expect(Object.keys(envoye.items[0]).sort()).toEqual(['product', 'qty', 'unitPrice'])
    expect(envoye.items[0].unitPrice).toBeTypeOf('number')
  })

  it('le picker produit ajoute/retire au panier (récap reflète la sélection)', async () => {
    const dialog = await openModal()
    // après ajout, "Riz" apparaît dans le picker ET le récap → cibler le picker (1er dans le DOM)
    fireEvent.click(within(dialog).getAllByText('Riz')[0]) // ajoute
    expect(within(dialog).getByText(/RÉCAPITULATIF/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getAllByText('Riz')[0]) // retire (toggle)
    expect(within(dialog).queryByText(/RÉCAPITULATIF/)).not.toBeInTheDocument()
  })
})
