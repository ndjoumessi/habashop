import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * LE COMPTE DES JOURS D'ESSAI N'EST CALCULÉ NULLE PART CÔTÉ CLIENT.
 *
 * ⚠️ MESURÉ À L'ÉCRAN le 2026-10-01 : « ESSAI · 14J » au-dessus de « 7 jour(s) d'essai
 * restant(s) ». Le bandeau lisait le serveur, la pastille recalculait `createdAt + 14`.
 * Un premier correctif a aligné les deux FORMULES sur `trialEnds`, jumelées par des cas
 * partagés. Ce fichier-ci verrouille l'étape suivante, décidée par Nelson : il n'y a plus
 * de seconde formule du tout — les deux surfaces lisent le MÊME nombre, celui du serveur.
 *
 * *Deux calculs d'une même grandeur n'ont aucune raison de rester d'accord.* Un jumeau
 * rend la divergence BRUYANTE ; une source unique la rend IMPOSSIBLE.
 */

const statutApi = vi.fn()
vi.mock('@/lib/api', () => ({
  billingApi: { status: () => statutApi() },
  // `Header` tire d'autres API au montage — on les neutralise.
  notificationsApi: { list: () => Promise.resolve([]), markRead: () => Promise.resolve({}) },
  searchApi: { global: () => Promise.resolve({}) },
}))

import { useBillingStore } from '@/stores/billingStore'
import BillingBanner from '@/components/ui/BillingBanner'

/** Le texte du bandeau, et le nombre qu'il annonce. */
function joursDuBandeau(): number | null {
  const m = document.body.textContent?.match(/(\d+)\s+jour\(s\) d'essai restant\(s\)/)
  return m ? Number(m[1]) : null
}

beforeEach(() => {
  statutApi.mockReset()
  useBillingStore.getState().invalider()
  document.body.innerHTML = ''
})

const STATUT = {
  plan: 'starter', status: 'trial', trialDaysLeft: 7,
  isTrialExpired: false, hasPendingRequest: false, canContinue: true,
}

describe('billingStore — une seule lecture, partagée', () => {
  it('⚠️ DÉCISIF : deux consommateurs, UN SEUL appel réseau', async () => {
    statutApi.mockResolvedValue(STATUT)
    await Promise.all([
      useBillingStore.getState().charger(),
      useBillingStore.getState().charger(),
      useBillingStore.getState().charger(),
    ])
    expect(statutApi, 'chaque surface qui monte ne doit pas redemander au serveur').toHaveBeenCalledTimes(1)
    expect(useBillingStore.getState().etat?.trialDaysLeft).toBe(7)
  })

  it('⚠️ TROIS états, pas deux : inconnu ≠ chargé ≠ échoué', async () => {
    expect(useBillingStore.getState().chargement).toBe('jamais')
    statutApi.mockRejectedValue(new Error('réseau'))
    await useBillingStore.getState().charger()
    expect(useBillingStore.getState().chargement).toBe('echec')
    expect(useBillingStore.getState().etat, 'un échec ne laisse pas un état à moitié lu').toBeNull()
  })

  it('⚠️ une réponse MALFORMÉE est un échec, pas un état — « undefined jour(s) » ne doit pas s’afficher', async () => {
    statutApi.mockResolvedValue({})
    await useBillingStore.getState().charger()
    expect(useBillingStore.getState().chargement).toBe('echec')
    expect(useBillingStore.getState().etat).toBeNull()
  })

  it('`invalider` remet à l’état inconnu — une nouvelle boutique ne garde pas l’essai de l’ancienne', async () => {
    statutApi.mockResolvedValue(STATUT)
    await useBillingStore.getState().charger()
    expect(useBillingStore.getState().etat).not.toBeNull()
    useBillingStore.getState().invalider()
    expect(useBillingStore.getState().chargement).toBe('jamais')
    expect(useBillingStore.getState().etat).toBeNull()
  })
})

describe('le bandeau lit le store', () => {
  it('annonce le nombre du SERVEUR', async () => {
    statutApi.mockResolvedValue({ ...STATUT, trialDaysLeft: 3 })
    render(<MemoryRouter><BillingBanner /></MemoryRouter>)
    await waitFor(() => expect(joursDuBandeau()).toBe(3))
  })

  it('⚠️ et il ne calcule RIEN : 365 jours restants viennent du serveur, pas d’une règle locale', async () => {
    statutApi.mockResolvedValue({ ...STATUT, trialDaysLeft: 365 })
    render(<MemoryRouter><BillingBanner /></MemoryRouter>)
    // > 7 jours → le bandeau se tait, mais le store porte bien la valeur du serveur.
    await waitFor(() => expect(useBillingStore.getState().etat?.trialDaysLeft).toBe(365))
    expect(joursDuBandeau()).toBeNull()
  })
})

describe('⚠️ aucune règle de jours d’essai ne subsiste côté client', () => {
  it('le module jumeau `lib/trialDays` a disparu du frontend', () => {
    // ⚠️ Vérifié sur le SYSTÈME DE FICHIERS, pas par un `import()` : un import dynamique
    // d'un chemin littéral absent fait rougir `tsc` avant même d'exécuter le test, et le
    // verrou ne garderait plus rien une fois le chemin rendu dynamique pour le contourner.
    expect(existsSync(resolve(__dirname, '../lib/trialDays.ts')), 'une seconde formule est revenue').toBe(false)
  })

  it('`getTrialInfo` n’existe plus dans le store applicatif', async () => {
    const mod = await import('@/stores/appStore') as Record<string, unknown>
    expect(Object.keys(mod), 'une seconde source rouvrirait la divergence').not.toContain('getTrialInfo')
  })
})
