import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Store mock : POS lit useAppStore() sans sélecteur + plusieurs hooks dérivés ──
const { mockState } = vi.hoisted(() => ({
  mockState: {
    lang: 'fr', currency: 'XOF',
    cashierOpen: true, cashierOpenedAt: new Date('2026-05-30T08:00:00Z').toISOString(),
    cashierOpeningFund: 50000, cashierSessionTx: 0, cashierSessionCA: 0,
    openCashier: vi.fn(), closeCashier: vi.fn(), addCashierSale: vi.fn(),
    posTaxRate: 18, posShowStockOnTile: true, posDefaultFund: 50000,
    posDefaultPayment: 'cash', priceMode: 'TTC', posVatIncluded: true, posAutoprint: false,
    requireCashier: true, // ce test couvre le flux d'ouverture de caisse → la config l'exige
    enableScanner: true, autoWhatsApp: false,
    cart: [] as any[], addCartItem: vi.fn(), updateCartQty: vi.fn(), setCart: vi.fn(), clearCart: vi.fn(),
  },
}))
vi.mock('@/stores/appStore', () => ({
  useAppStore: () => mockState,
  useFormatAmount: () => (n: number) => `${n} F`,
  useConvertToXOF: () => (n: number) => n,
  useConvertFromXOF: () => (n: number) => n,
  useCurrencyInfo: () => ({ symbol: 'F' }),
  formatCurrency: (n: number) => `${n} F`,
  formatInCurrency: (n: number) => `${n} F`,
  convertAmount: (n: number) => n,
  t: (k: string) => k,
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: any) => sel({ user: { name: 'Marie', id: 'u1' } }),
}))
vi.mock('@/lib/api', () => ({
  productsApi: { list: vi.fn().mockResolvedValue([
    { id: 1, name: 'Riz parfumé 5kg', sellPrice: 4500, category: 'cereals', emoji: '🌾', stockQty: 120 },
  ]) },
  salesApi: { list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}) },
  whatsappApi: { sendTicket: vi.fn().mockResolvedValue({}) },
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/utils/export', () => ({ generateInvoice: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

// Stubs légers des 3 enfants déjà extraits — on teste l'orchestration du conteneur
vi.mock('@/components/pos/POSProductGrid', () => ({
  default: (props: any) => (
    <div data-testid="grid">
      <span>grid:{props.filtered.length}</span>
      {props.filtered[0] && <button onClick={() => props.addItem(props.filtered[0])}>stub-add</button>}
    </div>
  ),
}))
vi.mock('@/components/pos/POSCart', () => ({
  default: (props: any) => (
    <div data-testid="cart">
      <span>cart:{props.cart.length}</span>
      <span>total:{props.total}</span>
      <button onClick={props.confirmSale}>stub-confirm</button>
    </div>
  ),
}))
vi.mock('@/components/pos/POSModals', () => ({ default: () => <div data-testid="modals" /> }))

import POS from '@/pages/POS'

beforeEach(() => {
  vi.clearAllMocks()
  mockState.cashierOpen = true
  mockState.cart = []
})

describe('POS — test d’ancrage (orchestration conteneur)', () => {
  it('caisse fermée → écran d’ouverture, le bouton ouvre la caisse avec le fond saisi', async () => {
    mockState.cashierOpen = false
    render(<POS />)
    expect(screen.getByText('Caisse fermée')).toBeInTheDocument()
    const input = screen.getByPlaceholderText('Ex: 50 000')
    fireEvent.change(input, { target: { value: '75000' } })
    fireEvent.click(screen.getByText('Ouvrir la caisse'))
    expect(mockState.openCashier).toHaveBeenCalledWith(75000)
  })

  it('caisse ouverte → grille + panier rendus, le catalogue charge les produits', async () => {
    render(<POS />)
    await waitFor(() => expect(screen.getByText('grid:1')).toBeInTheDocument())
    expect(screen.getByTestId('cart')).toBeInTheDocument()
  })

  it('ajouter un produit → addCartItem appelé', async () => {
    render(<POS />)
    await waitFor(() => expect(screen.getByText('stub-add')).toBeInTheDocument())
    fireEvent.click(screen.getByText('stub-add'))
    expect(mockState.addCartItem).toHaveBeenCalled()
  })

  it('garde-fou cash : montant reçu insuffisant → erreur, pas de vente', async () => {
    const { salesApi } = await import('@/lib/api') as any
    const toast = (await import('react-hot-toast')).default as any
    mockState.cart = [{ id: 1, name: 'Riz', price: 4500, qty: 1, emoji: '🌾' }]
    render(<POS />)
    await waitFor(() => expect(screen.getByText('stub-confirm')).toBeInTheDocument())
    expect(screen.getByText('total:4500')).toBeInTheDocument()
    fireEvent.click(screen.getByText('stub-confirm'))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(salesApi.create).not.toHaveBeenCalled()
  })
})
