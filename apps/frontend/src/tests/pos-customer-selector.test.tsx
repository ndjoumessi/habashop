import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mocks réseau (fixtures déterministes ; hoisted pour les factories vi.mock) ──
const { RESULTS, GET_CUSTOMER } = vi.hoisted(() => ({
  RESULTS: [
    { id: 'cust-1', name: 'Awa Diop',  phone: '+221770000001', loyaltyPoints: 1200, tier: 'Bronze' },
    { id: 'cust-2', name: 'Awa Faye',  phone: '+221770000002', loyaltyPoints: 5200, tier: 'Gold' },
  ],
  GET_CUSTOMER: { id: 'cust-9', name: 'Client QR', phone: '+221770000009' },
}))
vi.mock('@/lib/api', () => ({
  customersApi: {
    search: vi.fn().mockResolvedValue(RESULTS),
    get:    vi.fn().mockResolvedValue(GET_CUSTOMER),
  },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

// Le scanner caméra (@zxing, lazy) est remplacé par un bouton synthétique qui émet un texte QR.
vi.mock('@/components/ui/BarcodeScanner', () => ({
  default: ({ onScan }: { onScan: (t: string) => void }) => (
    <button onClick={() => onScan('HABA-CUST:cust-9')}>FAKE_SCAN</button>
  ),
}))

import POSCustomerSelector, { type LinkedCustomer } from '@/components/pos/POSCustomerSelector'
import { customersApi } from '@/lib/api'

function Harness({ enableLoyalty = true }: { enableLoyalty?: boolean }) {
  const [linked, setLinked] = useState<LinkedCustomer | null>(null)
  return (
    <POSCustomerSelector
      lang="fr"
      linkedCustomer={linked}
      setLinkedCustomer={setLinked}
      enableLoyalty={enableLoyalty}
      loyaltyPct={5}
      loyaltyTier={linked ? 'Bronze' : ''}
    />
  )
}

beforeEach(() => { vi.clearAllMocks() })

describe('POSCustomerSelector — sélecteur client inline POS', () => {
  it('recherche debouncée (≥2 chars) → liste les résultats avec palier', async () => {
    render(<Harness />)
    const input = screen.getByPlaceholderText(/Ajouter un client/)
    fireEvent.change(input, { target: { value: 'Aw' } })
    await waitFor(() => expect(customersApi.search).toHaveBeenCalledWith('Aw'), { timeout: 1000 })
    expect(await screen.findByText('Awa Diop')).toBeInTheDocument()
    expect(screen.getByText('Awa Faye')).toBeInTheDocument()
    // palier affiché (enableLoyalty)
    expect(screen.getByText('Bronze')).toBeInTheDocument()
    expect(screen.getByText('Or')).toBeInTheDocument()
  })

  it('ne cherche pas sous 2 caractères', async () => {
    render(<Harness />)
    fireEvent.change(screen.getByPlaceholderText(/Ajouter un client/), { target: { value: 'A' } })
    await new Promise(r => setTimeout(r, 400))
    expect(customersApi.search).not.toHaveBeenCalled()
  })

  it('sélection d’un résultat → chip client lié + bouton retirer', async () => {
    render(<Harness />)
    fireEvent.change(screen.getByPlaceholderText(/Ajouter un client/), { target: { value: 'Awa' } })
    fireEvent.click(await screen.findByText('Awa Diop'))
    // chip : nom + palier + remise
    await waitFor(() => expect(screen.getByText('Awa Diop')).toBeInTheDocument())
    expect(screen.getByText(/Bronze · −5%/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Retirer le client/)).toBeInTheDocument()
  })

  it('scan QR (HABA-CUST:id) → GET /api/customers/:id → client lié', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByTitle(/Scanner la carte fidélité/))
    fireEvent.click(await screen.findByText('FAKE_SCAN'))
    await waitFor(() => expect(customersApi.get).toHaveBeenCalledWith('cust-9'))
    expect(await screen.findByText('Client QR')).toBeInTheDocument()
  })

  it('retirer le client → revient au champ de recherche', async () => {
    render(<Harness />)
    fireEvent.change(screen.getByPlaceholderText(/Ajouter un client/), { target: { value: 'Awa' } })
    fireEvent.click(await screen.findByText('Awa Diop'))
    fireEvent.click(await screen.findByLabelText(/Retirer le client/))
    expect(await screen.findByPlaceholderText(/Ajouter un client/)).toBeInTheDocument()
  })
})
