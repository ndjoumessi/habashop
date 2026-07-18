import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAppStore } from '@/stores/appStore'
import { generateInvoice, printableAmount } from '@/utils/export'

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

describe('printableAmount — normalisation du séparateur pour l\'impression (P0 « 2 /800 »)', () => {
  it('remplace U+202F (fine insécable Intl fr-FR) et U+00A0 par une espace simple', () => {
    expect(printableAmount('2\u202F800\u00A0FCFA')).toBe('2 800 FCFA')
  })
})

describe('generateInvoice — refonte (séparateur, statut, mentions légales, anti-XSS)', () => {
  afterEach(() => useAppStore.setState({ currency: 'XOF', tenant: null } as any))

  it('aucune espace fine U+202F dans le document (montants monospace normalisés)', () => {
    useAppStore.setState({ currency: 'XOF', posTaxRate: 18 } as any)
    const html = capturePdfHtml(() =>
      generateInvoice({ type: 'facture', lang: 'fr', items: [{ name: 'Riz', qty: 1, price: 12800 }] } as any),
    )
    expect(html).not.toMatch(/\u202F/)
    expect(html).toContain('12 800 FCFA') // espace SIMPLE U+0020
  })

  it('facture avec paymentMode → statut « Payée » ; devis → « En attente »', () => {
    useAppStore.setState({ currency: 'XOF', posTaxRate: 18 } as any)
    const facture = capturePdfHtml(() =>
      generateInvoice({ type: 'facture', lang: 'fr', paymentMode: 'Espèces', customer: { name: 'Awa' }, items: [{ name: 'Riz', qty: 1, price: 1000 }] } as any))
    expect(facture).toContain('Payée')
    const devis = capturePdfHtml(() =>
      generateInvoice({ type: 'devis', lang: 'fr', customer: { name: 'Awa' }, items: [{ name: 'Riz', qty: 1, price: 1000 }] } as any))
    expect(devis).toContain('En attente')
    expect(devis).not.toContain('Payée')
  })

  it('mentions légales : omises sans champs tenant, présentes si configurées', () => {
    useAppStore.setState({ currency: 'XOF', posTaxRate: 18, tenant: null } as any)
    const sans = capturePdfHtml(() =>
      generateInvoice({ type: 'facture', lang: 'fr', items: [{ name: 'Riz', qty: 1, price: 1000 }] } as any))
    expect(sans).not.toContain('NINEA')
    useAppStore.setState({ tenant: { id: 't', ninea: '00123', rccm: 'SN-DKR-2026' } } as any)
    const avec = capturePdfHtml(() =>
      generateInvoice({ type: 'facture', lang: 'fr', items: [{ name: 'Riz', qty: 1, price: 1000 }] } as any))
    expect(avec).toContain('NINEA 00123')
    expect(avec).toContain('RC SN-DKR-2026')
  })

  it('anti-XSS : nom client et article échappés', () => {
    useAppStore.setState({ currency: 'XOF', posTaxRate: 18 } as any)
    const html = capturePdfHtml(() =>
      generateInvoice({ type: 'facture', lang: 'fr', customer: { name: '<img src=x onerror=alert(1)>' }, items: [{ name: '<script>bad</script>', qty: 1, price: 1000 }] } as any))
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>bad')
    expect(html).toContain('&lt;script&gt;bad')
  })

  it('SANS client → bloc « FACTURÉ À » entièrement masqué (pas de « — »), pill à droite conservée', () => {
    useAppStore.setState({ currency: 'XOF', posTaxRate: 18 } as any)
    const html = capturePdfHtml(() =>
      generateInvoice({ type: 'facture', lang: 'fr', paymentMode: 'Espèces', items: [{ name: 'Riz', qty: 1, price: 1000 }] } as any))
    expect(html).not.toContain('FACTURÉ À')
    expect(html).not.toContain('>—<') // aucun tiret nu comme valeur
    expect(html).toContain('Payée')   // statut toujours présent
  })

  it('AVEC client → « FACTURÉ À » + nom présents', () => {
    useAppStore.setState({ currency: 'XOF', posTaxRate: 18 } as any)
    const html = capturePdfHtml(() =>
      generateInvoice({ type: 'facture', lang: 'fr', paymentMode: 'Espèces', customer: { name: 'Awa Diop' }, items: [{ name: 'Riz', qty: 1, price: 1000 }] } as any))
    expect(html).toContain('FACTURÉ À')
    expect(html).toContain('Awa Diop')
  })

  it('bloc structure maquette : FACTURÉ À, Sous-total HT, Total TTC, filet violet', () => {
    useAppStore.setState({ currency: 'XOF', posTaxRate: 18 } as any)
    const html = capturePdfHtml(() =>
      generateInvoice({ type: 'facture', lang: 'fr', customer: { name: 'Awa Diop', phone: '+221 77 123 45 67' }, items: [{ name: 'Riz', qty: 2, price: 4500 }] } as any))
    expect(html).toContain('FACTURÉ À')
    expect(html).toContain('Sous-total HT')
    expect(html).toContain('Total TTC')
    expect(html).toContain('border-bottom:2px solid #6C47FF') // filet violet sous l'en-tête de table
    expect(html).toContain('Merci de votre confiance')
  })
})
