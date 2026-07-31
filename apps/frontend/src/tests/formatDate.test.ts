import { describe, it, expect } from 'vitest'
import { fmtDate } from '@/lib/formatDate'

describe('fmtDate', () => {
  it('formate une date ISO en JJ/MM/AAAA (convention fr)', () => {
    expect(fmtDate('2026-05-05')).toBe('05/05/2026')
    expect(fmtDate('2026-12-31')).toBe('31/12/2026')
  })

  it('ne décale PAS le jour selon le fuseau (le bug de new Date(YYYY-MM-DD))', () => {
    // new Date('2026-01-01').toLocaleDateString() en UTC-x afficherait « 31/12/2025 ».
    // Le découpage de chaîne doit rendre le jour tel qu'écrit, quel que soit le fuseau.
    expect(fmtDate('2026-01-01')).toBe('01/01/2026')
  })

  it('accepte un ISO horodaté (garde la date, ignore l’heure)', () => {
    expect(fmtDate('2026-05-05T14:30:00Z')).toBe('05/05/2026')
  })

  it('null / vide → tiret, format inattendu → tel quel (jamais Invalid Date)', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate('')).toBe('—')
    expect(fmtDate('05/05/2026')).toBe('05/05/2026')
  })
})
