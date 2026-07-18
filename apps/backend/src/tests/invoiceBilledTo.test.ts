import { describe, it, expect, vi, beforeEach } from 'vitest'

// La sortie pdfkit est un buffer binaire compressé → on ne peut pas y grep « FACTURÉ À ».
// On mocke PDFDocument pour CAPTURER les chaînes passées à .text() et asserter dessus.
const drawnTexts: string[] = []
vi.mock('pdfkit', () => {
  class FakeDoc {
    private endCb: (() => void) | null = null
    on(evt: string, cb: (...a: any[]) => void) { if (evt === 'end') this.endCb = cb; return this }
    text(s: string) { drawnTexts.push(String(s)); return this }
    // toutes les autres méthodes pdfkit utilisées → chaînables, sans effet
    fillColor() { return this }
    font() { return this }
    fontSize() { return this }
    roundedRect() { return this }
    rect() { return this }
    circle() { return this }
    fill() { return this }
    fillAndStroke() { return this }
    stroke() { return this }
    strokeColor() { return this }
    lineWidth() { return this }
    lineCap() { return this }
    moveTo() { return this }
    lineTo() { return this }
    path() { return this }
    save() { return this }
    restore() { return this }
    translate() { return this }
    scale() { return this }
    end() { this.endCb?.() }
  }
  return { default: FakeDoc }
})

import { buildInvoicePdf, type InvoiceSale, type InvoiceTenant } from '../lib/invoicePdf'

const SALE: InvoiceSale = {
  id: 's1', total: 5900, paymentMode: 'cash', discountAmount: 0,
  createdAt: new Date('2026-07-18T10:00:00Z'), invoiceNumber: 'FAC-2026-00001',
  items: [{ qty: 2, unitPrice: 2950, total: 5900, product: { name: 'Bifaka' } }],
}
const TENANT: InvoiceTenant = { name: 'Ma Boutique', currency: 'XOF', vatRate: 18, lang: 'fr' }

beforeEach(() => { drawnTexts.length = 0 })

describe('buildInvoicePdf — bloc « FACTURÉ À » conditionnel (vente de passage)', () => {
  it('AVEC client → « FACTURÉ À » présent + nom du client', async () => {
    await buildInvoicePdf(SALE, TENANT, { name: 'Awa Diop', phone: '+221 77 123 45 67' })
    expect(drawnTexts).toContain('FACTURÉ À')
    expect(drawnTexts).toContain('Awa Diop')
    expect(drawnTexts).toContain('+221 77 123 45 67')
  })

  it('SANS client → bloc entièrement masqué (ni libellé, ni « — »)', async () => {
    await buildInvoicePdf(SALE, TENANT, null)
    expect(drawnTexts).not.toContain('FACTURÉ À')
    expect(drawnTexts).not.toContain('—')
    // La pill de statut reste dessinée (indépendante du client)
    expect(drawnTexts).toContain('Payée')
  })

  it('SANS client (en) → « BILLED TO » absent, statut « Paid » présent', async () => {
    await buildInvoicePdf(SALE, { ...TENANT, lang: 'en' }, null)
    expect(drawnTexts).not.toContain('BILLED TO')
    expect(drawnTexts).toContain('Paid')
  })
})
