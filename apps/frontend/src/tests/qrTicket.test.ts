import { describe, it, expect, vi, beforeEach } from 'vitest'
import { qrSvg } from '@/lib/qrSvg'

/**
 * Le QR du TICKET DE CAISSE. C'est le papier que le client emporte réellement : la facture
 * A4 est générée à la demande par le commerçant et ne part souvent jamais avec l'acheteur.
 *
 * Les deux propriétés qui décident si un code est lisible — zone de silence et contraste —
 * sont vérifiées sur la sortie RÉELLE de `QRCode.create`, pas sur une matrice simulée.
 */

const URL = 'https://habashop.vercel.app/f/clx1a2b3c4d5e6f7g8h9i0j1~8lSWmANFa9O3jNQt'

/** Rectangles et segments de chemin, en unités de module (le viewBox). */
function geometrie(svg: string) {
  const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
  const segments = [...svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)]
    .map(m => ({ x: +m[1], y: +m[2], w: +m[3] }))
  return { total: viewBox ? +viewBox[1] : 0, segments }
}

describe('qrSvg — ce qui rend un code lisible sur du papier thermique', () => {
  it('⚠️ zone de silence de 4 modules RÉSERVÉE — sans elle, le code est illisible', () => {
    const { total, segments } = geometrie(qrSvg(URL, '22mm'))
    expect(segments.length).toBeGreaterThan(10)
    expect(Math.min(...segments.map(s => s.x))).toBeGreaterThanOrEqual(4)
    expect(Math.min(...segments.map(s => s.y))).toBeGreaterThanOrEqual(4)
    expect(Math.max(...segments.map(s => s.x + s.w))).toBeLessThanOrEqual(total - 4)
    expect(Math.max(...segments.map(s => s.y + 1))).toBeLessThanOrEqual(total - 4)
  })

  it('⚠️ noir sur blanc OPAQUE — un scanner mesure un contraste, il ne résout pas de jeton CSS', () => {
    const svg = qrSvg(URL, '22mm')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('fill="#000000"')
    expect(svg).not.toContain('var(--')
    expect(svg).not.toContain('transparent')
  })

  it('modules fusionnés en bandes : bien moins de segments que de modules noirs', () => {
    const { segments } = geometrie(qrSvg(URL, '22mm'))
    const modulesNoirs = segments.reduce((n, s) => n + s.w, 0)
    expect(segments.length).toBeLessThan(modulesNoirs / 2)
  })

  it('⚠️ SYNCHRONE — un `await` avant `window.open` ferait bloquer la fenêtre d’impression', () => {
    const r: unknown = qrSvg(URL, '22mm')
    expect(typeof r).toBe('string')
    expect(r).not.toBeInstanceOf(Promise)
  })

  it('la taille demandée est celle de la boîte TOTALE, zone de silence comprise', () => {
    expect(qrSvg(URL, '22mm')).toContain('width="22mm" height="22mm"')
  })
})

/* ─────────── le ticket lui-même ─────────── */

const { createSpy } = vi.hoisted(() => ({ createSpy: vi.fn() }))
vi.mock('qrcode', async (importReal) => {
  const real = await importReal<typeof import('qrcode')>()
  const impl = (real as unknown as { default?: typeof import('qrcode') }).default ?? real
  return {
    default: {
      ...impl,
      // ⚠️ Délégation au vrai encodeur : sans elle on prouverait le mock, pas l'encodage.
      create: (text: string, opts?: Parameters<typeof impl.create>[1]) => {
        createSpy(text); return impl.create(text, opts)
      },
    },
  }
})

import { printTicket } from '@/components/pos/posTicket'

/**
 * Capture le HTML écrit dans la fenêtre d'impression, sans ouvrir quoi que ce soit.
 *
 * ⚠️ `close()` n'est pas un corps vide de complaisance : sans `document.close()`, la fenêtre
 * reste en chargement et n'imprime jamais. On enregistre donc l'appel, et on l'asserte.
 */
let documentFerme = false
function imprimer(publicUrl: string | null): string {
  let html = ''
  documentFerme = false
  const faux = { document: { write: (h: string) => { html = h }, close: () => { documentFerme = true } } }
  vi.spyOn(window, 'open').mockReturnValue(faux as unknown as Window)
  printTicket({
    lang: 'fr', locale: 'fr-FR',
    cart: [{ id: 'p1', name: 'Riz 5kg', price: 4500, qty: 1 } as never],
    discount: null, discountAmount: 0,
    totalHT: 3814, tva: 686, posTaxRate: 18, total: 4500,
    payMode: 'cash', cashGiven: '5000', currency: 'XOF', monnaie: 500,
    fmt: (n: number) => `${n} FCFA`,
    publicUrl,
  })
  return html
}

beforeEach(() => { vi.clearAllMocks() })

describe('printTicket — le QR sur le ticket de caisse', () => {
  it('⚠️ lien fourni → QR encodé avec CETTE URL, et l’invite est imprimée', () => {
    const html = imprimer(URL)
    expect(createSpy).toHaveBeenCalledWith(URL)
    expect(html).toContain('<svg')
    expect(html).toContain('Votre reçu en ligne')
  })

  it('⚠️ aucun lien (réimpression, ou serveur sans secret) → AUCUN QR, et le ticket sort quand même', () => {
    const html = imprimer(null)
    expect(createSpy).not.toHaveBeenCalled()
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('Votre reçu en ligne')
    // Le reste du ticket est intact : pas de QR n'est pas pas de ticket.
    expect(html).toContain('Riz 5kg')
    expect(html).toContain('4500 FCFA')
  })

  it('le document d’impression est FERMÉ — sans quoi la fenêtre reste en chargement', () => {
    imprimer(URL)
    expect(documentFerme).toBe(true)
  })

  it('⚠️ le QR ne reconstruit JAMAIS l’URL : il imprime exactement ce que le serveur a signé', () => {
    const autre = 'https://habashop.vercel.app/f/autre-vente~ZZZZZZZZZZZZZZZZ'
    imprimer(autre)
    expect(createSpy).toHaveBeenCalledWith(autre)
    expect(createSpy).not.toHaveBeenCalledWith(URL)
  })
})
