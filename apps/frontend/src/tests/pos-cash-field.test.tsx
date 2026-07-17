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

describe('POSCashField — raccourcis adaptés à la devise', () => {
  it('devise sans décimales (XOF) → pas 1000/5000/10000', () => {
    render(<POSCashField {...baseProps({ totalDisplay: 11400, currencyDecimals: 0 })} />)
    expect(screen.getByRole('button', { name: 'Exact' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^12\s000$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^15\s000$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^20\s000$/ })).toBeInTheDocument()
  })

  it('devise à décimales (EUR) → pas 5/10/50, pas de coupures CFA', () => {
    render(<POSCashField {...baseProps({ totalDisplay: 13.14, currencyDecimals: 2, currencySymbol: '€' })} />)
    expect(screen.getByRole('button', { name: 'Exact' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '50' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^1\s000$/ })).not.toBeInTheDocument()
  })

  it('défaut (prop absente) → comportement XOF historique', () => {
    render(<POSCashField {...baseProps({ totalDisplay: 700 })} />)
    expect(screen.getByRole('button', { name: /^1\s000$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^5\s000$/ })).toBeInTheDocument()
  })

  it('arrondi déjà atteint (total = coupure) → pas de doublon', () => {
    render(<POSCashField {...baseProps({ totalDisplay: 10, currencyDecimals: 2 })} />)
    // exact = 10 ; ups 10 filtré (pas > exact) → Exact, 50 uniquement
    expect(screen.getByRole('button', { name: 'Exact' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '50' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '10' })).not.toBeInTheDocument()
  })
})
