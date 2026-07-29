import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

/**
 * ⚠️ VERROU DE CÂBLAGE — douchette SANS terminateur (champ de recherche POS).
 *
 * `wedgeScan.test.ts` verrouille l'INVARIANT PUR (« la cadence se fige à la dernière touche »).
 * Il ne peut rien dire du CÂBLAGE : minuteur posé, minuteur annulé à la touche suivante,
 * minuteur annulé par Entrée, nettoyage au démontage. C'est là que vivent les vrais défauts —
 * un `setTimeout` jamais annulé tire au milieu d'une rafale, un double-tir ajoute le produit
 * DEUX FOIS au panier (une erreur d'argent, pas d'affichage).
 *
 * On monte donc le VRAI `POS.tsx` — pas une reproduction du champ, qui prouverait seulement
 * que la copie fonctionne — avec des faux timers pour piloter l'inactivité.
 *
 * Ce qu'on observe : `resolveScannedCode`, la brique que `handleScan` appelle en premier.
 * L'appeler = le chemin scan a été pris ; ne pas l'appeler = la saisie est restée une recherche.
 */

const { mockState } = vi.hoisted(() => ({
  mockState: {
    lang: 'fr', currency: 'XOF',
    cashierOpen: true, cashierOpenedAt: new Date('2026-05-30T08:00:00Z').toISOString(),
    cashierOpeningFund: 50000, cashierSessionTx: 0, cashierSessionCA: 0,
    openCashier: vi.fn(), closeCashier: vi.fn(), addCashierSale: vi.fn(),
    posTaxRate: 18, posShowStockOnTile: true, posDefaultFund: 50000,
    posDefaultPayment: 'cash', priceMode: 'TTC', posVatIncluded: true, posAutoprint: false,
    requireCashier: false,
    enableScanner: true, autoWhatsApp: false,
    cart: [] as unknown[], addCartItem: vi.fn(), updateCartQty: vi.fn(), setCart: vi.fn(), clearCart: vi.fn(),
    updateConfig: vi.fn(),
    // ⚠️ `freshness` N'EST PAS FACULTATIF : `handleScan` appelle `oldestFreshness(freshness)`
    // sur le chemin « introuvable ». Absent, il lève `Cannot read properties of undefined`.
    // En local l'erreur restait un rejet non capturé, VERTE ; en CI elle fait échouer le run.
    // `{}` = aucune classe synchronisée → le message honnête dit « jamais synchronisé ».
    freshness: {} as Record<string, number>, markFresh: vi.fn(), catalogNonce: 0,
    enableLoyalty: false,
  },
}))
vi.mock('@/stores/appStore', () => ({
  useAppStore: () => mockState,
  useCashierIsOpen: () => true,
  useFormatAmount: () => (n: number) => `${n} F`,
  useConvertToXOF: () => (n: number) => n,
  useConvertFromXOF: () => (n: number) => n,
  useCurrencyInfo: () => ({ symbol: 'F' }),
  formatCurrency: (n: number) => `${n} F`,
  formatInCurrency: (n: number) => `${n} F`,
  convertAmount: (n: number) => n,
  t: (k: string) => k,
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { name: 'Marie', id: 'u1' } }),
}))
vi.mock('@/lib/api', () => ({
  productsApi: { list: vi.fn().mockResolvedValue([]), lookup: vi.fn().mockResolvedValue(null) },
  salesApi: { list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}) },
  whatsappApi: { sendTicket: vi.fn().mockResolvedValue({}) },
  tenantApi: { get: vi.fn().mockResolvedValue({ requireCashier: false }) },
  paydunyaApi: { config: vi.fn().mockResolvedValue({ configured: false, mode: 'test', methods: [] }), initiate: vi.fn(), status: vi.fn() },
}))
// La brique observée. `unresolved` : on verrouille QUI déclenche le scan, pas ce qu'il trouve.
vi.mock('@/components/pos/scanResolve', () => ({
  resolveScannedCode: vi.fn().mockResolvedValue({ kind: 'unresolved' }),
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ state: null, pathname: '/app/pos' }) }))
vi.mock('@/utils/export', () => ({ generateInvoice: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/pos/POSProductGrid', () => ({ default: () => <div data-testid="grid" /> }))
vi.mock('@/components/pos/POSCart', () => ({ default: () => <div data-testid="cart" /> }))
vi.mock('@/components/pos/POSModals', () => ({ default: () => <div data-testid="modals" /> }))

import POS from '@/pages/POS'
import { WEDGE_IDLE_MS, WEDGE_MAX_MS_PER_CHAR } from '@/components/pos/wedgeScan'
import { resolveScannedCode } from '@/components/pos/scanResolve'
import { isValidBarcode, normalizeBarcode } from '@/lib/barcode'

const CODE = '3017620422003'      // EAN-13 réel
// ⚠️ COUPLE PIÈGE, calculé et non inventé : `EAN_PIEGE` est un EAN-13 valide dont les 12
// premiers caractères forment un UPC-A lui aussi VALIDE. C'est la collision mesurée à 10,0 %.
// Un test en dessous vérifie que la fixture porte bien cette propriété — sans quoi tout ce
// bloc passerait au vert en ne prouvant rien (une fixture invalide ne déclenche aucune voie).
const EAN_PIEGE = '5410492021592'
const PREFIXE_PIEGE = EAN_PIEGE.slice(0, 12) // '541049202159', UPC-A valide

/** Tape `texte` caractère par caractère, en avançant l'horloge de `msParChar` entre deux. */
async function taper(champ: HTMLElement, texte: string, msParChar: number) {
  for (let n = 1; n <= texte.length; n++) {
    fireEvent.change(champ, { target: { value: texte.slice(0, n) } })
    if (n < texte.length) await act(async () => { await vi.advanceTimersByTimeAsync(msParChar) })
  }
}

/** Laisse passer le délai d'inactivité (et un peu plus). */
async function attendreInactivite(ms = WEDGE_IDLE_MS + 20) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

async function monter() {
  render(<POS />)
  return await screen.findByPlaceholderText(/Rechercher/i)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => { vi.useRealTimers() })

describe('câblage douchette sans terminateur — le champ POS', () => {
  it('rafale à cadence machine SANS Entrée → handleScan tire sur l’inactivité', async () => {
    const champ = await monter()
    await taper(champ, CODE, 5) // 5 ms/car : cadence douchette
    expect(resolveScannedCode).not.toHaveBeenCalled() // rien pendant la rafale
    await attendreInactivite()
    await waitFor(() => expect(resolveScannedCode).toHaveBeenCalledTimes(1))
    expect(vi.mocked(resolveScannedCode).mock.calls[0][0]).toBe(CODE)
    expect((champ as HTMLInputElement).value).toBe('') // champ vidé AVANT de résoudre (#148)
  })

  it('le minuteur est ANNULÉ à chaque touche — aucun tir au milieu de la rafale', async () => {
    const champ = await monter()
    // Écart inter-caractère volontairement proche du seuil, mais inférieur : une douchette lente.
    await taper(champ, CODE, WEDGE_IDLE_MS - 10)
    expect(resolveScannedCode).not.toHaveBeenCalled()
    await attendreInactivite()
    // Cadence 50 ms/car > 30 → ce n'est plus une douchette : la saisie reste une recherche.
    expect(resolveScannedCode).not.toHaveBeenCalled()
    expect((champ as HTMLInputElement).value).toBe(CODE)
  })

  it('Entrée tire toujours — le chemin #148 n’est pas régressé', async () => {
    const champ = await monter()
    await taper(champ, CODE, 5)
    fireEvent.keyDown(champ, { key: 'Enter' })
    await waitFor(() => expect(resolveScannedCode).toHaveBeenCalledTimes(1))
  })

  it('PAS de double-tir : Entrée annule le minuteur d’inactivité', async () => {
    const champ = await monter()
    await taper(champ, CODE, 5)
    fireEvent.keyDown(champ, { key: 'Enter' })
    await waitFor(() => expect(resolveScannedCode).toHaveBeenCalledTimes(1))
    await attendreInactivite(WEDGE_IDLE_MS * 5)
    // Un minuteur non annulé ajouterait le produit DEUX FOIS au panier.
    expect(resolveScannedCode).toHaveBeenCalledTimes(1)
  })

  it('frappe humaine « lait » → reste une recherche, jamais un scan', async () => {
    const champ = await monter()
    await taper(champ, 'lait', 180) // cadence humaine
    await attendreInactivite()
    expect(resolveScannedCode).not.toHaveBeenCalled()
    expect((champ as HTMLInputElement).value).toBe('lait')
  })

  it('la fixture piège porte bien la propriété mesurée (sinon ce bloc ne prouverait rien)', () => {
    expect(isValidBarcode(normalizeBarcode(PREFIXE_PIEGE))).toBe(true) // UPC-A valide…
    expect(isValidBarcode(normalizeBarcode(EAN_PIEGE))).toBe(true)     // …préfixe d'un EAN-13 valide
    expect(EAN_PIEGE.startsWith(PREFIXE_PIEGE)).toBe(true)
  })

  it('⚠️ recopie MANUELLE : une pause après le 12ᵉ chiffre ne déclenche RIEN', async () => {
    // Le défaut mesuré : 10,0 % des EAN-13 ont un préfixe 12c qui est un UPC-A valide.
    // Si le tir sur inactivité s'autorisait de la FORME, la pause du caissier qui relit son
    // étiquette viderait le champ et ajouterait un AUTRE produit au panier — une fois sur dix.
    const champ = await monter()
    await taper(champ, PREFIXE_PIEGE, 200) // il recopie à la main, 12 chiffres…
    await attendreInactivite(WEDGE_IDLE_MS * 10) // …puis relève les yeux vers l'étiquette
    expect(resolveScannedCode).not.toHaveBeenCalled()
    expect((champ as HTMLInputElement).value).toBe(PREFIXE_PIEGE) // le champ l'attend
  })

  it('…il finit sa saisie, Entrée résout le code COMPLET (recopie manuelle servie, #148)', async () => {
    const champ = await monter()
    await taper(champ, PREFIXE_PIEGE, 200)
    await attendreInactivite(WEDGE_IDLE_MS * 10)
    fireEvent.change(champ, { target: { value: EAN_PIEGE } }) // le 13ᵉ chiffre
    fireEvent.keyDown(champ, { key: 'Enter' })
    await waitFor(() => expect(resolveScannedCode).toHaveBeenCalledTimes(1))
    expect(vi.mocked(resolveScannedCode).mock.calls[0][0]).toBe(EAN_PIEGE) // le COMPLET, pas le préfixe
  })

  it('champ vidé → le minuteur est annulé, rien ne tire ensuite', async () => {
    const champ = await monter()
    await taper(champ, CODE, 5)
    fireEvent.change(champ, { target: { value: '' } })
    await attendreInactivite(WEDGE_IDLE_MS * 5)
    expect(resolveScannedCode).not.toHaveBeenCalled()
  })

  it('le seuil de cadence est bien celui de la brique pure (pas une copie locale)', () => {
    expect(WEDGE_MAX_MS_PER_CHAR).toBe(30)
    expect(WEDGE_IDLE_MS).toBeGreaterThan(10)
  })
})
