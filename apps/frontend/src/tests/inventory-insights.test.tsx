import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import InventoryInsights from '@/components/reports/InventoryInsights'

vi.mock('@/lib/api', () => ({ reportsApi: { inventory: vi.fn() } }))
import { reportsApi } from '@/lib/api'

const fmt = (n: number) => `${n} F`

beforeEach(() => { vi.clearAllMocks() })

describe('InventoryInsights — 2 sections', () => {
  it('rend réappro (vélocité/suggestion) + dormants (valeur immobilisée)', async () => {
    ;(reportsApi.inventory as any).mockResolvedValue({
      reorder: [{ id: 'p1', name: 'Riz parfumé', category: 'Épicerie', stock: 2, threshold: 5, velocity30d: 8, suggestedQty: 6 }],
      dormant: [{ id: 'p3', name: 'Bougie déco', category: 'Maison', stock: 20, buyPrice: 200, immobilizedValue: 4000, lastSale: '2026-03-06T00:00:00Z', daysSinceSale: 90 }],
      dormantDays: 60, generatedAt: '2026-06-04T00:00:00Z',
    })
    render(<InventoryInsights fmt={fmt} lang="fr" />)
    expect(await screen.findByText('À réapprovisionner')).toBeTruthy()
    expect(screen.getByText('Riz parfumé')).toBeTruthy()
    expect(screen.getByText('≈ 6')).toBeTruthy()            // suggestion de réappro
    expect(screen.getByText('Produits dormants')).toBeTruthy()
    expect(screen.getByText('Bougie déco')).toBeTruthy()
    expect(screen.getByText('4000 F')).toBeTruthy()         // valeur immobilisée mise en avant
  })

  it('états vides : aucun à réappro / aucun dormant', async () => {
    ;(reportsApi.inventory as any).mockResolvedValue({ reorder: [], dormant: [], dormantDays: 60, generatedAt: '2026-06-04T00:00:00Z' })
    render(<InventoryInsights fmt={fmt} lang="fr" />)
    expect(await screen.findByText(/Aucun produit sous le seuil/)).toBeTruthy()
    expect(screen.getByText(/Aucun stock dormant/)).toBeTruthy()
  })

  it('erreur de chargement → message d’erreur', async () => {
    ;(reportsApi.inventory as any).mockRejectedValue(new Error('boom'))
    render(<InventoryInsights fmt={fmt} lang="fr" />)
    expect(await screen.findByText(/Impossible de charger/)).toBeTruthy()
  })
})
