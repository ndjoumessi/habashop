import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagination } from '../hooks/usePagination'
import { useI18n } from '../hooks/useI18n'
import { formatInCurrency, convertFromXOF, convertToXOF, VALID_THEMES } from '../stores/appStore'

// Mock appStore pour useI18n (on garde les vraies fonctions de conversion)
vi.mock('../stores/appStore', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useAppStore: vi.fn((selector: any) => {
      const mockStore = { lang: 'fr', currency: 'XOF', theme: 'dark' }
      return selector(mockStore)
    }),
  }
})

describe('useI18n hook', () => {
  it('Retourne la langue correcte', () => {
    const { result } = renderHook(() => useI18n())
    expect(result.current.lang).toBe('fr')
  })

  it('i() retourne fr par défaut', () => {
    const { result } = renderHook(() => useI18n())
    expect(result.current.i('Bonjour', 'Hello', 'Hola', 'Ciao')).toBe('Bonjour')
  })

  it('formatDate() formate correctement', () => {
    const { result } = renderHook(() => useI18n())
    const formatted = result.current.formatDate(new Date('2026-05-25'))
    expect(formatted).toContain('25')
    expect(formatted).toContain('05')
  })

  it('formatDateTime() inclut heure', () => {
    const { result } = renderHook(() => useI18n())
    const formatted = result.current.formatDateTime(new Date('2026-05-25T14:30:00'))
    expect(formatted).toBeDefined()
    expect(typeof formatted).toBe('string')
  })
})

describe('Currency — edge cases', () => {
  it('Montant 0 → formate correctement', () => {
    expect(formatInCurrency(0, 'XOF')).toBeDefined()
    expect(formatInCurrency(0, 'EUR')).toContain('€')
  })

  it('Gros montant XOF → format FR', () => {
    expect(formatInCurrency(1000000, 'XOF')).toContain('F')
  })

  it('Conversion aller-retour XOF→EUR→XOF', () => {
    const original = 655957
    const eur = convertFromXOF(original, 'EUR')
    const back = convertToXOF(eur, 'EUR')
    expect(Math.abs(back - original)).toBeLessThan(2)
  })

  it('GBP → XOF', () => {
    expect(convertToXOF(100, 'GBP')).toBe(76300)
  })

  it('CAD → XOF', () => {
    expect(convertToXOF(100, 'CAD')).toBe(44300)
  })
})

describe('usePagination — edge cases', () => {
  it('Page size 5', () => {
    const items = Array.from({ length: 15 }, (_, i) => i)
    const { result } = renderHook(() => usePagination(items, 5))
    expect(result.current.totalPages).toBe(3)
    expect(result.current.paginated.length).toBe(5)
  })

  it('Items = pageSize → 1 seule page', () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    const { result } = renderHook(() => usePagination(items, 10))
    expect(result.current.totalPages).toBe(1)
  })

  it('Items < pageSize → 1 seule page', () => {
    const items = Array.from({ length: 3 }, (_, i) => i)
    const { result } = renderHook(() => usePagination(items, 10))
    expect(result.current.totalPages).toBe(1)
    expect(result.current.paginated.length).toBe(3)
  })

  it('Navigation → page correcte', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ id: i }))
    const { result } = renderHook(() => usePagination(items, 10))
    act(() => result.current.onPage(2))
    expect(result.current.page).toBe(2)
    expect(result.current.paginated[0].id).toBe(10)
  })

  it('onPage(0) → reste à page 1', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    const { result } = renderHook(() => usePagination(items, 5))
    act(() => result.current.onPage(0))
    expect(result.current.page).toBe(1)
  })
})


describe('Thèmes', () => {
  /**
   * ⚠️ Ce cas déclarait `['dark','light','system']` puis vérifiait sa propre liste : si
   * un thème obsolète revenait dans `appStore`, il restait vert. Il LIT désormais
   * `VALID_THEMES`, seul endroit qui décide. C'est le seul des 7 cas autonomes de ce
   * fichier qui pouvait être rebranché sur la production ; les 6 autres sont supprimés.
   */
  it('3 thèmes valides, lus depuis appStore (Sombre / Clair / Système)', () => {
    expect(VALID_THEMES.size).toBe(3)
    expect(VALID_THEMES.has('dark')).toBe(true)
    expect(VALID_THEMES.has('light')).toBe(true)
    expect(VALID_THEMES.has('system')).toBe(true)
    // Les anciens thèmes ne doivent pas revenir (fallback gracieux du `merge`).
    for (const mort of ['gold', 'soleil', 'midnight', 'forest', 'ocean', 'sunset', 'darker']) {
      expect(VALID_THEMES.has(mort as never), `thème obsolète réintroduit : ${mort}`).toBe(false)
    }
  })
})

