import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
    beta = { messages: { create: mockCreate } }
    constructor(_opts: unknown) {}
  },
}))

import { analyzeInvoice } from '../services/invoiceOcr'

function makeResponse(text: string) {
  return { content: [{ type: 'text', text }] }
}

const VALID_JSON = JSON.stringify({
  supplierName: 'Diallo & Frères',
  invoiceDate: '2024-03-15',
  items: [
    { name: 'Riz 25kg', qty: 10, unitPrice: 15000 },
    { name: 'Huile 5L', qty: 5, unitPrice: 4500 },
  ],
  total: 172500,
  notes: 'Paiement sous 30 jours',
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
})

describe('analyzeInvoice — parsing', () => {
  it('parse une réponse JSON valide', async () => {
    mockCreate.mockResolvedValue(makeResponse(VALID_JSON))
    const result = await analyzeInvoice(Buffer.from('fake-image'), 'image/jpeg')
    expect(result.supplierName).toBe('Diallo & Frères')
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ name: 'Riz 25kg', qty: 10, unitPrice: 15000 })
    expect(result.total).toBe(172500)
    expect(result.error).toBeUndefined()
  })

  it('strip les balises markdown autour du JSON', async () => {
    const wrapped = '```json\n' + VALID_JSON + '\n```'
    mockCreate.mockResolvedValue(makeResponse(wrapped))
    const result = await analyzeInvoice(Buffer.from('fake-image'), 'image/png')
    expect(result.supplierName).toBe('Diallo & Frères')
    expect(result.error).toBeUndefined()
  })

  it('retourne { error, rawText } si aucun JSON dans la réponse', async () => {
    mockCreate.mockResolvedValue(makeResponse('Impossible de lire cette image.'))
    const result = await analyzeInvoice(Buffer.from('fake-image'), 'image/jpeg')
    expect(result.error).toBe('parse_error')
    expect(result.rawText).toBe('Impossible de lire cette image.')
    expect(result.items).toEqual([])
    expect(result.supplierName).toBeNull()
  })

  it('retourne { error, rawText } si le JSON est malformé', async () => {
    mockCreate.mockResolvedValue(makeResponse('{ "supplierName": "X", "items": [BROKEN'))
    const result = await analyzeInvoice(Buffer.from('fake-image'), 'image/jpeg')
    expect(result.error).toBe('parse_error')
    expect(result.items).toEqual([])
  })
})

describe('analyzeInvoice — erreurs réseau', () => {
  it('propage l\'erreur Anthropic', async () => {
    mockCreate.mockRejectedValue(new Error('Network timeout'))
    await expect(analyzeInvoice(Buffer.from('img'), 'image/jpeg')).rejects.toThrow('Network timeout')
  })

  it('lance si ANTHROPIC_API_KEY est absente', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(analyzeInvoice(Buffer.from('img'), 'image/jpeg')).rejects.toThrow('ANTHROPIC_API_KEY')
  })
})

describe('analyzeInvoice — taille fichier', () => {
  it('traite un buffer de taille normale (< 10MB)', async () => {
    mockCreate.mockResolvedValue(makeResponse(VALID_JSON))
    const buf = Buffer.alloc(1024)
    const result = await analyzeInvoice(buf, 'image/jpeg')
    expect(result.supplierName).toBe('Diallo & Frères')
  })
})
