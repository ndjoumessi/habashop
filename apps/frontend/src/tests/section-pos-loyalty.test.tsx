import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// tenantApi mocké : get charge un tenant avec fidélité activée + seuils.
const { TENANT } = vi.hoisted(() => ({
  TENANT: { enableLoyalty: true, pointsPerAmount: 1000, bronzeThreshold: 2000, silverThreshold: 5000, vatRate: 18, posDefaultFund: 0, priceMode: 'TTC', posVatIncluded: true, posAutoprint: false, autoWhatsApp: false, requireCashier: false, enableScanner: false },
}))
vi.mock('@/lib/api', () => ({
  tenantApi: { get: vi.fn().mockResolvedValue(TENANT), update: vi.fn().mockResolvedValue({}) },
}))
import SectionPOS from '@/components/settings/SectionPOS'
import { useAppStore } from '@/stores/appStore'

beforeEach(() => {
  useAppStore.setState({ enableLoyalty: true } as any)
})

describe('SectionPOS — config fidélité', () => {
  it('programme activé → 3 champs + note « prochaines ventes »', async () => {
    render(<SectionPOS />)
    expect(await screen.findByText(/Règles de fidélité/)).toBeTruthy()
    expect(screen.getByText(/Seuil Bronze/)).toBeTruthy()
    expect(screen.getByText(/Seuil Silver/)).toBeTruthy()
    expect(screen.getByText(/1 point pour chaque/)).toBeTruthy()
    expect(screen.getByText(/prochaines ventes uniquement/)).toBeTruthy()
  })

  it('validation inline : seuil Bronze ≥ Silver → message d’erreur', async () => {
    render(<SectionPOS />)
    await screen.findByText(/Règles de fidélité/)
    // passe en mode édition
    fireEvent.click(screen.getByText(/Modifier/))
    // sélection robuste à l'ordre DOM (groupes Tickets/Caisse/Fidélité/Prix & TVA) : le champ bronze porte la valeur seedée 2000
    const spins = await screen.findAllByRole('spinbutton')
    const bronze = spins.find(s => (s as HTMLInputElement).value === '2000')!
    fireEvent.change(bronze, { target: { value: '6000' } }) // bronze 6000 ≥ silver 5000
    await waitFor(() => {
      expect(screen.getByText(/doit être inférieur au seuil Silver/)).toBeTruthy()
    })
  })

  it('programme désactivé → bloc fidélité masqué', async () => {
    const { tenantApi } = await import('@/lib/api')
    ;(tenantApi.get as any).mockResolvedValueOnce({ ...TENANT, enableLoyalty: false })
    useAppStore.setState({ enableLoyalty: false } as any)
    render(<SectionPOS />)
    // attend le chargement (un label POS toujours présent)
    await screen.findByText(/Configuration POS/)
    expect(screen.queryByText(/Règles de fidélité/)).toBeNull()
  })
})
