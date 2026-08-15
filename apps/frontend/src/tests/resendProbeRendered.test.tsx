import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

/**
 * LA SONDE D'EXPÉDITION, SUR LE DOM RENDU.
 *
 * ── Ce qu'elle remplace ──────────────────────────────────────────────────────────────
 * Un panneau « Monitoring temps réel · LIVE » qui inventait ses données au `Math.random()`
 * toutes les 5 s, et affichait « Domaine : resend.dev » en LITTÉRAL — sans savoir si
 * c'était vrai, ni si un domaine propre avait été vérifié entre-temps. Elle vit désormais
 * dans la console PLATEFORME : le compte Resend est de la stack, pas du commerçant.
 *
 * ── Pourquoi sur le rendu, et pas sur la source ──────────────────────────────────────
 * La couleur d'une pastille et le choix entre quatre libellés ne s'évaluent qu'au montage,
 * à partir d'une réponse serveur. Un test qui grep la source resterait vert si le bloc
 * devenait inatteignable — c'est arrivé deux fois dans ce dépôt.
 */

const { mockState } = vi.hoisted(() => ({ mockState: { lang: 'fr', currency: 'XOF' } }))
vi.mock('@/stores/appStore', () => ({
  useAppStore: (sel?: (s: typeof mockState) => unknown) => (sel ? sel(mockState) : mockState),
  useFormatAmount: () => (n: number) => String(n),
}))

const api = vi.hoisted(() => ({
  sentryStatusApi: { check: vi.fn() },
  resendAccountApi: { get: vi.fn() },
}))
vi.mock('@/lib/api', () => api)

import OpsInfrastructure from '@/components/integrations/OpsInfrastructure'

const COMPTE = {
  configured: true,
  expediteur: 'HabaShop <bonjour@habashop.com>',
  domaineExpedition: 'habashop.com',
  domaineVerifie: true as boolean | null,
  domaines: [{ name: 'habashop.com', verified: true, statut: 'verified' }],
  echec: null as string | null,
  mesureA: '2026-08-15T04:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  api.sentryStatusApi.check.mockResolvedValue({ connected: true, projectName: 'habashop-web', errorRate: '0', ms: 42 })
  api.resendAccountApi.get.mockResolvedValue({ ...COMPTE })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response))
})

const texte = (c: HTMLElement) => c.textContent ?? ''

describe('la sonde d’expédition dit ce qu’elle mesure', () => {
  it('domaine vérifié → le dit, et NOMME le domaine réellement employé', async () => {
    const { container } = render(<OpsInfrastructure />)
    await waitFor(() => expect(texte(container)).toMatch(/Domaine d’expédition e-mail/))
    // ⚠️ Le domaine vient du SERVEUR (`EMAIL_FROM`), il n'est plus écrit dans le dépôt.
    await waitFor(() => expect(texte(container)).toMatch(/habashop\.com/))
    expect(texte(container)).toMatch(/vérifié/)
    expect(texte(container)).not.toMatch(/non concluant/)
  })

  it('⚠️ resend.dev NON vérifié → la CONSÉQUENCE est nommée, pas seulement l’état', async () => {
    // « non vérifié » seul ne dit pas ce qu'on risque. Ce qui change une décision, c'est
    // que la réputation d'expédition soit celle d'inconnus.
    api.resendAccountApi.get.mockResolvedValue({
      ...COMPTE, expediteur: 'HabaShop <onboarding@resend.dev>',
      domaineExpedition: 'resend.dev', domaineVerifie: false,
      domaines: [{ name: 'habashop.com', verified: true, statut: 'verified' }],
    })
    const { container } = render(<OpsInfrastructure />)
    await waitFor(() => expect(texte(container)).toMatch(/resend\.dev/))
    expect(texte(container)).toMatch(/réputation d’expédition partagée/)
  })

  it('⚠️ clé absente → NON CONCLUANT avec sa cause, jamais « non vérifié »', async () => {
    // Trois états, pas deux : ne pas savoir n'est pas une affirmation sur le domaine.
    api.resendAccountApi.get.mockResolvedValue({
      ...COMPTE, configured: false, domaineVerifie: null, domaines: null, echec: 'NOT_CONFIGURED',
    })
    const { container } = render(<OpsInfrastructure />)
    await waitFor(() => expect(texte(container)).toMatch(/non concluant/))
    expect(texte(container)).toMatch(/aucune clé API sur le serveur/)
    expect(texte(container)).not.toMatch(/NON vérifié/)
  })

  it('⚠️ API injoignable → l’écran reste MUET, jamais rassurant', async () => {
    api.resendAccountApi.get.mockResolvedValue({
      ...COMPTE, domaineVerifie: null, domaines: null, echec: 'UNREACHABLE',
    })
    const { container } = render(<OpsInfrastructure />)
    await waitFor(() => expect(texte(container)).toMatch(/API Resend injoignable/))
    expect(texte(container)).not.toMatch(/réputation d’expédition partagée/)
  })

  it('⚠️ la sonde elle-même en échec ne peut pas produire du vert', async () => {
    // Le chemin `.catch` — celui qui laisse `compte` à `null`. Deux verrous de ce dépôt
    // sont déjà restés VERTS sous sabotage faute d'atteindre le chemin fautif.
    api.resendAccountApi.get.mockRejectedValue(new Error('500'))
    const { container } = render(<OpsInfrastructure />)
    await waitFor(() => expect(texte(container)).toMatch(/sonde indisponible/))
    expect(texte(container)).not.toMatch(/vérifié il y a[\s\S]*?\bvérifié\b(?!e)/)
  })

  it('la mesure est DATÉE — « vérifié il y a N s »', async () => {
    // Un état sans âge ne permet pas de distinguer une mesure fraîche d'une mesure figée.
    const { container } = render(<OpsInfrastructure />)
    await waitFor(() => expect(texte(container)).toMatch(/vérifié il y a \d+ s/))
  })

  it('DISCRIMINANT — aucune adresse de destinataire n’atteint l’écran', async () => {
    // On ne relaie pas `emails.list`. Seule notre propre adresse d'expédition peut
    // apparaître, et encore : c'est le DOMAINE qui est rendu, pas l'adresse.
    const { container } = render(<OpsInfrastructure />)
    await waitFor(() => expect(texte(container)).toMatch(/habashop\.com/))
    expect(texte(container)).not.toMatch(/@/)
  })
})
