import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * Modale « Nouvel abonnement » — helpers purs + test d'ancrage.
 *
 * Fige le résultat de la refonte : le panier est le seul bloc en relief, le total vit
 * dans le pied épinglé (et vaut « — », jamais « 0 F », tant qu'il est vide), aucun jour
 * n'est présélectionné, et « Enregistrer » reste ACTIF en NOMMANT ce qui manque
 * (il ne s'éteint que pendant l'envoi — cf. la méta-règle « aucun CTA désactivé »).
 *
 * Le contraste du montant est MESURÉ ici, pas supposé : c'est cette mesure qui justifie
 * la bascule sur `--text` en thème clair.
 */

const { mockState } = vi.hoisted(() => ({
  mockState: { lang: 'fr', currency: 'XOF', theme: 'dark' as string },
}))

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/api', () => ({
  subscriptionsApi: { create: vi.fn(), update: vi.fn() },
  customersApi: { search: vi.fn().mockResolvedValue([]) },
  productsApi: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/lib/announce', () => ({ announce: vi.fn() }))
vi.mock('@/hooks/useModalFocus', () => ({ useModalFocus: () => ({ current: null }) }))
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  const useAppStore = Object.assign(
    vi.fn((sel?: (s: typeof mockState) => unknown) => (sel ? sel(mockState) : mockState)),
    { getState: () => mockState },
  )
  return { ...actual, useAppStore, useFormatAmount: () => (n: number) => `${n.toLocaleString('fr-FR')} F` }
})

import SubscriptionModal from '@/components/subscriptions/SubscriptionModal'
import {
  totalAmountColor, missingSubscriptionFields, missingLabel,
  subscriptionTotal, firstDeliveryFrom, toDateInput,
} from '@/components/subscriptions/subscriptionShared'

