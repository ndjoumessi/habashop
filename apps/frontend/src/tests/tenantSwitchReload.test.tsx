import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * JUSTESSE EMPRUNTÉE — la bascule de boutique RECHARGE l'application.
 *
 * ─── POURQUOI CE VERROU EXISTE ───────────────────────────────────────────────
 * `pages/Expenses.tsx` charge les budgets dans un `useEffect(..., [])` : une seule
 * fois, au montage. Ce code n'est correct QUE parce qu'un autre fichier —
 * `TenantSwitcher` — fait `window.location.assign(...)` après `switchTenant`, donc
 * remonte toute l'application. Sans ce rechargement, un gérant multi-boutiques
 * basculerait de Dakar vers Abidjan et continuerait de voir les budgets de Dakar :
 * des montants qui ne sont pas ceux de la boutique affichée, sur un écran d'argent.
 *
 * ⚠️ C'est le motif `spendGuard.quotaLimit` : une expression correcte uniquement
 * grâce à un invariant DISTANT. *Une justesse qui dépend d'un invariant distant et
 * que rien n'enregistre disparaît au premier réordonnancement* — ici, le jour où
 * quelqu'un remplacera la navigation dure par un `navigate()` client, ce qui est
 * une amélioration parfaitement raisonnable et invisible depuis `Expenses.tsx`.
 *
 * Ce test ne garde pas les budgets. Il garde CE DONT ils dépendent.
 */

const TENANTS = [
  { id: 'boutique-a', name: 'Dakar Central', role: 'ADMIN' },
  { id: 'boutique-b', name: 'Abidjan Koné', role: 'ADMIN' },
]

vi.mock('@/lib/api', () => ({
  authApi: {
    switchTenant: vi.fn(async (tenantId: string) => ({
      token: `jeton-${tenantId}`,
      tenant: { id: tenantId, name: tenantId === 'boutique-b' ? 'Abidjan Koné' : 'Dakar Central' },
      role: 'ADMIN',
    })),
  },
}))

/** `window.location` n'est pas assignable en jsdom : on remplace l'objet entier. */
let navigations: string[] = []
beforeEach(() => {
  navigations = []
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign: (u: string) => { navigations.push(u) }, href: 'http://localhost/', origin: 'http://localhost' },
  })
})

async function monter() {
  const { useAuthStore } = await import('@/stores/authStore')
  useAuthStore.setState({
    tenants: TENANTS as never,
    activeTenantId: 'boutique-a',
    user: { id: 'u1', role: 'ADMIN', name: 'Test', email: 't@x.com' } as never,
    token: 'jeton-a',
    isAuthenticated: true,
  })
  const { default: TenantSwitcher } = await import('@/components/layout/TenantSwitcher')
  return render(<TenantSwitcher collapsed={false} />)
}

describe('bascule de boutique', () => {
  it('⚠️ RECHARGE l’application — c’est ce dont dépend le chargement des budgets', async () => {
    const { container } = await monter()
    fireEvent.click(container.querySelector('button')!)          // ouvre la liste
    fireEvent.click(await screen.findByRole('option', { name: /Abidjan Koné/ }))     // choisit l'autre boutique

    await waitFor(() => expect(navigations.length).toBeGreaterThan(0))
    expect(
      navigations.length,
      'la bascule ne recharge plus l’app : les données chargées au montage (budgets de dépense) '
      + 'resteront celles de la boutique PRÉCÉDENTE. Voir pages/Expenses.tsx, useEffect([]).',
    ).toBe(1)
  })

  it('le jeton ET la boutique active ont bien changé avant le rechargement', async () => {
    const { container } = await monter()
    fireEvent.click(container.querySelector('button')!)
    fireEvent.click(await screen.findByRole('option', { name: /Abidjan Koné/ }))

    const { useAuthStore } = await import('@/stores/authStore')
    await waitFor(() => expect(useAuthStore.getState().activeTenantId).toBe('boutique-b'))
    expect(useAuthStore.getState().token).toBe('jeton-boutique-b')
  })

  it('choisir la boutique DÉJÀ active ne recharge rien', async () => {
    const { container } = await monter()
    fireEvent.click(container.querySelector('button')!)
    fireEvent.click(await screen.findByRole('option', { name: /Dakar Central/ }))
    await new Promise(r => setTimeout(r, 20))
    expect(navigations, 'un rechargement inutile perd la position de défilement et l’état d’écran').toEqual([])
  })
})
