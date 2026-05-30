import { describe, it, expect } from 'vitest'
import { buildMonths, monthLabel } from '@/pages/Payroll'

describe('Payroll — clé de mois : année réelle, jamais codée en dur', () => {
  it('buildMonths(year) emploie l’année passée (2027) — aucun 2026 résiduel', () => {
    const m = buildMonths(2027)
    expect(m).toHaveLength(12)
    expect(m[0]).toBe('Janvier 2027')
    expect(m[4]).toBe('Mai 2027')
    expect(m[11]).toBe('Décembre 2027')
    expect(m.some(x => x.includes('2026'))).toBe(false)
  })

  it('buildMonths suit l’année courante (dynamique)', () => {
    const y = new Date().getFullYear()
    expect(buildMonths(y)[new Date().getMonth()]).toBe(`${['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][new Date().getMonth()]} ${y}`)
  })

  it('monthLabel localise le mois ET conserve l’année réelle de la clé (passage à 2027)', () => {
    expect(monthLabel('Mai 2027', 'fr')).toBe('Mai 2027')
    expect(monthLabel('Mai 2027', 'en')).toBe('May 2027')          // mois localisé (pas "Mai") + bonne année
    expect(monthLabel('Janvier 2027', 'en')).toBe('January 2027')
    expect(monthLabel('Mai 2027', 'es')).toContain('2027')
    expect(monthLabel('Mai 2027', 'it')).toContain('2027')
  })
})
