import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock jsPDF : instance capturant les appels de dessin/pages.
const { pdfInst, jsPDFCtor } = vi.hoisted(() => {
  const inst = {
    internal: { pageSize: { getWidth: () => 40, getHeight: () => 30 } },
    setFont: vi.fn(), setFontSize: vi.fn(), setTextColor: vi.fn(),
    text: vi.fn(), addImage: vi.fn(), addPage: vi.fn(), autoPrint: vi.fn(),
    output: vi.fn(() => 'blob:fake-url'), save: vi.fn(),
    // Simule le retour à la ligne de jsPDF : ~26 caractères par ligne à la largeur
    // 38 mm (heuristique de test ; le vrai jsPDF coupe sur les espaces).
    splitTextToSize: vi.fn((t: string) => {
      const s = String(t), per = 26, out: string[] = []
      for (let k = 0; k < s.length; k += per) out.push(s.slice(k, k + per))
      return out.length ? out : ['']
    }),
  }
  return { pdfInst: inst, jsPDFCtor: vi.fn(function () { return inst }) }
})
vi.mock('jspdf', () => ({ jsPDF: jsPDFCtor }))
// Mock jsbarcode : capture les options pour vérifier les quiet zones (canvas stubé).
const { jsbarcodeMock } = vi.hoisted(() => ({ jsbarcodeMock: vi.fn() }))
vi.mock('jsbarcode', () => ({ default: jsbarcodeMock }))

import { printThermalLabels } from '@/utils/thermalLabel'

const fmt = (n: number) => `${n} F`
const baseOpts = { showPrice: true, showSku: true, showBarcode: true, copies: 1, shopName: 'Boutique', lang: 'fr' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAA')
  vi.spyOn(window, 'open').mockReturnValue({} as unknown as Window)
})

describe('printThermalLabels — PDF 40×30 mm', () => {
  it('page au format EXACT 40×30 mm (paysage) + autoPrint + ouverture', async () => {
    await printThermalLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    expect(jsPDFCtor).toHaveBeenCalledWith(expect.objectContaining({ unit: 'mm', format: [40, 30], orientation: 'landscape' }))
    expect(pdfInst.autoPrint).toHaveBeenCalled()
    expect(pdfInst.output).toHaveBeenCalledWith('bloburl')
    expect(window.open).toHaveBeenCalled()
  })

  it('code-barres rendu en image (EAN-13 valide) → addImage, pas de « Code interne »', async () => {
    await printThermalLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    expect(pdfInst.addImage).toHaveBeenCalledWith('data:image/png;base64,AAA', 'PNG', expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number))
    const texts = pdfInst.text.mock.calls.map(c => c[0])
    expect(texts).not.toContain('Code interne')
  })

  it('⚠️ QUIET ZONES ≥10 modules (marges horizontales) — thermique', async () => {
    await printThermalLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    const opts = jsbarcodeMock.mock.calls.at(-1)![2] as Record<string, number>
    expect(opts.marginLeft / opts.width).toBeGreaterThanOrEqual(10)
    expect(opts.marginRight / opts.width).toBeGreaterThanOrEqual(10)
  })

  it('(b) sans code EAN → zone repliée : pas d’image, pas de mention (face client) ; nom+prix restent', async () => {
    await printThermalLabels([{ name: 'Vrac', sku: 'PRD-0004', price: 300, barcode: '' }], fmt, baseOpts)
    expect(pdfInst.addImage).not.toHaveBeenCalled()
    const texts = pdfInst.text.mock.calls.map(c => c[0])
    expect(texts).not.toContain('Code interne')
    expect(texts).not.toContain('Code-barres manquant')
    expect(texts).toContain('Vrac')       // nom conservé
    expect(texts).toContain('300 F')      // prix conservé (remonté)
  })

  it('nom long : rendu sur 2 lignes, grammage conservé (pas de troncature avant 2 lignes)', async () => {
    // 31 car. > ancien seuil 26 → jadis « …397g » coupé. Doit tenir sur 2 lignes SANS ellipse.
    await printThermalLabels([{ name: 'Lait concentré sucré 397g GLORIA', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    const texts = pdfInst.text.mock.calls.map(c => String(c[0]))
    expect(texts.some(t => t.includes('397g'))).toBe(true)   // info discriminante conservée
    expect(texts.every(t => !t.includes('…'))).toBe(true)     // aucune troncature
    // barcode toujours dans la cellule (image rendue), prix ancré en bas.
    expect(pdfInst.addImage).toHaveBeenCalled()
    expect(texts).toContain('900 F')
  })

  it('nom très long : max 2 lignes, ellipse SEULEMENT au-delà', async () => {
    const long = 'Concentré de tomate double extra qualité supérieure bocal familial 500g'
    await printThermalLabels([{ name: long, sku: 'PRD-0002', price: 500, barcode: '4006381333931' }], fmt, baseOpts)
    const texts = pdfInst.text.mock.calls.map(c => String(c[0]))
    // Le nom est rendu en premier → texts[0], texts[1] = les 2 lignes ; la 2e finit par …
    expect(texts[1]).toMatch(/…$/)
    // Jamais une 3e ligne de nom : la ligne suivante n'est pas un fragment du nom.
    expect(texts[2]?.startsWith('qualité') ?? false).toBe(false)
  })

  it('copies = une page par étiquette (produits × copies)', async () => {
    await printThermalLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, { ...baseOpts, copies: 3 })
    // 3 étiquettes → 1re page implicite + 2 addPage.
    expect(pdfInst.addPage).toHaveBeenCalledTimes(2)
    expect(pdfInst.addPage).toHaveBeenCalledWith([40, 30], 'landscape')
  })

  it('popup bloqué → repli téléchargement', async () => {
    (window.open as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(null)
    await printThermalLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    expect(pdfInst.save).toHaveBeenCalled()
  })

  it('aucun produit → ne génère rien', async () => {
    await printThermalLabels([], fmt, baseOpts)
    expect(pdfInst.autoPrint).not.toHaveBeenCalled()
  })
})
