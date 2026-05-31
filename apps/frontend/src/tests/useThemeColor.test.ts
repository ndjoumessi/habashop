import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveThemeColor } from '@/hooks/useThemeColor'

// Résolution JS d'une couleur de thème (pour attribut SVG recharts). On mocke
// getComputedStyle → getPropertyValue pour des assertions déterministes.
const mockVar = (value: string) => {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: () => value,
  } as unknown as CSSStyleDeclaration)
}

afterEach(() => { vi.restoreAllMocks() })

describe('resolveThemeColor', () => {
  it('valeur résolue → retournée (trim)', () => {
    mockVar('  #2a2a3e  ')
    expect(resolveThemeColor('--border', 'rgba(128,128,128,.3)')).toBe('#2a2a3e')
  })

  it('valeur rgba résolue → retournée', () => {
    mockVar('rgba(255,255,255,.08)')
    expect(resolveThemeColor('--border', 'fb')).toBe('rgba(255,255,255,.08)')
  })

  it('valeur vide/absente → fallback', () => {
    mockVar('')
    expect(resolveThemeColor('--border', 'rgba(128,128,128,.3)')).toBe('rgba(128,128,128,.3)')
    mockVar('   ')
    expect(resolveThemeColor('--text3', '#888')).toBe('#888')
  })
})
