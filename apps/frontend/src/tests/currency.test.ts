import { describe, it, expect } from 'vitest'
import { formatInCurrency, convertFromXOF, convertToXOF } from '../stores/appStore'

describe('Currency conversion', () => {
  it('XOF → XOF = identique', () => {
    expect(convertFromXOF(100000, 'XOF')).toBe(100000)
  })

  it('XOF → EUR (taux 655.957)', () => {
    expect(Math.round(convertFromXOF(655957, 'EUR'))).toBe(1000)
  })

  it('EUR → XOF (inverse)', () => {
    // 100 EUR * 655.957 = 65595.7
    expect(convertToXOF(100, 'EUR')).toBeCloseTo(65595.7, 1)
  })

  it('XOF → USD (taux 602)', () => {
    expect(Math.round(convertFromXOF(60200, 'USD'))).toBe(100)
  })

  it('formatInCurrency XOF — pas de décimales', () => {
    const r = formatInCurrency(100000, 'XOF')
    expect(r).toContain('F')
    expect(r).not.toContain('.')
  })

  it('formatInCurrency EUR — symbole € + décimales', () => {
    const r = formatInCurrency(655957, 'EUR')
    expect(r).toContain('€')
    expect(r).toContain(',')
  })

  it('formatInCurrency GBP — symbole £', () => {
    expect(formatInCurrency(76300, 'GBP')).toContain('£')
  })
})

describe('formatInCurrency edge cases', () => {
  it('Montant 0', () => {
    expect(formatInCurrency(0, 'XOF')).toContain('0')
  })
  it('Montant négatif', () => {
    expect(formatInCurrency(-100000, 'XOF')).toBeDefined()
  })
  it('Devise inconnue → fallback', () => {
    expect(formatInCurrency(100000, 'XXX')).toBeDefined()
  })
})
