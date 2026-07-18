import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock jsbarcode : on capture les OPTIONS pour vérifier les quiet zones.
const { jsbarcodeMock } = vi.hoisted(() => ({ jsbarcodeMock: vi.fn() }))
vi.mock('jsbarcode', () => ({ default: jsbarcodeMock }))

import { BarcodeVignette } from '@/components/stock/StockModals'

beforeEach(() => { jsbarcodeMock.mockClear() })

describe('BarcodeVignette — vignette code-barres fiche produit', () => {
  it('⚠️ QUIET ZONES ≥10 modules bakées dans le SVG (marges horizontales)', () => {
    render(<BarcodeVignette value="4006381333931" lang="fr" />)
    expect(jsbarcodeMock).toHaveBeenCalled()
    const opts = jsbarcodeMock.mock.calls.at(-1)![2] as Record<string, number>
    const moduleWidth = opts.width // largeur d'un module (px)
    // Silence latéral ≥ 10 modules de CHAQUE côté (contrainte scanner non négociable).
    expect(opts.marginLeft / moduleWidth).toBeGreaterThanOrEqual(10)
    expect(opts.marginRight / moduleWidth).toBeGreaterThanOrEqual(10)
    // Fond clair + barres sombres (lisibilité scanner).
    expect(opts.background).toBe('#FFFFFF')
    expect(opts.lineColor).toBe('#000000')
  })

  it('canonicalise UPC-A (12) → EAN-13 (13) avant rendu', () => {
    render(<BarcodeVignette value="036000291452" lang="fr" />)
    const [, value, opts] = jsbarcodeMock.mock.calls.at(-1)!
    expect(value).toBe('0036000291452')
    expect((opts as { format: string }).format).toBe('EAN13')
  })

  it('badge format détecté affiché (EAN-13 / EAN-8)', () => {
    const { rerender } = render(<BarcodeVignette value="4006381333931" lang="fr" />)
    expect(screen.getByText('EAN-13')).toBeTruthy()
    rerender(<BarcodeVignette value="96385074" lang="fr" />)
    expect(screen.getByText('EAN-8')).toBeTruthy()
  })

  it('vignette cliquable = copie (chiffres non répétés) + retour « Copié »', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<BarcodeVignette value="4006381333931" lang="fr" />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toContain('4006381333931')
    fireEvent.click(btn)
    expect(writeText).toHaveBeenCalledWith('4006381333931')
    expect(await screen.findByText('Copié')).toBeTruthy()
  })

  it('code invalide → rien (pas de vignette trompeuse)', () => {
    const { container } = render(<BarcodeVignette value="12345" lang="fr" />)
    expect(container.querySelector('button')).toBeNull()
    expect(jsbarcodeMock).not.toHaveBeenCalled()
  })
})
