import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

/**
 * Historique de commandes de la fiche fournisseur — câblage de
 * `GET /api/suppliers/:id/orders` (#214). Miroir de `customerPurchases.test.tsx`.
 *
 * Le défaut d'origine n'était pas une faute de frappe mais un `orders: []` que tout le
 * monde lisait comme une donnée : seul un verrou qui MONTE la modale et regarde ce que
 * le commerçant lit pouvait le voir. D'où le rendu réel + une API mockée.
 *
 * ⚠️ Cas central : « échec » ≠ « zéro commande ». Et pour le KPI, « pas encore su » ≠ 0.
 */

const { mockState, ordersMock, ordersListMock, SUPPLIERS } = vi.hoisted(() => ({
  mockState: { lang: 'fr', currency: 'XOF', theme: 'dark' as string },
  ordersMock: vi.fn(),
  ordersListMock: vi.fn(),
  SUPPLIERS: [
    { id: 'f1', name: 'SONACO', categories: 'Ciment', phone: '770000001', email: 'a@x.com', address: 'Dakar', leadTime: 3, rating: 4, status: 'Actif', notes: '' },
    { id: 'f2', name: 'Patisen', categories: 'Agro', phone: '770000002', email: 'b@x.com', address: 'Thiès', leadTime: 5, rating: 5, status: 'Actif', notes: '' },
  ],
}))

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/lib/confirm', () => ({ confirm: vi.fn().mockResolvedValue(true) }))
vi.mock('@/utils/export', () => ({ exportCSV: vi.fn(), openPDF: vi.fn(), htmlTable: vi.fn(() => '') }))
vi.mock('@/components/ui/AddressAutocompleteInput', () => ({ default: () => <input aria-label="address" /> }))
vi.mock('@/components/ui/PhoneInputWithCountry', () => ({ default: () => <input aria-label="phone" /> }))
vi.mock('@/hooks/useModalFocus', () => ({ useModalFocus: () => ({ current: null }) }))
vi.mock('@/lib/api', () => ({
  suppliersApi: {
    list: vi.fn().mockResolvedValue(SUPPLIERS), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    orders: ordersMock,
  },
  ordersApi: { list: ordersListMock },
}))
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  const state = { ...(actual.DEFAULT_CONFIG as object), ...mockState }
  const useAppStore = Object.assign(
    vi.fn((sel?: (s: typeof state) => unknown) => (sel ? sel(state) : state)),
    { getState: () => state },
  )
  return { ...actual, useAppStore, useFormatAmount: () => (n: number) => `${n.toLocaleString('fr-FR')} F` }
})

import SupplierViewModal from '@/components/suppliers/SupplierViewModal'
import Suppliers from '@/pages/Suppliers'
import { mapApiSupplierOrder, type Supplier } from '@/components/suppliers/suppliersShared'

const SONACO: Supplier = {
  id: 'f1', name: 'SONACO', categories: ['Ciment'], phone: '770000001', email: 'a@x.com',
  address: 'Dakar', contact: 'M. Fall', leadTime: 3, rating: 4, status: 'Actif', notes: '',
}
const PATISEN: Supplier = { ...SONACO, id: 'f2', name: 'Patisen' }

const ORDER = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'ck1abc123def456', ref: 'BC-2026-014', total: 128500, status: 'IN_TRANSIT',
  createdAt: '2026-08-02T10:00:00.000Z', expectedAt: null, items: 5, ...over,
})

const noop = () => undefined

/** Racine STABLE : un rerender qui change le type démonterait l'arbre et la course
 *  entre deux fiches n'aurait jamais lieu (piège rencontré côté client). */
function Harness({ supplier }: { supplier: Supplier }) {
  return <SupplierViewModal supplier={supplier} onClose={noop} onNewOrder={noop} />
}

beforeEach(() => {
  vi.clearAllMocks()
  ordersMock.mockResolvedValue([])
  ordersListMock.mockResolvedValue([])
})

describe('mapApiSupplierOrder — traversée de frontière', () => {
  it('traduit le statut du FIL vers le libellé d’écran (source unique)', () => {
    expect(mapApiSupplierOrder(ORDER({ status: 'IN_TRANSIT' }) as never).status).toBe('EN TRANSIT')
    expect(mapApiSupplierOrder(ORDER({ status: 'DRAFT' }) as never).status).toBe('BROUILLON')
    expect(mapApiSupplierOrder(ORDER({ status: 'RECEIVED' }) as never).status).toBe('REÇUE')
  })

  it('statut inconnu → rendu tel quel, jamais un statut inventé', () => {
    expect(mapApiSupplierOrder(ORDER({ status: 'WAT' }) as never).status).toBe('WAT')
  })

  it('référence serveur conservée ; repli court seulement si elle manque', () => {
    expect(mapApiSupplierOrder(ORDER() as never).ref).toBe('BC-2026-014')
    expect(mapApiSupplierOrder(ORDER({ ref: '' }) as never).ref).toBe('C-DEF456')
  })

  it('la date reste l’ISO serveur (le formatage est l’affaire de l’écran)', () => {
    expect(mapApiSupplierOrder(ORDER() as never).date).toBe('2026-08-02T10:00:00.000Z')
  })
})

