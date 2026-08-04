import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

/**
 * Historique d'achats de la fiche client — câblage de `GET /api/customers/:id/sales` (#214).
 *
 * Ce que ces tests gardent, et pourquoi ça ne peut PAS être un test de source :
 * le défaut d'origine n'était pas une faute de frappe, c'était un tableau codé `[]` que
 * tout le monde lisait comme une donnée. Le seul verrou qui l'aurait vu est celui qui
 * MONTE la modale et regarde ce que le commerçant lit — d'où le rendu réel + une API mockée.
 *
 * ⚠️ Le cas central est « échec ≠ zéro » : c'est la confusion qui trompait l'utilisateur.
 */

const { mockState, salesMock } = vi.hoisted(() => ({
  mockState: { lang: 'fr', currency: 'XOF', theme: 'dark' as string, tenant: null as unknown },
  salesMock: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/api', () => ({
  customersApi: { sales: salesMock, update: vi.fn(), delete: vi.fn(), get: vi.fn(), list: vi.fn(), create: vi.fn(), search: vi.fn() },
}))
vi.mock('@/lib/announce', () => ({ announce: vi.fn() }))
vi.mock('@/lib/confirm', () => ({ confirm: vi.fn().mockResolvedValue(true) }))
vi.mock('@/hooks/useModalFocus', () => ({ useModalFocus: () => ({ current: null }) }))
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  const useAppStore = Object.assign(
    vi.fn((sel?: (s: typeof mockState) => unknown) => (sel ? sel(mockState) : mockState)),
    { getState: () => mockState },
  )
  return {
    ...actual, useAppStore,
    useFormatAmount: () => (n: number) => `${n.toLocaleString('fr-FR')} F`,
    useCurrencyInfo: () => ({ symbol: 'F', locale: 'fr-FR', decimals: 0 }),
    useConvertFromXOF: () => (n: number) => n,
  }
})

import CustomersModals from '@/components/customers/CustomersModals'
import { mapApiCustomerSale, type Customer } from '@/components/customers/customersShared'

const AWA: Customer = {
  id: 'c1', name: 'Awa Diop', type: 'Détail', phone: '', email: '', address: '',
  purchasesPerMonth: 0, totalCA: 0, loyaltyPoints: 0,
  since: '2026-01-01', lastPurchase: '2026-08-02', notes: '',
}
const MOUSSA: Customer = { ...AWA, id: 'c2', name: 'Moussa Fall' }

const SALE = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'abc123def456', total: 18750, createdAt: '2026-08-02T10:00:00.000Z',
  status: 'completed', invoiceNumber: null, items: 4, ...over,
})

/** Aperçu d'une fiche client, seul prop qui varie ici. */
function Harness({ customer }: { customer: Customer | null }) {
  return renderTree({ viewCustomer: customer })
}

function renderTree(over: Record<string, unknown> = {}) {
  const noop = () => {}
  return (
    <CustomersModals
      viewCustomer={AWA} setViewCustomer={noop}
      fmt={(n: number) => `${n.toLocaleString('fr-FR')} F`}
      lang="fr" i={(...a: string[]) => a[0]} navigate={noop}
      setDetailCustomer={noop} setShowDetailModal={noop}
      showEditCustModal={false} editCustomer={null} setShowEditCustModal={noop}
      custEditMode={false} setCustEditMode={noop}
      editCustForm={{ name: '', type: 'Détail', phone: '', email: '', address: '', notes: '' }} setEditCustForm={noop}
      setCustomers={noop}
      showCreate={false} setShowCreate={noop}
      form={{ name: '', type: 'Détail', phone: '', email: '', address: '' }} setForm={noop}
      handleCreateCustomer={noop} resetCustForm={noop}
      showDetailModal={false} detailCustomer={null}
      setEditCustomer={noop}
      {...over}
    />
  )
}

const renderModals = (over: Record<string, unknown> = {}) => render(renderTree(over))

beforeEach(() => {
  vi.clearAllMocks()
  salesMock.mockResolvedValue([])
})

describe('mapApiCustomerSale — traversée de frontière', () => {
  it('référence = numéro de FACTURE quand il existe', () => {
    expect(mapApiCustomerSale(SALE({ invoiceNumber: 'FAC-2026-00042' }) as never).ref).toBe('FAC-2026-00042')
  })

  it('sans facture → référence courte dérivée de l’id (convention V-XXXXXX)', () => {
    expect(mapApiCustomerSale(SALE() as never).ref).toBe('V-DEF456')
  })

  it('`refunded` est un BOOLÉEN dérivé du statut serveur', () => {
    expect(mapApiCustomerSale(SALE() as never).refunded).toBe(false)
    expect(mapApiCustomerSale(SALE({ status: 'refunded' }) as never).refunded).toBe(true)
  })

  it('la date reste l’ISO serveur (le formatage est l’affaire de l’écran)', () => {
    expect(mapApiCustomerSale(SALE() as never).date).toBe('2026-08-02T10:00:00.000Z')
  })
})

