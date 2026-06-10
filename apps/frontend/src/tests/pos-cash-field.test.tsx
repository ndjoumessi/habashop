import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/confirm', () => ({ confirm: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import POSCart from '@/components/pos/POSCart'

const PAY_MODES = [
  { id: 'cash',   label: 'Espèces', color: '#0EC47E' },
  { id: 'card',   label: 'Carte',   color: '#5B4EE8' },
  { id: 'wave',   label: 'Wave',    color: '#1DC4E9' },
  { id: 'orange', label: 'OM',      color: '#FF7900' },
  { id: 'mobile', label: 'Mobile',  color: '#7C6FF0' },
]

// Props minimales pour rendre POSCart en mode espèces (sans le sélecteur client → setLinkedCustomer omis).
function baseProps(over: Partial<any> = {}): any {
  return {
    lang: 'fr',
    cart: [{ id: 1, name: 'Riz', price: 4500, qty: 1, emoji: '🌾' }],
    setCart: vi.fn(),
    cashierSessionTx: 0, cashierSessionCA: 0, setShowCloseModal: vi.fn(),
    fmt: (n: number) => `${n} F`,
    discount: null, discountAmount: 0,
    totalHT: 4500, tva: 0, posTaxRate: 18, total: 4500,
    PAY_MODES, payMode: 'cash', setPayMode: vi.fn(),
    currencySymbol: 'F',
    cashGiven: '', setCashGiven: vi.fn(),
    monnaie: -4500,
    confirmSale: vi.fn(), setShowModal: vi.fn(), updateQty: vi.fn(),
    isMobile: false, mobileView: 'cart',
    mixedOn: false, setMixedOn: vi.fn(),
    mixedM1: 'cash', setMixedM1: vi.fn(), mixedM2: 'mobile', setMixedM2: vi.fn(),
    mixedAmt1: '', setMixedAmt1: vi.fn(), mixedAmt2XOF: 0, mixedValid: false,
    ...over,
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('POSCart — champ Montant reçu (clamp négatif + états)', () => {
  it('valeur négative → forcée à "0"', () => {
    const setCashGiven = vi.fn()
    render(<POSCart {...baseProps({ setCashGiven })} />)
    fireEvent.change(screen.getByLabelText(/Montant reçu du client/), { target: { value: '-7' } })
    expect(setCashGiven).toHaveBeenCalledWith('0')
  })

  it('valeur vide → "" (pas de NaN)', () => {
    const setCashGiven = vi.fn()
    render(<POSCart {...baseProps({ setCashGiven, cashGiven: '50' })} />)
    fireEvent.change(screen.getByLabelText(/Montant reçu du client/), { target: { value: '' } })
    expect(setCashGiven).toHaveBeenCalledWith('')
  })

  it('valeur positive valide → conservée telle quelle', () => {
    const setCashGiven = vi.fn()
    render(<POSCart {...baseProps({ setCashGiven })} />)
    fireEvent.change(screen.getByLabelText(/Montant reçu du client/), { target: { value: '12.5' } })
    expect(setCashGiven).toHaveBeenCalledWith('12.5')
  })

  it('touche "-" bloquée (preventDefault)', () => {
    render(<POSCart {...baseProps()} />)
    const evt = fireEvent.keyDown(screen.getByLabelText(/Montant reçu du client/), { key: '-' })
    // fireEvent renvoie false si un handler a appelé preventDefault
    expect(evt).toBe(false)
  })

  it('montant insuffisant (monnaie < 0) → message rouge', () => {
    render(<POSCart {...baseProps({ cashGiven: '1', monnaie: -3845 })} />)
    expect(screen.getByText(/Montant insuffisant/)).toBeInTheDocument()
    expect(screen.queryByText(/Monnaie à rendre/)).not.toBeInTheDocument()
  })

  it('montant suffisant (monnaie ≥ 0) → monnaie à rendre, pas de message rouge', () => {
    render(<POSCart {...baseProps({ cashGiven: '9999', monnaie: 5499 })} />)
    expect(screen.getByText(/Monnaie à rendre/)).toBeInTheDocument()
    expect(screen.queryByText(/Montant insuffisant/)).not.toBeInTheDocument()
  })
})
