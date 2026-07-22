import type Anthropic from '@anthropic-ai/sdk'
import { createMessage, SpendDeniedError } from '../lib/spend/anthropicClient'

export interface InvoiceItem {
  name: string
  qty: number
  unitPrice: number
}

export interface InvoiceOcrResult {
  supplierName: string | null
  invoiceDate: string | null
  items: InvoiceItem[]
  total: number | null
  notes: string | null
  error?: string
  rawText?: string
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
export const ALLOWED_INVOICE_TYPES = [...IMAGE_TYPES, 'application/pdf']

const PROMPT = `Tu es un expert OCR pour les factures commerciales en Afrique de l'Ouest et en Europe.
Analyse cette facture/bon de livraison et extrais les informations au format JSON strict.

Retourne UNIQUEMENT un objet JSON valide, sans markdown, sans explication :
{
  "supplierName": "nom du fournisseur ou null",
  "invoiceDate": "date au format YYYY-MM-DD ou null",
  "items": [
    { "name": "nom du produit", "qty": 1, "unitPrice": 0 }
  ],
  "total": 0,
  "notes": "conditions, délai, références ou null"
}

Règles :
- qty et unitPrice sont des nombres (jamais des chaînes)
- Si un champ est absent ou illisible, mettre null (sauf items qui peut être [])
- Pour unitPrice : montant numérique brut dans la devise de la facture
- notes : concatène ref commande, conditions de paiement, délai de livraison`

export async function analyzeInvoice(tenantId: string, buffer: Buffer, mimeType: string): Promise<InvoiceOcrResult> {
  const base64 = buffer.toString('base64')

  let contentBlock: Anthropic.ImageBlockParam | Record<string, unknown>
  if (IMAGE_TYPES.includes(mimeType)) {
    contentBlock = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: base64,
      },
    }
  } else {
    contentBlock = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    } as any
  }

  const requestOpts: Anthropic.MessageCreateParamsNonStreaming & { betas?: string[] } = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [contentBlock as any, { type: 'text', text: PROMPT }],
    }],
  }
  if (mimeType === 'application/pdf') {
    (requestOpts as any).betas = ['pdfs-2024-09-25']
  }

  // Le quota OCR est réservé ICI, juste avant l'appel réel : un fichier trop lourd,
  // un format refusé ou un rôle insuffisant n'atteignent jamais ce point et ne
  // consomment donc rien.
  const res = await createMessage({ tenantId, kind: 'ocr', params: requestOpts })
  if (!res.ok) throw new SpendDeniedError(res.code, res.error)
  const response = res.message

  const text: string = (response.content[0] as Anthropic.TextBlock).text?.trim() ?? ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { supplierName: null, invoiceDate: null, items: [], total: null, notes: null, error: 'parse_error', rawText: text }
  }

  try {
    return JSON.parse(jsonMatch[0]) as InvoiceOcrResult
  } catch {
    return { supplierName: null, invoiceDate: null, items: [], total: null, notes: null, error: 'parse_error', rawText: text }
  }
}
