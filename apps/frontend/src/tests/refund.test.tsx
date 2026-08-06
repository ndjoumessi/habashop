import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RefundModal from '@/components/pos/RefundModal'
import POSProductGrid from '@/components/pos/POSProductGrid'

const fmt = (n: number) => `${n} F`
const SALE = { id: 'abcdef123456', total: 1000, paymentMode: 'cash', items: [{ qty: 1, unitPrice: 1000, total: 1000, product: { name: 'Riz' } }] }

describe('RefundModal', () => {
  it('confirmer ACTIF ; le motif manquant est nommé ; restock PRÉ-COCHÉ', () => {
    const onConfirm = vi.fn()
    render(<RefundModal sale={SALE} onClose={() => {}} onConfirm={onConfirm} saving={false} lang="fr" fmt={fmt} />)
    const confirm = screen.getByRole('button', { name: /Confirmer le remboursement/ })
    // ⚠️ Le CTA n'est plus éteint par la validation : il NOMME le motif manquant au clic.
    // Un bouton désactivé gronde avant l'erreur et n'explique rien au toucher.
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(screen.getByText(/Il manque encore/)).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Produit défectueux' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    // restock pré-coché → true par défaut
    expect(onConfirm).toHaveBeenCalledWith('Produit défectueux', true)
  })

  it('décocher « remettre en stock » → onConfirm avec restock=false', () => {
    const onConfirm = vi.fn()
    render(<RefundModal sale={SALE} onClose={() => {}} onConfirm={onConfirm} saving={false} lang="fr" fmt={fmt} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Marchandise abîmée' } })
    fireEvent.click(screen.getByText(/Remettre les articles en stock/))
    fireEvent.click(screen.getByRole('button', { name: /Confirmer le remboursement/ }))
    expect(onConfirm).toHaveBeenCalledWith('Marchandise abîmée', false)
  })

  it('note Wave/Orange affichée pour paiement mobile, masquée pour cash', () => {
    const { rerender } = render(<RefundModal sale={{ ...SALE, paymentMode: 'wave' }} onClose={() => {}} onConfirm={() => {}} saving={false} lang="fr" fmt={fmt} />)
    expect(screen.getByText(/SUIVI dans l/)).toBeTruthy()
    rerender(<RefundModal sale={SALE} onClose={() => {}} onConfirm={() => {}} saving={false} lang="fr" fmt={fmt} />)
    expect(screen.queryByText(/SUIVI dans l/)).toBeNull()
  })

  it('sale=null → ne rend rien', () => {
    const { container } = render(<RefundModal sale={null} onClose={() => {}} onConfirm={() => {}} saving={false} lang="fr" fmt={fmt} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('POSProductGrid — action remboursement par rôle', () => {
  const baseProps: any = {
    posTab: 'history', setPosTab: () => {}, fetchHistory: () => {},
    lang: 'fr', activeCat: 'all', setActiveCat: () => {}, search: '', setSearch: () => {},
    posEnableScanner: false, setShowScanner: () => {}, clientType: 'retail', setClientType: () => {},
    setShowDiscountModal: () => {}, discount: null, setDiscount: () => {}, fmt,
    filtered: [], cart: [], addItem: () => {}, getPrice: () => 0, posShowStockOnTile: false,
    loadingHistory: false, salesHistory: [SALE],
    isMobile: false, mobileView: 'products', totalProducts: 0, loadingProducts: false, navigate: () => {},
  }

  it('manager/admin (canRefund) → bouton « Rembourser » visible', () => {
    render(<POSProductGrid {...baseProps} canRefund={true} onRefundClick={() => {}} />)
    expect(screen.getByRole('button', { name: /Rembourser/ })).toBeTruthy()
  })

  it('caissier (canRefund=false) → action MASQUÉE', () => {
    render(<POSProductGrid {...baseProps} canRefund={false} onRefundClick={() => {}} />)
    expect(screen.queryByRole('button', { name: /Rembourser/ })).toBeNull()
  })

  it('clic « Rembourser » → onRefundClick(sale)', () => {
    const onRefundClick = vi.fn()
    render(<POSProductGrid {...baseProps} canRefund={true} onRefundClick={onRefundClick} />)
    fireEvent.click(screen.getByRole('button', { name: /Rembourser/ }))
    expect(onRefundClick).toHaveBeenCalledWith(SALE)
  })

  it('vente déjà remboursée → badge « Remboursé », pas de bouton (même pour admin)', () => {
    render(<POSProductGrid {...baseProps} canRefund={true} onRefundClick={() => {}} salesHistory={[{ ...SALE, status: 'refunded' }]} />)
    expect(screen.getByText('Remboursé')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Rembourser$/ })).toBeNull()
  })
})
