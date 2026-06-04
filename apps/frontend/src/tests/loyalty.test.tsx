import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoyaltyBar, loyaltyTier, loyaltyNextThreshold } from '@/components/customers/customersShared'

// LoyaltyCard fait un fetch loyaltyApi.get au montage → on le mocke.
vi.mock('@/lib/api', () => ({
  loyaltyApi: { get: vi.fn().mockResolvedValue({ points: 100, tier: 'Bronze', history: [] }) },
}))
import LoyaltyCard from '@/components/ui/LoyaltyCard'

describe('paliers fidélité (helpers)', () => {
  it('tier sur seuils 2000/5000', () => {
    expect(loyaltyTier(1999)).toBe('Bronze')
    expect(loyaltyTier(2000)).toBe('Silver')
    expect(loyaltyTier(5000)).toBe('Gold')
  })
  it('prochain seuil', () => {
    expect(loyaltyNextThreshold(500)).toBe(2000)
    expect(loyaltyNextThreshold(2000)).toBe(5000)
    expect(loyaltyNextThreshold(5000)).toBeNull() // Gold = plus de palier
  })
})

describe('LoyaltyBar — progression vers le PROCHAIN palier (plus de max=1000)', () => {
  it('1000 pts → 50% vers Silver (2000)', () => {
    render(<LoyaltyBar points={1000} />)
    expect(screen.getByText('50%')).toBeTruthy()
  })
  it('4000 pts → 80% vers Gold (5000)', () => {
    render(<LoyaltyBar points={4000} />)
    expect(screen.getByText('80%')).toBeTruthy()
  })
  it('Gold (≥5000) → 100% (pas de palier suivant)', () => {
    render(<LoyaltyBar points={6000} />)
    expect(screen.getByText('100%')).toBeTruthy()
  })
})

describe('LoyaltyCard — texte HONNÊTE v1', () => {
  it('aucune promesse de remise 5%/10% ; mention « à venir » ; gain 1 pt/1000', () => {
    render(<LoyaltyCard customer={{ id: 'c1', name: 'Test', loyaltyPoints: 100 }} onClose={() => {}} />)
    // plus aucune PROMESSE de remise chiffrée (anciennes lignes 5%/10% retirées)
    expect(screen.queryByText(/remise de \d|\d\s*% discount|descuento|sconto del \d/i)).toBeNull()
    // récompenses annoncées comme à venir
    expect(screen.getByText(/à venir|coming soon|próximamente|in arrivo/i)).toBeTruthy()
    // règle de gain affichée (1 point par tranche)
    expect(screen.getByText(/1 point par tranche|1 point per|1 punto por cada|1 punto ogni/i)).toBeTruthy()
  })
})
