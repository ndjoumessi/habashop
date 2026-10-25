import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { invoiceToken, parseInvoiceToken, invoicePublicUrl } from '../lib/invoiceLink'

/**
 * Jeton du QR code de facture. Le papier remis au client EST l'accès : si le sceau se
 * laisse retirer, deviner ou recalculer sans le secret, n'importe qui lit les factures
 * de n'importe quelle boutique en énumérant des cuid.
 */

const SALE = 'clx1a2b3c4d5e6f7g8h9i0j1'
const ENV = { ...process.env }

beforeEach(() => {
  delete process.env.INVOICE_LINK_SECRET
  process.env.JWT_SECRET = 'secret-de-session-pour-les-tests'
  process.env.FRONTEND_URL = 'https://exemple.test'
})
afterEach(() => { process.env = { ...ENV } })

describe('invoiceLink — aller-retour', () => {
  it('un jeton émis se relit sur le même identifiant', () => {
    const t = invoiceToken(SALE)
    expect(t).toBeTruthy()
    expect(parseInvoiceToken(t)).toBe(SALE)
  })

  it('le jeton porte l’identifiant ET un sceau de 16 caractères', () => {
    const t = invoiceToken(SALE) as string
    const [id, seal] = t.split('~')
    expect(id).toBe(SALE)
    expect(seal).toHaveLength(16)
    // base64url uniquement : le jeton voyage dans un CHEMIN d'URL, sans échappement.
    expect(seal).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('l’URL publique pointe sur /f/<jeton> de l’app', () => {
    expect(invoicePublicUrl(SALE)).toBe(`https://exemple.test/f/${invoiceToken(SALE)}`)
  })

  /**
   * ⚠️ MESURÉ EN PRODUCTION le 2026-10-25, et aucune autre vérification ne pouvait le voir.
   * Le jeton était `<id>.<sceau>` ; `vercel.json` ne réécrit vers l'application que les
   * chemins SANS POINT (`/((?!.*\.).*)`), donc `/f/<id>.<sceau>` rendait **404** quand
   * `/f/abcdef` rendait 200. Le PDF était juste, la route d'API vivante, les 49 tests verts
   * — et le QR imprimé menait à une page d'erreur. Même piège côté service worker
   * (`navigateFallbackDenylist`). Ce qui suit garde le PRODUCTEUR ; `routageJetonFacture`
   * (front) garde les règles de l'HÔTE, qui sont l'autre moitié du contrat.
   */
  it('⚠️ le jeton ne contient AUCUN caractère qui casse le routage de l’application', () => {
    const t = invoiceToken(SALE) as string
    expect(t).not.toContain('.')
    // Jeu de caractères sûr dans un chemin d'URL : alphanumérique + les « unreserved »
    // de la RFC 3986. Rien qui soit échappé, interprété comme une extension, ou coupé.
    expect(t).toMatch(/^[A-Za-z0-9_~-]+$/)
  })

  it('⚠️ et l’URL complète non plus, hors le point des noms de domaine', () => {
    const url = invoicePublicUrl(SALE) as string
    const chemin = new URL(url).pathname
    expect(chemin.startsWith('/f/')).toBe(true)
    expect(chemin).not.toContain('.')
  })
})

describe('invoiceLink — refus', () => {
  it('sceau retiré → refus', () => {
    expect(parseInvoiceToken(SALE)).toBeNull()
  })

  it('sceau modifié d’un caractère → refus', () => {
    const t = invoiceToken(SALE) as string
    const flipped = t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A')
    expect(flipped).not.toBe(t)
    expect(parseInvoiceToken(flipped)).toBeNull()
  })

  it('sceau tronqué → refus (pas de comparaison de préfixe)', () => {
    const t = invoiceToken(SALE) as string
    expect(parseInvoiceToken(t.slice(0, -1))).toBeNull()
  })

  it('identifiant modifié, sceau conservé → refus', () => {
    const t = invoiceToken(SALE) as string
    expect(parseInvoiceToken(t.replace(SALE, 'clx0000000000000000000000'))).toBeNull()
  })

  it('jeton signé avec un AUTRE secret → refus', () => {
    const t = invoiceToken(SALE) as string
    process.env.JWT_SECRET = 'un-autre-secret'
    expect(parseInvoiceToken(t)).toBeNull()
  })

  it('formes dégénérées → refus, jamais de levée', () => {
    for (const bad of ['', '.', '.abc', 'abc.', undefined, null, 42, {}]) {
      expect(parseInvoiceToken(bad)).toBeNull()
    }
  })
})

describe('invoiceLink — secret', () => {
  it('aucun secret → aucun jeton, aucune URL (fonctionnalité inerte, pas d’erreur)', () => {
    delete process.env.JWT_SECRET
    expect(invoiceToken(SALE)).toBeNull()
    expect(invoicePublicUrl(SALE)).toBeNull()
    expect(parseInvoiceToken('nimporte.quoi0000000000')).toBeNull()
  })

  it('INVOICE_LINK_SECRET prime sur JWT_SECRET', () => {
    const avec = invoiceToken(SALE)
    process.env.INVOICE_LINK_SECRET = 'secret-dedie-aux-liens'
    const dedie = invoiceToken(SALE)
    expect(dedie).not.toBe(avec)
    expect(parseInvoiceToken(dedie)).toBe(SALE)
  })

  it('⚠️ un secret dédié posé DÉCOUPLE : une rotation de JWT_SECRET ne casse plus les liens', () => {
    process.env.INVOICE_LINK_SECRET = 'secret-dedie-aux-liens'
    const t = invoiceToken(SALE)
    process.env.JWT_SECRET = 'rotation-dette-P0.1'
    expect(parseInvoiceToken(t)).toBe(SALE)
  })

  it('le secret est lu À L’APPEL, pas au chargement du module', () => {
    process.env.INVOICE_LINK_SECRET = 'premier'
    const a = invoiceToken(SALE)
    process.env.INVOICE_LINK_SECRET = 'second'
    expect(invoiceToken(SALE)).not.toBe(a)
  })
})