describe('fiche fournisseur — les commandes viennent du serveur', () => {
  it('demande les commandes DU fournisseur ouvert et affiche ses lignes', async () => {
    ordersMock.mockResolvedValue([ORDER()])
    render(<Harness supplier={SONACO} />)
    expect(ordersMock).toHaveBeenCalledWith('f1')
    expect(await screen.findByText('BC-2026-014')).toBeTruthy()
    expect(screen.getByText('128 500 F')).toBeTruthy()
    expect(screen.getByText('EN TRANSIT')).toBeTruthy()
  })

  it('la date est rendue en jj/mm/aaaa (fmtDate), jamais l’ISO brut', async () => {
    ordersMock.mockResolvedValue([ORDER()])
    render(<Harness supplier={SONACO} />)
    expect(await screen.findByText('02/08/2026')).toBeTruthy()
    expect(screen.queryByText(/2026-08-02T/)).toBeNull()
  })
})

describe('⚠️ « échec » et « zéro commande » ne disent PAS la même chose', () => {
  it('liste vide → « Aucune commande »', async () => {
    ordersMock.mockResolvedValue([])
    render(<Harness supplier={SONACO} />)
    expect(await screen.findByText('Aucune commande')).toBeTruthy()
  })

  it('requête en ÉCHEC → « Historique indisponible », et PAS « Aucune commande »', async () => {
    ordersMock.mockRejectedValue(new Error('500'))
    render(<Harness supplier={SONACO} />)
    expect(await screen.findByText('Historique indisponible')).toBeTruthy()
    expect(screen.queryByText('Aucune commande')).toBeNull()
  })

  it('pendant le chargement → ni « Aucune commande » ni une fausse liste', () => {
    ordersMock.mockReturnValue(new Promise<never>(() => undefined)) // ne se résout jamais
    render(<Harness supplier={SONACO} />)
    expect(screen.getByText('Chargement…')).toBeTruthy()
    expect(screen.queryByText('Aucune commande')).toBeNull()
  })
})

describe('isolation entre fiches', () => {
  it('une réponse EN RETARD du fournisseur précédent ne s’affiche pas sur la fiche courante', async () => {
    const defer = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
    const sonaco = defer<unknown[]>()
    const patisen = defer<unknown[]>()
    ordersMock.mockReturnValueOnce(sonaco.promise).mockReturnValueOnce(patisen.promise)

    const { rerender } = render(<Harness supplier={SONACO} />)
    rerender(<Harness supplier={PATISEN} />)

    await act(async () => { patisen.resolve([ORDER({ ref: 'BC-PATISEN' })]) })
    expect(await screen.findByText('BC-PATISEN')).toBeTruthy()

    await act(async () => { sonaco.resolve([ORDER({ ref: 'BC-SONACO' })]) })
    expect(screen.queryByText('BC-SONACO')).toBeNull()   // réponse tardive ignorée
    expect(screen.getByText('BC-PATISEN')).toBeTruthy()  // écran courant intact
  })
})

describe('KPI « commandes en cours » — plus jamais 0 à tort', () => {
  const kpiValue = () => {
    const card = [...document.querySelectorAll('.kpi-card')]
      .find(c => c.textContent?.includes('Commandes en cours'))
    // La valeur est le texte de la carte moins son libellé.
    return card?.textContent?.replace('Commandes en cours', '').trim() ?? null
  }

  it('compte les commandes ouvertes sur les statuts du FIL', async () => {
    ordersListMock.mockResolvedValue([
      { id: 'o1', status: 'SENT' }, { id: 'o2', status: 'IN_TRANSIT' },
      { id: 'o3', status: 'CONFIRMED' }, { id: 'o4', status: 'RECEIVED' },
      { id: 'o5', status: 'DRAFT' }, { id: 'o6', status: 'CANCELLED' },
    ])
    render(<Suppliers />)
    // ⚠️ Les statuts d'ÉCRAN ('ENVOYÉE'…) ne matcheraient jamais la réponse serveur.
    await waitFor(() => expect(kpiValue()).toBe('3'))
  })

  it('aucune commande ouverte → 0 (un vrai zéro, constaté)', async () => {
    ordersListMock.mockResolvedValue([{ id: 'o1', status: 'RECEIVED' }])
    render(<Suppliers />)
    await waitFor(() => expect(kpiValue()).toBe('0'))
  })

  it('⚠️ requête en ÉCHEC → « — », jamais 0', async () => {
    ordersListMock.mockRejectedValue(new Error('500'))
    render(<Suppliers />)
    await waitFor(() => expect(kpiValue()).toBe('—'))
    // Le KPI comptait sur `supplier.orders`, toujours vide : il affichait 0 en
    // permanence, y compris avec des commandes en transit.
    expect(kpiValue()).not.toBe('0')
  })
})
