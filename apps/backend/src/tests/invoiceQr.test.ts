import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * QR code du pied de facture : il ne s'imprime QUE si un client est rattaché à la vente,
 * il encode l'URL publique qu'on lui donne, et sa géométrie reste imprimable.
 *
 * La sortie pdfkit est un buffer binaire — on mocke `PDFDocument` pour CAPTURER les appels
 * de tracé (même motif qu'`invoiceBilledTo.test.ts`), et on intercepte `QRCode.create` en
 * DÉLÉGUANT au module réel : sans délégation on prouverait le mock, pas l'encodage, et un
 * `modules.size` figé masquerait une zone de silence disparue.
 */

type Rect = { x: number; y: number; w: number; h: number }
const drawnTexts: string[] = []
const rects: Rect[] = []
const lines: number[] = []

vi.mock('pdfkit', () => {
  class FakeDoc {
    private endCb: (() => void) | null = null
    on(evt: string, cb: (...a: unknown[]) => void) { if (evt === 'end') this.endCb = cb; return this }
    text(s: string) { drawnTexts.push(String(s)); return this }
    rect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h }); return this }
    moveTo(_x: number, y: number) { lines.push(y); return this }
    fillColor() { return this }
    font() { return this }
    fontSize() { return this }
    roundedRect() { return this }
    circle() { return this }
    fill() { return this }
    fillAndStroke() { return this }
    stroke() { return this }
    strokeColor() { return this }
    lineWidth() { return this }
    lineCap() { return this }
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

const encoded: string[] = []
vi.mock('qrcode', async (importReal) => {
  const real = await importReal<typeof import('qrcode')>()
  const impl = (real as unknown as { default?: typeof import('qrcode') }).default ?? real
  return {
    default: {
      ...impl,
      create: (text: string, opts?: Parameters<typeof impl.create>[1]) => {
        encoded.push(String(text))
        return impl.create(text, opts) // ⚠️ délégation : le vrai encodeur tourne
      },
    },
  }
})

import { buildInvoicePdf, type InvoiceSale, type InvoiceTenant } from '../lib/invoicePdf'

const SALE: InvoiceSale = {
  id: 's1', total: 5900, paymentMode: 'cash', discountAmount: 0,
  createdAt: new Date('2026-07-18T10:00:00Z'), invoiceNumber: 'FAC-2026-00001',
  items: [{ qty: 2, unitPrice: 2950, total: 5900, product: { name: 'Bifaka' } }],
}
const TENANT: InvoiceTenant = { name: 'Ma Boutique', currency: 'XOF', vatRate: 18, lang: 'fr' }
const CUSTOMER = { name: 'Awa Diop', phone: '+221 77 123 45 67' }
const URL = 'https://exemple.test/f/s1~AbCdEfGhIjKlMnOp'

/** Rectangles du QR : ceux tracés DANS la bande du pied (le reste du PDF n'en pose pas). */
const qrRects = () => rects.filter(r => r.y >= 700)

beforeEach(() => { drawnTexts.length = 0; rects.length = 0; lines.length = 0; encoded.length = 0 })

describe('buildInvoicePdf — le QR code n’existe que s’il y a quelqu’un pour le scanner', () => {
  it('client rattaché + URL → QR encodé avec CETTE URL, et l’invite est imprimée', async () => {
    await buildInvoicePdf(SALE, TENANT, CUSTOMER, URL)
    expect(encoded).toEqual([URL])
    expect(qrRects().length).toBeGreaterThan(10)
    expect(drawnTexts).toContain('Votre facture en ligne')
    expect(drawnTexts.some(t => t.startsWith('Scannez ce code'))).toBe(true)
  })

  it('vente de passage (aucun client) → AUCUN QR, aucune invite', async () => {
    await buildInvoicePdf(SALE, TENANT, null, URL)
    expect(encoded).toEqual([])
    expect(qrRects()).toEqual([])
    expect(drawnTexts).not.toContain('Votre facture en ligne')
  })

  it('aucun secret posé en amont (URL nulle) → AUCUN QR, et la facture se rend quand même', async () => {
    const pdf = await buildInvoicePdf(SALE, TENANT, CUSTOMER, null)
    expect(encoded).toEqual([])
    expect(qrRects()).toEqual([])
    expect(pdf).toBeInstanceOf(Buffer)
  })

  it('le pied SANS QR garde sa géométrie d’origine (filet à 742)', async () => {
    await buildInvoicePdf(SALE, TENANT, null, URL)
    expect(lines).toContain(742)
    expect(lines).not.toContain(706)
  })
})

describe('buildInvoicePdf — géométrie imprimable du QR', () => {
  it('⚠️ zone de silence de 4 modules RÉSERVÉE dans la boîte (sans elle, code illisible)', async () => {
    await buildInvoicePdf(SALE, TENANT, CUSTOMER, URL)
    const r = qrRects()
    const size = 66
    const boxX = 50
    const boxY = 716
    // `QRCode.create` réel → on dérive le nombre de modules de la largeur du plus petit
    // rectangle (un module isolé). La marge attendue vaut 4 modules, de chaque côté.
    const cell = Math.min(...r.map(x => x.w))
    const quiet = 4 * cell
    expect(Math.min(...r.map(x => x.x))).toBeGreaterThanOrEqual(boxX + quiet - 0.01)
    expect(Math.min(...r.map(x => x.y))).toBeGreaterThanOrEqual(boxY + quiet - 0.01)
    expect(Math.max(...r.map(x => x.x + x.w))).toBeLessThanOrEqual(boxX + size - quiet + 0.01)
    expect(Math.max(...r.map(x => x.y + x.h))).toBeLessThanOrEqual(boxY + size - quiet + 0.01)
  })

  it('le code tient dans la marge basse A4 (792 pt) — il ne mord pas sur le bord', async () => {
    await buildInvoicePdf(SALE, TENANT, CUSTOMER, URL)
    expect(Math.max(...qrRects().map(r => r.y + r.h))).toBeLessThanOrEqual(792)
  })

  it('modules fusionnés en bandes : bien moins de rectangles que de modules noirs', async () => {
    await buildInvoicePdf(SALE, TENANT, CUSTOMER, URL)
    const r = qrRects()
    const cell = Math.min(...r.map(x => x.w))
    const modulesNoirs = r.reduce((n, x) => n + Math.round(x.w / cell), 0)
    expect(r.length).toBeLessThan(modulesNoirs / 2)
  })
})

describe('buildInvoicePdf — l’invite est traduite (jamais un libellé français en 4 langues)', () => {
  it.each([
    ['en', 'Your invoice online'],
    ['es', 'Su factura en línea'],
    ['it', 'La tua fattura online'],
  ])('lang=%s → « %s »', async (lang, attendu) => {
    await buildInvoicePdf(SALE, { ...TENANT, lang }, CUSTOMER, URL)
    expect(drawnTexts).toContain(attendu)
  })
})
