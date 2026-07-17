import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Champ « Montant reçu » — vit dans la feuille d'encaissement (POSModals) depuis
// l'item 11 ; extrait en composant POSCashField pour rester testable unitairement.
import POSCashField from '@/components/pos/POSCashField'

function baseProps(over: Partial<any> = {}): any {
  return {
    lang: 'fr',
    cashGiven: '',
    setCashGiven: vi.fn(),
    monnaie: -4500,
    currencySymbol: 'F',
    fmt: (n: number) => `${n} F`,
    ...over,
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('POSCashField — champ Montant reçu (clamp négatif + états)', () => {
  it('valeur négative → forcée à "0"', () => {
    const setCashGiven = vi.fn()
    render(<POSCashField {...baseProps({ setCashGiven })} />)
    fireEvent.change(screen.getByLabelText(/Montant reçu du client/), { target: { value: '-7' } })
    expect(setCashGiven).toHaveBeenCalledWith('0')
  })

  it('valeur vide → "" (pas de NaN)', () => {
    const setCashGiven = vi.fn()
    render(<POSCashField {...baseProps({ setCashGiven, cashGiven: '50' })} />)
    fireEvent.change(screen.getByLabelText(/Montant reçu du client/), { target: { value: '' } })
    expect(setCashGiven).toHaveBeenCalledWith('')
  })

  it('valeur positive valide → conservée telle quelle', () => {
    const setCashGiven = vi.fn()
    render(<POSCashField {...baseProps({ setCashGiven })} />)
    fireEvent.change(screen.getByLabelText(/Montant reçu du client/), { target: { value: '12.5' } })
    expect(setCashGiven).toHaveBeenCalledWith('12.5')
  })

  it('touche "-" bloquée (preventDefault)', () => {
    render(<POSCashField {...baseProps()} />)
    const evt = fireEvent.keyDown(screen.getByLabelText(/Montant reçu du client/), { key: '-' })
    // fireEvent renvoie false si un handler a appelé preventDefault
    expect(evt).toBe(false)
  })

  it('montant insuffisant (monnaie < 0) → message rouge', () => {
    render(<POSCashField {...baseProps({ cashGiven: '1', monnaie: -3845 })} />)
    expect(screen.getByText(/Montant insuffisant/)).toBeInTheDocument()
    expect(screen.queryByText(/Rendu monnaie/)).not.toBeInTheDocument()
  })

  it('montant suffisant (monnaie ≥ 0) → monnaie à rendre, pas de message rouge', () => {
    render(<POSCashField {...baseProps({ cashGiven: '9999', monnaie: 5499 })} />)
    expect(screen.getByText(/Rendu monnaie/)).toBeInTheDocument()
    expect(screen.queryByText(/Montant insuffisant/)).not.toBeInTheDocument()
  })
})
