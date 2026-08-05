import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

/**
 * ⚠️ PREUVE COMPORTEMENTALE — la console plateforme affiche des FCFA, quelle que soit la
 * devise du super-admin connecté.
 *
 * `adminXof.test.ts` est un méta-test : il scanne le TEXTE de la source et interdit le retour
 * de `useFormatAmount`. Il prouve la SOURCE, pas le comportement — il resterait vert si le
 * montant devenait inatteignable, et il rougirait sur un simple renommage.
 *
 * Ici on monte le VRAI `AdminDashboard` avec le VRAI `appStore` réglé sur **EUR**, et on
 * regarde ce qui s'affiche. Point crucial : `@/stores/appStore` n'est **PAS mocké**. Si
 * quelqu'un rebranche `useFormatAmount`, la conversion réelle (1 EUR = 655,957 XOF)
 * s'appliquera et le test verra des euros. Mocker le formateur ferait exactement l'inverse :
 * un test vert qui ne prouve rien.
 */

// ⚠️ `vi.hoisted` : les fabriques `vi.mock` sont remontées en tête de fichier, donc elles ne
// peuvent pas lire une const déclarée au-dessus d'elles. C'est la convention du dépôt.
const { TENANT } = vi.hoisted(() => ({
  TENANT: {
    id: 't1', name: 'Alimentation Koné', plan: 'pro', currency: 'EUR', country: 'CI',
    status: 'active', createdAt: '2026-01-15T10:00:00Z', revenue: 1_000_000,
    lastActivityAt: '2026-07-28T10:00:00Z', ownerEmail: 'k@example.com',
    _count: { users: 3, products: 42, sales: 128 },
  },
}))

