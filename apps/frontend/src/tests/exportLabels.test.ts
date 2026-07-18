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

  it('(b) sans code EAN : zone repliée — aucun code NI mention sur l’étiquette (face client)', () => {
    printProductLabels([{ name: 'Vrac', sku: 'PRD-0004', price: 300, barcode: '' }], fmt, baseOpts)
    // Aucun appel JsBarcode (ni EAN ni CODE128) pour un produit sans code valide.
    expect(jsbarcodeMock).not.toHaveBeenCalled()
    expect(written).not.toContain('CODE128')
    expect(written).not.toContain('Code interne')       // plus de badge trompeur
    expect(written).not.toContain('Code-barres manquant') // plus de diagnostic sur l'étiquette
    // Le nom + le prix restent imprimés (étiquette de prix propre).
    expect(written).toContain('Vrac')
    expect(written).toContain('300 F')
  })

  it('⚠️ QUIET ZONES ≥10 modules (marges horizontales) — Avery', () => {
    printProductLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    const opts = jsbarcodeMock.mock.calls.at(-1)![2] as unknown as Record<string, number>
    expect(opts.marginLeft / opts.width).toBeGreaterThanOrEqual(10)
    expect(opts.marginRight / opts.width).toBeGreaterThanOrEqual(10)
  })

  it('prix en NOIR gras (pas le violet écran) — lisible en N&B + pas d’encre couleur', () => {
    printProductLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    // Le prix est le bloc inline font-weight:900 → doit être noir, jamais le violet
    // écran (#5B4EE8). (Le violet reste légitime dans le chrome de la fenêtre d'impression.)
    expect(written).toContain('font-weight:900;color:#000;')
    expect(written).not.toContain('font-weight:900;color:#5B4EE8')
  })

  it('nom long : 2 lignes (line-clamp) + taille réduite, PAS de troncature à 20 car.', () => {
    const name = 'Lait concentré sucré 397g GLORIA' // 32 car. (> 24)
    printProductLabels([{ name, sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    expect(written).toContain(name)                    // nom complet (grammage conservé)
    expect(written).not.toContain('397g GLORI...')     // plus de coupe à 20 car.
    expect(written).toContain('-webkit-line-clamp:2')  // borné à 2 lignes
    // baseOpts = medium (fontSize 12) → nom long réduit à 9px pour tenir.
    expect(written).toContain('font-size:9px;font-weight:700')
  })

  it('nom court : taille pleine (pas de réduction inutile)', () => {
    printProductLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    expect(written).toContain('font-size:12px;font-weight:700')
  })

  it('aucun émoji sur l’étiquette (redondant avec le produit, gris pâle en N&B)', () => {
    printProductLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931', emoji: '🥛' }], fmt, baseOpts)
    expect(written).not.toContain('🥛') // émoji custom non imprimé
    expect(written).not.toContain('📦') // ni le générique par défaut
  })

  it('🟡 aucune dépendance CDN externe dans la fenêtre d’impression', () => {
    printProductLabels([{ name: 'Lait', sku: 'PRD-0001', price: 900, barcode: '4006381333931' }], fmt, baseOpts)
    expect(written).not.toContain('cdn.jsdelivr.net')
    expect(written).not.toContain('<script')
  })
})
