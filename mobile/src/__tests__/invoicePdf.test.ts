import { invoiceEndpoint, invoiceCacheName } from '@/services/invoicePdf'

// Verrouille le contrat backend + le nommage du fichier temporaire (cache, jetable).
describe('invoicePdf helpers', () => {
  it('endpoint backend de la facture', () => {
    expect(invoiceEndpoint('abc123')).toBe('/api/sales/abc123/invoice')
  })
  it('nom de fichier cache horodaté (pas d’écrasement)', () => {
    expect(invoiceCacheName('abc123', 1717600000000)).toBe('facture-abc123-1717600000000.pdf')
    // deux horodatages différents → deux fichiers distincts
    expect(invoiceCacheName('s', 1)).not.toBe(invoiceCacheName('s', 2))
  })
})
