import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DemoExpiredNotice from '@/components/landing/DemoExpiredNotice'
import { useAppStore } from '@/stores/appStore'

/**
 * ⚠️ LA REDIRECTION PROMETTAIT UNE EXPLICATION QUI N'EXISTAIT PAS.
 *
 * Défaut trouvé en revue : l'intercepteur 401 redirigeait vers `/?demo=expiree`, et ce
 * paramètre n'était lu NULLE PART. Comme la redirection est un `window.location.href`, la
 * page est entièrement rechargée : l'erreur levée juste après est perdue avec le contexte JS.
 * Le visiteur atterrissait sur la page marketing, son travail disparu, sans une ligne
 * d'explication.
 */
beforeEach(() => { useAppStore.setState({ lang: 'fr' } as never) })

function monter(recherche: string) {
  return render(<DemoExpiredNotice recherche={recherche} />)
}

describe('DemoExpiredNotice', () => {
  it('⚠️ sans le paramètre, RIEN ne s’affiche — pas de bandeau sur une visite ordinaire', () => {
    const { container } = monter('')
    expect(container.textContent?.trim()).toBe('')
  })

  it('avec `?demo=expiree`, explique ce qui s’est passé', () => {
    monter('?demo=expiree')
    expect(screen.getByRole('status').textContent).toMatch(/démonstration/i)
  })

  it('⚠️ et dit quoi faire ensuite — un message qui constate sans orienter ne sert à rien', () => {
    monter('?demo=expiree')
    expect(screen.getByRole('status').textContent).toMatch(/nouvelle|boutique|recommenc/i)
  })

  it('porte `role=status` et `aria-live` — le message apparaît après le chargement', () => {
    monter('?demo=expiree')
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })

  it('une valeur inattendue du paramètre n’affiche rien', () => {
    const { container } = monter('?demo=bonjour')
    expect(container.textContent?.trim()).toBe('')
  })

  it('⚠️ le message existe dans les quatre langues', () => {
    for (const l of ['fr', 'en', 'es', 'it'] as const) {
      useAppStore.setState({ lang: l } as never)
      const { unmount } = monter('?demo=expiree')
      expect(screen.getByRole('status').textContent?.trim().length, `vide en ${l}`).toBeGreaterThan(10)
      unmount()
    }
  })
})