describe('fiche client — les achats viennent du serveur', () => {
  it('demande les ventes DU client ouvert et affiche ses lignes', async () => {
    salesMock.mockResolvedValue([SALE({ invoiceNumber: 'FAC-2026-00042' })])
    renderModals()
    expect(salesMock).toHaveBeenCalledWith('c1')
    expect(await screen.findByText('FAC-2026-00042')).toBeTruthy()
    // « 4 art. » = nombre de LIGNES de la vente (le td concatène deux nœuds de texte).
    expect(screen.getByText((_, el) => el?.tagName === 'TD' && el.textContent?.trim() === '4 art.')).toBeTruthy()
    expect(screen.getByText('18 750 F')).toBeTruthy()
  })

  it('la date est rendue en jj/mm/aaaa (fmtDate), jamais l’ISO brut', async () => {
    salesMock.mockResolvedValue([SALE()])
    renderModals()
    expect(await screen.findByText('02/08/2026')).toBeTruthy()
    expect(screen.queryByText(/2026-08-02T/)).toBeNull()
  })

  it('aucune requête tant qu’aucune fiche n’est ouverte', () => {
    renderModals({ viewCustomer: null })
    expect(salesMock).not.toHaveBeenCalled()
  })
})

describe('⚠️ « échec » et « zéro achat » ne disent PAS la même chose', () => {
  it('liste vide → « Aucun achat »', async () => {
    salesMock.mockResolvedValue([])
    renderModals()
    expect(await screen.findByText('Aucun achat')).toBeTruthy()
  })

  it('requête en ÉCHEC → « Historique indisponible », et surtout PAS « Aucun achat »', async () => {
    salesMock.mockRejectedValue(new Error('500'))
    renderModals()
    expect(await screen.findByText('Historique indisponible')).toBeTruthy()
    // C'est LE défaut d'origine : affirmer une absence d'achats qu'on n'a pas constatée.
    expect(screen.queryByText('Aucun achat')).toBeNull()
  })

  it('pendant le chargement → ni « Aucun achat » ni une fausse liste', () => {
    salesMock.mockReturnValue(new Promise(() => {})) // ne se résout jamais
    renderModals()
    expect(screen.getByText('Chargement de l’historique…')).toBeTruthy()
    expect(screen.queryByText('Aucun achat')).toBeNull()
  })
})

describe('ventes remboursées', () => {
  it('l’aperçu MARQUE la ligne remboursée au lieu de la présenter comme un achat', async () => {
    salesMock.mockResolvedValue([SALE({ status: 'refunded' })])
    renderModals()
    expect(await screen.findByText('Remboursé')).toBeTruthy()
  })

  it('la fiche complète n’affiche plus « ✓ Payé » en dur sur une vente remboursée', async () => {
    salesMock.mockResolvedValue([SALE({ status: 'refunded' })])
    renderModals({ viewCustomer: null, showDetailModal: true, detailCustomer: AWA })
    expect(await screen.findByText('Remboursé')).toBeTruthy()
    expect(screen.queryByText(/Payé/)).toBeNull()
  })

  it('une vente normale reste « ✓ Payé » dans la fiche complète', async () => {
    salesMock.mockResolvedValue([SALE()])
    renderModals({ viewCustomer: null, showDetailModal: true, detailCustomer: AWA })
    expect(await screen.findByText(/Payé/)).toBeTruthy()
    expect(screen.queryByText('Remboursé')).toBeNull()
  })
})

describe('isolation entre fiches', () => {
  it('changer de client REDEMANDE et n’affiche pas les achats du précédent', async () => {
    salesMock.mockResolvedValue([SALE({ invoiceNumber: 'FAC-AWA' })])
    // ⚠️ La RACINE doit rester du même type entre les deux rendus. Avec un type différent,
    // React démonte l'arbre et en monte un neuf : l'état du hook est reparti de zéro et la
    // course qu'on veut observer n'a jamais lieu (le test passait alors sans rien prouver).
    const { rerender } = render(<Harness customer={AWA} />)
    expect(await screen.findByText('FAC-AWA')).toBeTruthy()

    salesMock.mockResolvedValue([SALE({ invoiceNumber: 'FAC-MOUSSA' })])
    rerender(<Harness customer={MOUSSA} />)
    expect(salesMock).toHaveBeenCalledWith('c2')
    await waitFor(() => expect(screen.queryByText('FAC-AWA')).toBeNull())
    expect(await screen.findByText('FAC-MOUSSA')).toBeTruthy()
  })

  it('une réponse EN RETARD du client précédent ne s’affiche pas sur la fiche courante', async () => {
    // La course réelle : on ouvre Awa, on passe à Moussa AVANT qu'Awa réponde, puis la
    // réponse d'Awa arrive. Sans le garde `alive`, elle écrase l'écran de Moussa — les
    // achats d'un client s'affichent sur la fiche d'un AUTRE.
    const defer = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
    const awa = defer<unknown[]>()
    const moussa = defer<unknown[]>()
    salesMock.mockReturnValueOnce(awa.promise).mockReturnValueOnce(moussa.promise)

    const { rerender } = render(<Harness customer={AWA} />)   // fiche Awa — requête en vol
    rerender(<Harness customer={MOUSSA} />)                   // on bascule sur Moussa

    await act(async () => { moussa.resolve([SALE({ invoiceNumber: 'FAC-MOUSSA' })]) })
    expect(await screen.findByText('FAC-MOUSSA')).toBeTruthy()

    await act(async () => { awa.resolve([SALE({ invoiceNumber: 'FAC-AWA' })]) })
    expect(screen.queryByText('FAC-AWA')).toBeNull()          // la réponse tardive est ignorée
    expect(screen.getByText('FAC-MOUSSA')).toBeTruthy()       // l'écran courant est intact
  })
})
