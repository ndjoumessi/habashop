import { describe, it, expect, vi } from 'vitest'
import { drawLogo } from '../lib/invoicePdf'

// drawLogo est désormais PARTAGÉ (facture + Ticket Z + PDF TVA). Ce test garde le
// contrat : il trace bien le Sac+H (tuile violette + anse or) et restaure l'état
// graphique (save/restore équilibrés → pas de fuite de transform sur le doc).
function mockDoc() {
  const calls: string[] = []
  const fills: string[] = []
  const strokes: string[] = []
  const doc: any = {}
  const chain = (name: string) => (...args: any[]) => {
    calls.push(name)
    if (name === 'fill') fills.push(String(args[0]))
    if (name === 'strokeColor') strokes.push(String(args[0]))
    return doc
  }
  for (const m of ['save', 'restore', 'translate', 'scale', 'roundedRect', 'path', 'lineWidth', 'lineCap', 'strokeColor', 'stroke', 'fill']) {
    doc[m] = vi.fn(chain(m))
  }
  return { doc, calls, fills, strokes }
}

describe('drawLogo — helper de marque partagé (Sac+H)', () => {
  it('trace la tuile violette + anse or et équilibre save/restore', () => {
    const { doc, calls, fills, strokes } = mockDoc()
    drawLogo(doc, 10, 20, 40)
    expect(calls.filter(c => c === 'save')).toHaveLength(1)
    expect(calls.filter(c => c === 'restore')).toHaveLength(1)
    expect(fills).toContain('#6C47FF')   // tuile + monogramme violets
    expect(fills).toContain('#FFFFFF')   // sac blanc
    expect(strokes).toContain('#F0A500') // anse or
  })
})
