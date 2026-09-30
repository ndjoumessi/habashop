import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DemoBanner from '@/components/layout/DemoBanner'

/**
 * BANDEAU D'UNE DÉMO JETABLE.
 *
 * ⚠️ L'échéance vient du SERVEUR. Un « +7 jours » recalculé côté client serait un champ
 * DÉCLARÉ : il ne pourrait pas être faux, donc ne prouverait rien, et mentirait dès que le
 * délai serveur changerait.
 */
const T0 = new Date('2026-10-01T12:00:00.000Z')

describe('DemoBanner', () => {
  it('affiche l’échéance SERVEUR, formatée jj/mm/aaaa', () => {
    // ⚠️ L'échéance choisie N'EST PAS `maintenant + 7 jours` : avec +7 j, un recalcul
    // client produirait exactement la même date et le test ne discriminerait RIEN. La
    // première version de ce test était calée sur cette coïncidence — mesuré, le sabotage
    // passait vert.
    render(<DemoBanner demoExpiresAt="2026-11-20T12:00:00.000Z" maintenant={T0} />)
    expect(screen.getByText(/20\/11\/2026/)).toBeTruthy()
  })

  it('⚠️ sans échéance, le bandeau ne s’affiche PAS — pas de bandeau sur une vraie boutique', () => {
    const { container } = render(<DemoBanner demoExpiresAt={null} maintenant={T0} />)
    expect(container.textContent?.trim()).toBe('')
  })

  it('⚠️ une échéance illisible n’affiche AUCUNE date plutôt qu’une date fausse', () => {
    render(<DemoBanner demoExpiresAt="pas-une-date" maintenant={T0} />)
    expect(screen.queryByText(/NaN|Invalid|pas-une-date/i)).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy() // le bandeau se dit quand même démo
  })

  it('dit qu’il s’agit d’une démonstration, pas seulement une date', () => {
    render(<DemoBanner demoExpiresAt="2026-11-20T12:00:00.000Z" maintenant={T0} />)
    expect(screen.getByRole('status').textContent).toMatch(/démonstration/i)
  })

  it('⚠️ une démo DÉJÀ expirée le dit — et ne prétend pas expirer dans le futur', () => {
    render(<DemoBanner demoExpiresAt="2026-09-01T12:00:00.000Z" maintenant={T0} />)
    const txt = screen.getByRole('status').textContent ?? ''
    expect(txt).toMatch(/expirée/i)
    expect(txt).not.toMatch(/expire le/i)
  })

  it('porte un `role=status` avec `aria-live` — le changement d’état est annoncé', () => {
    render(<DemoBanner demoExpiresAt="2026-10-08T12:00:00.000Z" maintenant={T0} />)
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })

  it('⚠️ le jour AFFICHÉ ne décale pas — découpage de chaîne, pas toLocaleDateString', () => {
    // Une échéance tôt dans la journée UTC : `new Date(iso).toLocaleDateString()` en fuseau
    // négatif rendrait le 04 au lieu du 05.
    render(<DemoBanner demoExpiresAt="2026-10-05T01:00:00.000Z" maintenant={T0} />)
    expect(screen.getByText(/05\/10\/2026/)).toBeTruthy()
  })
})
