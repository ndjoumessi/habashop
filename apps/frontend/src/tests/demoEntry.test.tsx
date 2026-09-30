import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LandingHero from '@/components/landing/LandingHero'
import { LANDING_TRANSLATIONS } from '@/components/landing/landingShared'

/**
 * ENTRÉE DE LA DÉMO DEPUIS LA VITRINE.
 *
 * ⚠️ On rend le VRAI composant et on juge le DOM RENDU, pas la source : le masquage
 * conditionnel est du CSS, et la source dit ce qui est écrit, pas ce qui est affiché.
 */
const LANGUES = ['fr', 'en', 'es', 'it'] as const
const FR = LANDING_TRANSLATIONS.fr
const i = (fr: string) => fr

function monter(onDemo = vi.fn(), demoEnCours = false) {
  render(
    <LandingHero
      lp={FR}
      i={i as unknown as (fr: string, en: string, es: string, it: string) => string}
      navigate={vi.fn()}
      onDemo={onDemo}
      demoEnCours={demoEnCours}
    />,
  )
  return { onDemo }
}

describe('bouton de démo du hero', () => {
  it('le bouton est présent et porte le libellé de la langue courante', () => {
    monter()
    expect(screen.getByRole('button', { name: new RegExp(FR.cta_demo, 'i') })).toBeTruthy()
  })

  it('un clic déclenche l’ouverture de la démo', () => {
    const { onDemo } = monter()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(FR.cta_demo, 'i') }))
    expect(onDemo).toHaveBeenCalledTimes(1)
  })

  it('⚠️ pendant la requête, le bouton est éteint — une seule démo par double clic', () => {
    const { onDemo } = monter(vi.fn(), true)
    // ⚠️ En cours de requête le libellé devient « Ouverture… » : chercher `/démo/i` seul ne
    // trouverait rien, et le test échouerait pour la mauvaise raison.
    const b = screen.getByRole('button', { name: /ouverture/i }) as HTMLButtonElement
    expect(b.disabled).toBe(true)
    fireEvent.click(b)
    expect(onDemo).not.toHaveBeenCalled()
  })

  it('⚠️ HORS requête, il n’est JAMAIS éteint — aucune validation ne le gouverne', () => {
    monter(vi.fn(), false)
    expect((screen.getByRole('button', { name: /démo/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('pendant la requête, l’état est annoncé aux lecteurs d’écran', () => {
    monter(vi.fn(), true)
    expect(screen.getByRole('button', { name: /démo|ouverture/i }).getAttribute('aria-busy')).toBe('true')
  })

  it('le CTA principal « Créer ma boutique » reste présent et PREMIER', () => {
    monter()
    const libelles = screen.getAllByRole('button').map(b => b.textContent ?? '')
    const iCta = libelles.findIndex(t => t.includes(FR.cta1))
    const iDemo = libelles.findIndex(t => t.includes(FR.cta_demo))
    expect(iCta).toBeGreaterThanOrEqual(0)
    expect(iDemo).toBeGreaterThanOrEqual(0)
    expect(iCta).toBeLessThan(iDemo)
  })

  it('⚠️ le libellé existe dans les QUATRE langues et aucune n’est vide', () => {
    for (const langue of LANGUES) {
      const v = LANDING_TRANSLATIONS[langue].cta_demo
      expect(v, `cta_demo manquant en ${langue}`).toBeTruthy()
      expect(String(v).trim().length).toBeGreaterThan(0)
    }
  })

  it('⚠️ les quatre libellés sont DISTINCTS — un copier-coller du français se verrait ici', () => {
    const vus = new Set(LANGUES.map(l => LANDING_TRANSLATIONS[l].cta_demo))
    expect(vus.size).toBeGreaterThan(1)
  })
})