// ─── Contraste (mêmes formules que contrast-aa.test.ts) ───────────────────────
function lin(c: number) { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
function luminance(hex: string) {
  const m = hex.replace('#', '')
  return 0.2126 * lin(parseInt(m.slice(0, 2), 16)) + 0.7152 * lin(parseInt(m.slice(2, 4), 16)) + 0.0722 * lin(parseInt(m.slice(4, 6), 16))
}
function ratio(a: string, b: string) {
  const l1 = luminance(a), l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
/** color-mix(in srgb, fg pct%, bg) */
function mix(fg: string, bg: string, pct: number) {
  const f = fg.replace('#', ''), b = bg.replace('#', '')
  let out = '#'
  for (const i of [0, 2, 4]) {
    out += Math.round(parseInt(f.slice(i, i + 2), 16) * pct + parseInt(b.slice(i, i + 2), 16) * (1 - pct))
      .toString(16).padStart(2, '0')
  }
  return out
}

const ACC = '#FFB020'
const BG2_LIGHT = '#F0F2FF', TEXT_LIGHT = '#1A1A2E'   // THEMES.light.vars
const BG2_DARK  = '#0D1019', TEXT_DARK  = '#EAEEF6'   // :root sombre
const PANEL_LIGHT = mix(ACC, BG2_LIGHT, 0.08)
const PANEL_DARK  = mix(ACC, BG2_DARK, 0.08)
const AA_LARGE = 3

describe('contraste du montant total — mesuré', () => {
  it('--acc sur le panneau or ÉCHOUE en thème clair (< 3:1) : voilà pourquoi on bascule', () => {
    expect(ratio(ACC, PANEL_LIGHT)).toBeLessThan(AA_LARGE)
  })

  it('--acc sur le panneau or PASSE largement en thème sombre', () => {
    expect(ratio(ACC, PANEL_DARK)).toBeGreaterThanOrEqual(AA_LARGE)
  })

  it('les couleurs RÉELLEMENT choisies passent AA large dans les deux thèmes', () => {
    expect(totalAmountColor('dark')).toBe('var(--acc)')
    expect(totalAmountColor('light')).toBe('var(--text)')
    expect(ratio(ACC, PANEL_DARK)).toBeGreaterThanOrEqual(AA_LARGE)
    expect(ratio(TEXT_LIGHT, PANEL_LIGHT)).toBeGreaterThanOrEqual(AA_LARGE)
  })

  it('le panneau teinté or est conservé dans les deux thèmes (c\'est lui qui porte l\'accent)', () => {
    expect(PANEL_LIGHT).not.toBe(BG2_LIGHT)
    expect(PANEL_DARK).not.toBe(BG2_DARK)
  })

  it('« system » est résolu, jamais comparé littéralement', () => {
    // matchMedia absent en jsdom → resolveTheme retombe sur sombre.
    expect(totalAmountColor('system')).toBe('var(--acc)')
    expect(ratio(TEXT_DARK, PANEL_DARK)).toBeGreaterThanOrEqual(AA_LARGE)
  })
})

describe('missingSubscriptionFields — pas de faux « prêt »', () => {
  const base = { hasCustomer: false, name: '', itemCount: 0, dayOfWeek: null as number | null }

  it('à l\'ouverture : les quatre manquent, jour compris', () => {
    expect(missingSubscriptionFields(base)).toEqual(['customer', 'name', 'items', 'day'])
  })

  it('un nom d\'espaces ne compte pas comme rempli', () => {
    expect(missingSubscriptionFields({ ...base, name: '   ' })).toContain('name')
  })

  it('le jour reste manquant tant qu\'il est null — même complet par ailleurs', () => {
    expect(missingSubscriptionFields({ hasCustomer: true, name: 'Panier', itemCount: 2, dayOfWeek: null })).toEqual(['day'])
  })

  it('dimanche (0) est un jour VALIDE, pas une absence', () => {
    expect(missingSubscriptionFields({ hasCustomer: true, name: 'Panier', itemCount: 1, dayOfWeek: 0 })).toEqual([])
  })

  it('les manques sont NOMMÉS, dans les 4 langues', () => {
    expect(missingLabel(['customer', 'day'], 'fr')).toBe('Il manque : le client, le jour de livraison.')
    expect(missingLabel(['items'], 'en')).toBe('Missing: at least one product.')
    expect(missingLabel(['items'], 'es')).toBe('Falta: al menos un producto.')
    expect(missingLabel(['items'], 'it')).toBe('Manca: almeno un prodotto.')
    expect(missingLabel([], 'fr')).toBe('')
  })
})

describe('subscriptionTotal', () => {
  it('somme prix unitaire × quantité', () => {
    expect(subscriptionTotal([
      { quantity: 2, product: { sellPrice: 4500 } },
      { quantity: 3, product: { sellPrice: 1300 } },
    ])).toBe(12900)
  })
  it('panier vide → 0 (l\'UI, elle, affiche « — »)', () => {
    expect(subscriptionTotal([])).toBe(0)
  })
})

describe('firstDeliveryFrom — la date affichée est la VRAIE première livraison', () => {
  const TODAY = new Date('2026-07-24T09:00:00.000Z') // vendredi

  it('date de début un LUNDI, livraison le JEUDI → jeudi suivant, pas le lundi saisi', () => {
    // 2026-08-03 est un lundi ; premier jeudi ≥ = 2026-08-06
    const d = firstDeliveryFrom('2026-08-03', 4, TODAY)
    expect(d?.toISOString().slice(0, 10)).toBe('2026-08-06')
  })

  it('date de début tombant PILE sur le jour livré → c\'est ce jour-là', () => {
    expect(firstDeliveryFrom('2026-08-06', 4, TODAY)?.toISOString().slice(0, 10)).toBe('2026-08-06')
  })

  it('sans date de début → prochaine occurrence à partir d\'aujourd\'hui', () => {
    expect(firstDeliveryFrom('', 4, TODAY)?.toISOString().slice(0, 10)).toBe('2026-07-30')
  })

  it('date de début PASSÉE → on ne ressuscite pas une livraison écoulée', () => {
    expect(firstDeliveryFrom('2026-01-05', 4, TODAY)?.toISOString().slice(0, 10)).toBe('2026-07-30')
  })

  it('aucun jour choisi → aucune promesse de date', () => {
    expect(firstDeliveryFrom('2026-08-03', null, TODAY)).toBeNull()
  })

  it('« aujourd\'hui » est injecté (fonction pure)', () => {
    const other = new Date('2026-09-01T00:00:00.000Z')
    expect(firstDeliveryFrom('', 4, other)?.toISOString().slice(0, 10)).toBe('2026-09-03')
  })
})

describe('toDateInput', () => {
  it('ISO → YYYY-MM-DD ; absent/invalide → chaîne vide', () => {
    expect(toDateInput('2026-08-06T00:00:00.000Z')).toBe('2026-08-06')
    expect(toDateInput(null)).toBe('')
    expect(toDateInput(undefined)).toBe('')
    expect(toDateInput('pas une date')).toBe('')
  })
})

describe('ancrage — modale à l\'ouverture', () => {
  beforeEach(() => { mockState.theme = 'dark' })

  const open = () => render(
    <SubscriptionModal lang="fr" sub={null} onClose={() => {}} onSaved={() => {}} />
  )

  it('le panier vide se NOMME (pas une zone muette)', () => {
    open()
    expect(screen.getByText('Panier vide — ajoutez les articles')).toBeTruthy()
  })

  it('le total vaut « — », jamais « 0 F » — un zéro affirmerait un montant', () => {
    const { container } = open()
    expect(screen.getByText('—')).toBeTruthy()
    expect(container.textContent).not.toContain('0 F')
  })

  it('AUCUN jour n\'est présélectionné', () => {
    open()
    const days = screen.getAllByRole('button', { pressed: false })
    expect(days.length).toBeGreaterThanOrEqual(7)
    expect(screen.queryByRole('button', { pressed: true })).toBeNull()
    expect(screen.getByText('Aucun jour choisi — sélectionnez-en un.')).toBeTruthy()
  })

  it('« Enregistrer » est ACTIF ET dit ce qui manque', () => {
    open()
    const save = screen.getByRole('button', { name: /Enregistrer/ }) as HTMLButtonElement
    // ⚠️ Ce test exigeait `save.disabled === true`. La liste des manques était DÉJÀ
    // affichée juste au-dessus du bouton : l'éteindre n'ajoutait qu'un refus muet.
    // Il ne se désactive plus que pendant l'envoi.
    expect(save.disabled).toBe(false)
    expect(screen.getByText('Il manque : le client, le nom du panier, au moins un produit, le jour de livraison.')).toBeTruthy()
  })

  it('la fréquence est écrite noir sur blanc, pas devinée', () => {
    open()
    expect(screen.getByText('Chaque semaine')).toBeTruthy()
  })

  it('le total porte « au tarif du jour » (dérivé du catalogue, pas figé)', () => {
    open()
    expect(screen.getByText('au tarif du jour')).toBeTruthy()
  })

  it('la note est marquée facultative', () => {
    open()
    expect(screen.getByText(/Note \(facultatif\)/)).toBeTruthy()
  })
})
