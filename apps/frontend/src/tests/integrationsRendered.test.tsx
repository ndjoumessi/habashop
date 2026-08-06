import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

/**
 * VÉRIFICATION SUR LE DOM RENDU — ① et ③.
 *
 * ⚠️ Ces deux défauts ne se voient pas dans la source : ils naissent à l'exécution.
 *   ①c  « 3/2 OK » et « Joignables … » venaient d'une clé écrite dans `pingStatus` par
 *       une intégration ABSENTE de la liste affichée (`sentry`). La source était valide ;
 *       c'est l'arithmétique au montage qui était fausse.
 *   ③   la taille et la couleur du symbole de devise ne s'évaluent que rendues.
 *
 * On monte donc les VRAIS composants. Un test qui grep le source resterait vert si le
 * bloc devenait inatteignable, et rougirait sur un simple reformatage.
 */

const { mockState } = vi.hoisted(() => ({ mockState: { lang: 'fr', currency: 'XOF' } }))

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/components/integrations/OpsInfrastructure', () => ({ default: () => <div /> }))

const api = vi.hoisted(() => ({
  paymentStatsApi: { today: vi.fn() },
  paydunyaApi: { config: vi.fn() },
  integrationStatusApi: { get: vi.fn() },
}))
vi.mock('@/lib/api', () => api)

import Integrations from '@/pages/Integrations'
import { AmountCur } from '@/components/customers/customersShared'

beforeEach(() => {
  vi.clearAllMocks()
  mockState.currency = 'XOF'
  api.paymentStatsApi.today.mockResolvedValue({
    mtn: { count: 0, amountXof: 0, lastAt: null },
    campay: { count: 0, amountXof: 0, lastAt: null },
    paydunya: { count: 0, amountXof: 0, lastAt: null },
  })
  api.paydunyaApi.config.mockResolvedValue({ configured: false, mode: 'test', methods: [] })
  api.integrationStatusApi.get.mockResolvedValue({
    states: { twilio: 'live', resend: 'live', mtnmomo: 'sandbox', campay: 'sandbox', paydunya: 'unconfigured' },
  })
  /**
   * ⚠️ Les pings doivent RÉUSSIR, et ce détail est load-bearing.
   *
   * Première version de ce fichier : `fetch` rejetait (jsdom n'a pas de réseau). Les deux
   * hôtes passaient donc en `error`, `anyError` devenait vrai et la barre affichait
   * « Certains hôtes sont injoignables » — court-circuitant la branche même qu'on teste.
   * Le sabotage a été appliqué, et les 8 cas sont restés VERTS.
   *
   * Un test qui ne peut pas atteindre le chemin fautif est vert pour la mauvaise raison.
   * Avec des pings qui répondent, la forme d'origine produit exactement « 3/2 OK » et fige
   * « Vérification en cours… » — les deux symptômes mesurés en production.
   */
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response))
})

describe('① le compteur de joignabilité ne dépasse plus son dénominateur', () => {
  it('numérateur ≤ dénominateur, et le dénominateur est celui des cartes affichées', async () => {
    const { container } = render(<Integrations />)
    await waitFor(() => expect(api.integrationStatusApi.get).toHaveBeenCalled())

    // ⚠️ LE DÉFAUT D'ORIGINE, dans sa forme exacte : « 3/2 OK ».
    await waitFor(() => {
      const m = /(\d+)\/(\d+)\s+OK/.exec(container.textContent ?? '')
      expect(m, 'le compteur « N/M OK » doit être rendu').not.toBeNull()
      const [, n, d] = m!
      expect(Number(n)).toBeLessThanOrEqual(Number(d))
    })
  })

  it('« Joignables » se RÉSOUT — il ne reste pas figé sur « … »', async () => {
    const { container } = render(<Integrations />)
    await waitFor(() => expect(api.integrationStatusApi.get).toHaveBeenCalled())

    // Avant : `allChecked` comparait 3 clés à 2 cartes → faux pour toujours, donc « … »
    // permanent et barre bloquée sur « Vérification en cours… ».
    await waitFor(() => {
      expect(container.textContent).not.toMatch(/Vérification en cours/)
    }, { timeout: 3000 })
  })
})

describe('① le vocabulaire dit ce qui est mesuré', () => {
  it('« configurées » et non « connectées » — la valeur vient des secrets serveur', async () => {
    const { container } = render(<Integrations />)
    await waitFor(() => expect(container.textContent).toMatch(/configurées/i))
    expect(container.textContent).not.toMatch(/\bconnectées\b/)
  })

  it('avant la réponse du serveur, RIEN n’est présenté comme configuré', async () => {
    // Une promesse qui ne se résout jamais : l'état « je ne sais pas ».
    api.integrationStatusApi.get.mockReturnValue(new Promise(() => {}))
    const { container } = render(<Integrations />)
    await waitFor(() => expect(container.textContent).toMatch(/Vérification/))
    // ⚠️ Aucun « N/5 configurées » optimiste tant que le serveur n'a pas répondu.
    expect(container.textContent).not.toMatch(/\d\/\d\s*configurées/)
  })

  it('le titre ne s’appelle plus comme l’autre entrée de menu', async () => {
    render(<Integrations />)
    // « API & Intégrations » était le titre de CETTE page ET le libellé de menu de /api-docs.
    expect(await screen.findByRole('heading', { name: /Paiements & canaux/ })).toBeInTheDocument()
  })
})

describe('③ le symbole de devise est lisible comme le montant', () => {
  const symbole = (c: HTMLElement) => [...c.querySelectorAll('span')].at(-1)!

  it('il hérite de la taille du chiffre — plus de 10 px figés', () => {
    const { container } = render(<AmountCur xof={280000} />)
    const s = symbole(container)
    expect(s.style.fontSize).toBe('inherit')
  })

  it('il n’est plus rendu dans le token de texte le plus faible', () => {
    const { container } = render(<AmountCur xof={280000} />)
    // ⚠️ `--text3` (#8E96AA) était le plus faible des trois. Sur un produit où XOF et EUR
    // diffèrent d'un facteur 656, le symbole est ce qui rend le nombre interprétable.
    expect(symbole(container).style.color).not.toContain('--text3')
    expect(symbole(container).style.color).not.toContain('--text4')
  })

  it('le symbole est bien RENDU, pas seulement stylé', () => {
    const { container } = render(<AmountCur xof={1500} />)
    expect(container.textContent).toMatch(/FCFA/)
  })
})
