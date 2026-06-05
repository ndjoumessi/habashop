import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoyaltyBar, loyaltyTier, loyaltyNextThreshold } from '@/components/customers/customersShared'
import { useAppStore } from '@/stores/appStore'

describe('helpers fidélité — seuils configurables', () => {
  it('loyaltyTier avec seuils custom', () => {
    expect(loyaltyTier(99, 100, 300)).toBe('Bronze')
    expect(loyaltyTier(100, 100, 300)).toBe('Silver')
    expect(loyaltyTier(300, 100, 300)).toBe('Gold')
  })
  it('loyaltyNextThreshold avec seuils custom', () => {
    expect(loyaltyNextThreshold(50, 100, 300)).toBe(100)
    expect(loyaltyNextThreshold(150, 100, 300)).toBe(300)
    expect(loyaltyNextThreshold(300, 100, 300)).toBeNull()
  })
  it('défauts 2000/5000 conservés (rétro-compat)', () => {
    expect(loyaltyTier(1999)).toBe('Bronze')
    expect(loyaltyTier(2000)).toBe('Silver')
    expect(loyaltyNextThreshold(1000)).toBe(2000)
  })
})

describe('LoyaltyBar — lit les seuils du tenant', () => {
  afterEach(() => useAppStore.setState({ tenant: null }))

  it('seuils tenant custom (100/300) → progression recalculée', () => {
    useAppStore.setState({ tenant: { id: 't1', name: 'X', plan: 'pro', currency: 'XOF', country: 'SN', vatRate: 18, bronzeThreshold: 100, silverThreshold: 300 } as any })
    render(<LoyaltyBar points={150} />)
    // 150 ≥ bronze 100 → prochain seuil = silver 300 → 150/300 = 50%
    expect(screen.getByText('50%')).toBeTruthy()
  })

  it('sans tenant → défauts 2000/5000', () => {
    useAppStore.setState({ tenant: null })
    render(<LoyaltyBar points={1000} />)
    expect(screen.getByText('50%')).toBeTruthy() // 1000/2000
  })
})
