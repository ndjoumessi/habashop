import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PLANS, planAmountXOF, amountEur, purchasablePlans } from '@/lib/plans'
import { LANDING_TRANSLATIONS } from '@/components/landing/landingShared'
import LandingPricing from '@/components/landing/LandingPricing'

/**
 * Le prix AFFICHÉ vient-il vraiment du catalogue ?
 *
 * `planCatalog.test.ts` prouve que les constantes coïncident des deux côtés. Il ne dit
 * RIEN de ce que le visiteur lit : c'est la limite de tout test qui grep du source, et
 * c'est exactement ainsi qu'une grille correcte a pu coexister avec un affichage faux.
 * Ce fichier monte donc le VRAI composant et lit les montants rendus.
 */

const lp = LANDING_TRANSLATIONS.fr
const i = (fr: string) => fr
const fcfa = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const eur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountEur(n))

/** Normalise les espaces insécables que `Intl` insère dans les milliers. */
const flat = (s: string) => s.replace(/[\u202f\u00a0\u2009]/g, ' ')

const renderGrid = () => {
  const navigate = vi.fn()
  const utils = render(<LandingPricing lp={lp} i={i} navigate={navigate} />)
  return { navigate, ...utils }
}

describe('grille tarifaire rendue — mensuel', () => {
  it('affiche le prix CATALOGUE de chaque plan achetable', () => {
    const { container } = renderGrid()
    const text = flat(container.textContent ?? '')
    for (const p of purchasablePlans()) {
      expect(text, `${p.id} mensuel absent`).toContain(flat(fcfa(p.monthly!)))
      expect(text, `${p.id} euro absent`).toContain(flat(eur(p.monthly!)))
    }
  })

  it('Enterprise est sur devis : aucun prix, et le CTA renvoie au contact', () => {
    const { container } = renderGrid()
    const text = flat(container.textContent ?? '')
    expect(text).toContain('Sur devis')
    expect(text).toContain(lp.contact_us)
    // Aucun montant ne doit apparaître pour un plan sans tarif public.
    const e = PLANS.find(p => p.id === 'enterprise')!
    expect(e.monthly).toBeNull()
  })

  it('pas de « ≈ » : le franc CFA est arrimé à l’euro à taux FIXE', () => {
    const { container } = renderGrid()
    expect(container.textContent).not.toContain('≈')
  })
})

describe('bascule mensuel / annuel — elle est réelle (yearly = monthly × 10)', () => {
  it('bascule vers l’annuel et affiche les prix annuels du catalogue', () => {
    const { container } = renderGrid()
    fireEvent.click(screen.getByText(lp.period_yearly))
    const text = flat(container.textContent ?? '')
    for (const p of purchasablePlans()) {
      expect(text, `${p.id} annuel absent`).toContain(flat(fcfa(p.yearly!)))
      expect(text).toContain(flat(eur(p.yearly!)))
    }
    expect(text).toContain(lp.months_free)
  })

  it('la remise est annoncée en MOIS OFFERTS, jamais en « −20 % » (2/12 = 16,7 %)', () => {
    const { container } = renderGrid()
    fireEvent.click(screen.getByText(lp.period_yearly))
    expect(container.textContent).not.toMatch(/-\s?20\s?%|−\s?20\s?%/)
  })

  it('revenir au mensuel restaure les prix mensuels', () => {
    const { container } = renderGrid()
    fireEvent.click(screen.getByText(lp.period_yearly))
    fireEvent.click(screen.getByText(lp.period_monthly))
    expect(flat(container.textContent ?? '')).toContain(flat(fcfa(planAmountXOF('starter', 'monthly')!)))
  })
})

describe('les CTA envoient l’identifiant que le BACKEND connaît', () => {
  it('un plan achetable navigue vers /signup avec son id canonique et la période', () => {
    const { navigate } = renderGrid()
    const cards = screen.getAllByText(lp.try_free)
    fireEvent.click(cards[0])
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/signup\?plan=(starter|business)&period=monthly$/))
  })

  it('jamais l’alias `pro` — il est accepté en lecture, plus jamais émis', () => {
    const { navigate } = renderGrid()
    for (const btn of screen.getAllByText(lp.try_free)) fireEvent.click(btn)
    for (const call of navigate.mock.calls) expect(String(call[0])).not.toContain('plan=pro')
  })

  it('Enterprise n’a pas de CTA d’achat', () => {
    renderGrid()
    // Autant de boutons « Essayer 14 jours » que de plans ACHETABLES, pas un de plus.
    expect(screen.getAllByText(lp.try_free)).toHaveLength(purchasablePlans().length)
  })
})

describe('sabotage vérifié : un prix figé dans le composant serait vu', () => {
  it('le rendu suit le catalogue, pas une constante locale', () => {
    // Contre-preuve de raisonnement : si le composant portait un montant en dur, le
    // premier `describe` comparerait le catalogue à lui-même et resterait vert. C'est
    // pourquoi `planCatalog.test.ts` interdit EN PLUS tout littéral dans le fichier.
    const src = readFileSync(resolve(__dirname, '..', 'components', 'landing', 'LandingPricing.tsx'), 'utf8')
    expect(src).toContain("from '@/lib/plans'")
    expect(src).not.toMatch(/\b(8000|25000|80000|250000)\b/)
  })
})