vi.mock('@/lib/api', () => ({
  adminApi: {
    tenants: vi.fn().mockResolvedValue([TENANT]),
    stats: vi.fn().mockResolvedValue({ tenants: 1, users: 3, sales: 128, revenue: 1_000_000 }),
    planRequests: vi.fn().mockResolvedValue([]),
    createTenant: vi.fn(), reviewPlanRequest: vi.fn(), securityEvents: vi.fn().mockResolvedValue([]),
  },
  authApi: { changePassword: vi.fn() },
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { name: 'Nelson', email: 'n@example.com', isPlatformAdmin: true }, logout: vi.fn() }),
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/confirm', () => ({ confirm: vi.fn().mockResolvedValue(true) }))
// Enfants lourds, hors sujet ici (réseau propre, widgets d'infra).
vi.mock('@/components/integrations/OpsInfrastructure', () => ({ default: () => <div /> }))
vi.mock('@/components/admin/SecurityEvents', () => ({ default: () => <div /> }))

import AdminDashboard from '@/pages/AdminDashboard'
import { useAppStore, formatInCurrency, convertAmount } from '@/stores/appStore'
import { purchasablePlans, planAmountXOF } from '@/lib/plans'

/** Ce que l'ANCIEN code aurait affiché : le montant converti dans la devise du super-admin. */
const enDeviseSuperAdmin = (xof: number, devise: string) =>
  formatInCurrency(convertAmount(xof, 'XOF', devise), devise)

const devisePrecedente = useAppStore.getState().currency

beforeEach(() => { useAppStore.setState({ currency: 'EUR' }) })
afterEach(() => { useAppStore.setState({ currency: devisePrecedente }) })

/**
 * Les montants ne sont pas sur l'onglet par défaut (« Vue d'ensemble » n'affiche que des
 * compteurs) : le CA vit sur l'onglet **Boutiques**, les prix de plan dans la modale
 * **Nouvelle boutique**. Il faut donc piloter l'interface jusqu'à eux — un test qui se
 * contenterait de `render()` serait vert sans jamais avoir vu un seul montant.
 */
// Les onglets portent `role="tab"` (pas `button`) — AdminDashboard.tsx:289.
const ouvrirOnglet = (nom: RegExp) => fireEvent.click(screen.getByRole('tab', { name: nom }))

describe('console plateforme — super-admin en EUR, montants en FCFA', () => {
  it('la devise du store est bien EUR (sinon le test ne prouverait rien)', () => {
    // Sans cette ancre, un store resté en XOF rendrait tout le fichier vert par accident :
    // XOF → XOF ne convertit pas, donc les deux implémentations donneraient le même écran.
    expect(useAppStore.getState().currency).toBe('EUR')
    const ref = planAmountXOF('starter', 'monthly')!
    expect(enDeviseSuperAdmin(ref, 'EUR')).not.toBe(formatInCurrency(ref, 'XOF'))
  })

  it('le CA d’une boutique s’affiche en FCFA, PAS converti en euros', async () => {
    render(<AdminDashboard />)
    ouvrirOnglet(/Boutiques/)
    await waitFor(() => expect(screen.getByText(/Alimentation Koné/)).toBeInTheDocument())
    // « 1 000 000 FCFA » attendu ; « 1 524,49 € » serait l'ancien bug.
    await waitFor(() => expect(screen.getByText(txt(formatInCurrency(TENANT.revenue, 'XOF')))).toBeInTheDocument())
    expect(screen.queryByText(txt(enDeviseSuperAdmin(TENANT.revenue, 'EUR')))).toBeNull()
  })

  it('les prix de plan de la modale s’affichent en FCFA, PAS convertis', async () => {
    render(<AdminDashboard />)
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle boutique/ }))
    const select = await screen.findByLabelText('Plan')
    const options = within(select).getAllByRole('option').map(o => o.textContent ?? '')
    // ⚠️ Les montants viennent du CATALOGUE, plus d'un littéral : ce test épinglait
    // « 9 900 / 24 900 / 49 900 » et serait redevenu faux à chaque changement de grille.
    // L'invariant qu'il garde n'est pas le PRIX mais l'UNITÉ : la console plateforme
    // affiche des FCFA, jamais la devise du super-admin.
    // `txt` rend un MATCHER pour getByText, pas une chaîne : sur une comparaison de
    // chaînes il faut normaliser soi-même les espaces insécables d'Intl.
    const norme = (x: string) => x.replace(/\s+/g, ' ').trim()
    const joined = norme(options.join(' | '))
    for (const p of purchasablePlans()) {
      expect(joined, `plan ${p.id} absent ou converti`).toContain(norme(formatInCurrency(p.monthly!, 'XOF')))
    }
    // Enterprise est SUR DEVIS : aucun montant ne doit apparaître pour lui.
    expect(joined).toMatch(/Enterprise\s*—\s*sur devis/)
    // …et aucun euro : 8 000 XOF convertis donneraient « 12,20 € ».
    expect(options.join(' | ')).not.toMatch(/€/)
  })

  it('AUCUN montant de la console n’est libellé dans une devise non-XOF', async () => {
    // Filet large : un montant qu'on aurait oublié se trahirait ici, même hors des deux
    // assertions ciblées ci-dessus.
    render(<AdminDashboard />)
    ouvrirOnglet(/Boutiques/)
    await waitFor(() => expect(screen.getByText(txt(formatInCurrency(TENANT.revenue, 'XOF')))).toBeInTheDocument())
    const fautifs = [...document.querySelectorAll('span,div,option')]
      .map(e => e.textContent ?? '')
      .filter(t => t.length < 60 && /\d/.test(t) && /€|\$|£/.test(t))
    expect(fautifs, `montant libellé dans une devise non-XOF :\n${fautifs.join('\n')}`).toEqual([])
  })
})

/**
 * Testing Library NORMALISE les espaces du texte rendu : l'espace fine insécable U+202F que
 * pose `Intl` devient une espace ordinaire. Comparer à la chaîne brute échoue donc — mesuré.
 * On compare sur un texte lui aussi normalisé.
 */
function txt(attendu: string) {
  const norme = (s: string) => s.replace(/\s+/g, ' ').trim()
  return (_content: string, node: Element | null) => norme(node?.textContent ?? '') === norme(attendu)
}
