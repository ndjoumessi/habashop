import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * Affichage du palier client hors de la page Clients (#215) — Marketing et Nouvelle
 * commande rendaient `{c.type}` BRUT, donc « wholesale » à un commerçant francophone.
 *
 * ⚠️ Le cas central est l'ABSENCE : `clientTypeToLabel(null)` rend « Détail ». S'y fier
 * donnerait un palier à un client qui n'en a pas — le repli menteur qu'on élimine partout
 * ailleurs, réintroduit par la porte de l'affichage. Ces écrans doivent ne RIEN afficher.
 */
const { mockState, customersList } = vi.hoisted(() => ({
  mockState: { lang: 'fr', currency: 'XOF', theme: 'dark' as string, tenant: null as unknown },
  customersList: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/api', () => ({
  customersApi: { list: customersList, search: vi.fn() },
  marketingApi: { campaign: vi.fn(), campaigns: vi.fn().mockResolvedValue([]) },
  suppliersApi: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/hooks/useModalFocus', () => ({ useModalFocus: () => ({ current: null }) }))
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  const useAppStore = Object.assign(
    vi.fn((sel?: (s: typeof mockState) => unknown) => (sel ? sel(mockState) : mockState)),
    { getState: () => mockState },
  )
  return {
    ...actual, useAppStore,
    useFormatAmount: () => (n: number) => `${n} F`,
    formatInCurrency: (n: number) => `${n} F`,
    useConfig: () => ({ lang: 'fr', currency: 'XOF' }),
  }
})

import Marketing from '@/pages/Marketing'

const CUST = (over: Record<string, unknown> = {}) => ({
  id: 'c1', name: 'Boutique Teranga', phone: '+221770000001', email: '', address: '',
  type: 'wholesale', loyaltyPoints: 100, totalRevenue: 0, ...over,
})

/**
 * ⚠️ Cible la PASTILLE (un <span> de la ligne client), pas n'importe quel texte : le
 * sélecteur de segment de campagne porte lui aussi un bouton « Détail ». Sans ce filtre,
 * le cas « aucune pastille » échouait en trouvant ce bouton — un test qui aurait été
 * rouge pour la mauvaise raison, donc désarmé au premier ajustement.
 */
const pills = (text: string) => screen.queryAllByText(text).filter(el => el.tagName === 'SPAN')

beforeEach(() => {
  vi.clearAllMocks()
  customersList.mockResolvedValue([CUST()])
})

describe('Marketing — pastille de palier', () => {
  it('affiche le LIBELLÉ traduit, jamais la valeur du fil', async () => {
    customersList.mockResolvedValue([CUST({ type: 'wholesale' })])
    render(<Marketing />)
    await screen.findByText('Boutique Teranga')
    expect(pills('Grossiste')).toHaveLength(1)
    expect(pills('wholesale')).toHaveLength(0)
  })

  it('⚠️ le semi-gros n’est plus confondu avec le détail', async () => {
    // La comparaison portait sur `'semi'`, qui n'est pas une valeur canonique : le
    // semi-gros tombait dans la branche « sinon » et prenait la couleur du détail.
    customersList.mockResolvedValue([CUST({ type: 'semi-wholesale' })])
    render(<Marketing />)
    await screen.findByText('Boutique Teranga')
    const [pill] = pills('Semi-gros')
    expect(pill).toBeTruthy()
    // Couleur PROPRE au semi-gros : avec la comparaison sur 'semi', il prenait celle du détail.
    expect(pill.style.color).toBe('var(--acc)')
  })

  it('libellé HÉRITÉ en base → toujours le bon palier', async () => {
    customersList.mockResolvedValue([CUST({ type: 'Grossiste' })])
    render(<Marketing />)
    await screen.findByText('Boutique Teranga')
    expect(pills('Grossiste')).toHaveLength(1)
  })

  it('⚠️ client SANS type → AUCUNE pastille, surtout pas « Détail »', async () => {
    customersList.mockResolvedValue([CUST({ type: null })])
    render(<Marketing />)
    expect(await screen.findByText('Boutique Teranga')).toBeTruthy()
    expect(pills('Détail')).toHaveLength(0)
    expect(pills('Grossiste')).toHaveLength(0)
  })

  it('⚠️ type INCONNU → aucune pastille non plus (pas de palier deviné)', async () => {
    customersList.mockResolvedValue([CUST({ type: 'VIP' })])
    render(<Marketing />)
    expect(await screen.findByText('Boutique Teranga')).toBeTruthy()
    expect(pills('Détail')).toHaveLength(0)
    expect(pills('VIP')).toHaveLength(0)
  })

  it('type vide (chaîne blanche) → aucune pastille', async () => {
    customersList.mockResolvedValue([CUST({ type: '   ' })])
    render(<Marketing />)
    expect(await screen.findByText('Boutique Teranga')).toBeTruthy()
    expect(pills('Détail')).toHaveLength(0)
  })
})
