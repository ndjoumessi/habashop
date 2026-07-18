import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock jsbarcode : au lieu de rendre, on marque l'élément avec la valeur+format
// reçus → on peut vérifier CE QUI est encodé (le 🔴 : barcode réellement transmis).
const { jsbarcodeMock } = vi.hoisted(() => ({
  jsbarcodeMock: vi.fn((el: Element, value: string, opts: { format: string }) => {
    el.setAttribute('data-rendered', `${value}:${opts.format}`)
  }),
}))
vi.mock('jsbarcode', () => ({ default: jsbarcodeMock }))

import { printProductLabels } from '@/utils/export'

const fmt = (n: number) => `${n} F`
const baseOpts = {
  size: 'medium' as const,
  showPrice: true, showSku: true, showBarcode: true,
  copies: 1, shopName: 'Ma Boutique', lang: 'fr',
  averyPreset: 'L7160' as const,
}

let written = ''
beforeEach(() => {
  written = ''
  jsbarcodeMock.mockClear()
  const fakeWin = { document: { write: (s: string) => { written += s }, close: () => {} } }
  vi.spyOn(window, 'open').mockReturnValue(fakeWin as unknown as Window)
})

describe('printProductLabels — impression étiquettes', () => {
  it('EAN-13 persisté : encodé en EAN13 (🔴 barcode transmis), pas de badge « Code interne »', () => {
    printProductLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    expect(jsbarcodeMock).toHaveBeenCalledWith(expect.anything(), '4006381333931', expect.objectContaining({ format: 'EAN13' }))
    expect(written).toContain('data-rendered="4006381333931:EAN13"')
    expect(written).not.toContain('Code interne')
  })

  it('EAN-8 : encodé en EAN8', () => {
    printProductLabels([{ name: 'Sardines', sku: 'PRD-0002', price: 500, barcode: '96385074' }], fmt, baseOpts)
    expect(jsbarcodeMock).toHaveBeenCalledWith(expect.anything(), '96385074', expect.objectContaining({ format: 'EAN8' }))
  })

  it('UPC-A hérité (12 ch.) : canonicalisé → EAN13', () => {
    printProductLabels([{ name: 'Import', sku: 'PRD-0003', price: 500, barcode: '036000291452' }], fmt, baseOpts)
    expect(jsbarcodeMock).toHaveBeenCalledWith(expect.anything(), '0036000291452', expect.objectContaining({ format: 'EAN13' }))
  })

  it('sans code fabricant : CODE128 sur le SKU + badge « Code interne »', () => {
    printProductLabels([{ name: 'Vrac', sku: 'PRD-0004', price: 300, barcode: '' }], fmt, baseOpts)
    expect(jsbarcodeMock).toHaveBeenCalledWith(expect.anything(), 'PRD-0004', expect.objectContaining({ format: 'CODE128' }))
    expect(written).toContain('Code interne')
  })

  it('🟡 aucune dépendance CDN externe dans la fenêtre d’impression', () => {
    printProductLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    expect(written).not.toContain('cdn.jsdelivr.net')
    expect(written).not.toContain('<script')
  })
})
