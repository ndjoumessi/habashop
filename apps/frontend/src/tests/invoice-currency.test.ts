import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAppStore } from '@/stores/appStore'
import { generateInvoice } from '@/utils/export'

// Capture le HTML écrit dans la fenêtre PDF (openPDF → window.open().document.write).
function capturePdfHtml(run: () => void): string {
  const writes: string[] = []
  const spy = vi.spyOn(window, 'open').mockReturnValue({
    document: { write: (s: string) => { writes.push(s) }, close: () => {} },
  } as unknown as Window)
  run()
  spy.mockRestore()
  return writes.join('')
}

describe('generateInvoice — conversion XOF → devise tenant (fix bug « 2800 EUR »)', () => {
  afterEach(() => useAppStore.setState({ currency: 'XOF' } as any))

  it('article 2800 XOF, tenant EUR → affiche 4,27 € (2800 ÷ 655,957), PAS 2800 EUR', () => {
    useAppStore.setState({ currency: 'EUR', posTaxRate: 18 } as any)
    const html = capturePdfHtml(() =>
      generateInvoice({ type: 'facture', lang: 'fr', items: [{ name: 'Café', qty: 1, price: 2800 }] } as any),
    )
    expect(html).toContain('4,27')            // montant converti
    expect(html).not.toMatch(/2\s?800\s*EUR/) // jamais le XOF brut étiqueté EUR
  })

  it('tenant XOF → 2800 reste 2 800 FCFA (pas de conversion, devise de base)', () => {
    useAppStore.setState({ currency: 'XOF', posTaxRate: 18 } as any)
    const html = capturePdfHtml(() =>
      generateInvoice({ type: 'facture', lang: 'fr', items: [{ name: 'Café', qty: 1, price: 2800 }] } as any),
    )
    expect(html).toMatch(/2\s?800\s*FCFA/)
  })
})
