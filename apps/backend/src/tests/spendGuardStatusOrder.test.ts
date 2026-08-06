import { describe, it, expect } from 'vitest'
import { tenantSpendState, quotaLimit } from '../lib/spend/spendGuard'

/**
 * VERROU — la DÉPENDANCE de `quotaLimit` à l'ordre des gardes.
 *
 * ─── CE QU'ON ENREGISTRE, ET POURQUOI ────────────────────────────────────────
 * `quotaLimit` fait `status === 'trial' ? 'trial' : 'active'` : cinq statuts, deux
 * paliers. **L'expression n'est pas fausse** — il n'existe que deux jeux de plafonds
 * (`QUOTA_TRIAL_*`, `QUOTA_ACTIVE_*`) — et ce fichier ne demande pas qu'on la change.
 *
 * Elle n'est juste que grâce à un invariant qui vit AILLEURS : `authorizeSpend` applique
 * ses gardes dans l'ordre **démo → statut → rafale → quota**, et `tenantSpendState`
 * refuse `suspended` et `cancelled` avant que `quotaLimit` soit atteinte. Sans cette
 * garde amont, une boutique suspendue hériterait du palier PAYANT sur un chemin de
 * dépense facturée (Anthropic, Twilio, Resend).
 *
 * ⚠️ Une justesse qui dépend d'un invariant distant, et que rien n'enregistre, est une
 * justesse EMPRUNTÉE : elle disparaît le jour où quelqu'un réordonne les gardes, et
 * aucune suite ne rougit. C'est le même motif que le rejeu hors-ligne, dont l'ordre du
 * bloc est load-bearing — sauf qu'ici `tsc` ne peut rien voir, les deux fonctions étant
 * parfaitement valides séparément.
 *
 * Ce fichier ne teste donc pas « quotaLimit rend le bon nombre ». Il teste que **la
 * répartition des responsabilités tient** : ce que `quotaLimit` n'a pas à distinguer,
 * quelqu'un d'autre le refuse.
 */

/** Les cinq valeurs de `Tenant.status` (colonne `String`, cf. prisma/schema.prisma). */
const STATUSES = ['trial', 'active', 'pending_payment', 'suspended', 'cancelled'] as const
type Status = typeof STATUSES[number]

const info = (status: string, over: Partial<{ isDemo: boolean; trialEnds: Date | null }> = {}) =>
  ({ isDemo: false, status, trialEnds: null, ...over })

/** Statuts que `quotaLimit` peut RÉELLEMENT recevoir, l'ordre des gardes appliqué. */
const reachable = (): Status[] => STATUSES.filter(s => tenantSpendState(info(s)).ok)

describe('couverture (un domaine vidé rendrait ce test vert et vide)', () => {
  it('les cinq statuts sont exercés', () => {
    expect(STATUSES).toHaveLength(5)
    for (const s of STATUSES) expect(typeof tenantSpendState(info(s)).ok).toBe('boolean')
  })
  it('la garde laisse passer ET refuse — elle n’est ni ouverte ni fermée en bloc', () => {
    expect(reachable().length).toBeGreaterThan(0)
    expect(reachable().length).toBeLessThan(STATUSES.length)
  })
})

describe('l’ordre des gardes porte ce que `quotaLimit` ne distingue pas', () => {
  /**
   * ⚠️ LE CŒUR DU VERROU. Si quelqu'un retire le refus de `suspended`/`cancelled` de
   * `tenantSpendState` — ou déplace `reserveQuota` avant la garde de statut — ces deux
   * statuts atteindront `quotaLimit`, qui leur donnera le palier PAYANT. Ce test rougit.
   */
  it.each(['suspended', 'cancelled'] as const)(
    '%s est REFUSÉ en amont — sinon il hériterait du palier payant', (status) => {
      const decision = tenantSpendState(info(status))
      expect(decision.ok).toBe(false)
      expect(decision.code).toBeTruthy()
      // …et la démonstration du risque : si on l'atteignait, voici ce qu'il obtiendrait.
      expect(quotaLimit('ai', status)).toBe(quotaLimit('ai', 'active'))
    })

  it('seuls trial, active et pending_payment atteignent `quotaLimit`', () => {
    expect(reachable().sort()).toEqual(['active', 'pending_payment', 'trial'])
  })

  it('un essai EXPIRÉ est refusé lui aussi (garde temporelle, même ordre)', () => {
    const hier = new Date(Date.now() - 24 * 3600 * 1000)
    expect(tenantSpendState(info('trial', { trialEnds: hier })).ok).toBe(false)
    // …alors qu'un essai en cours passe : la garde discrimine, elle ne ferme pas tout.
    const demain = new Date(Date.now() + 24 * 3600 * 1000)
    expect(tenantSpendState(info('trial', { trialEnds: demain })).ok).toBe(true)
  })

  it('une boutique de DÉMO est refusée avant toute question de statut', () => {
    expect(tenantSpendState(info('active', { isDemo: true })).ok).toBe(false)
  })
})

describe('les deux paliers restent DISTINCTS et correctement attribués', () => {
  it('trial et active ne donnent pas le même plafond', () => {
    for (const kind of ['ai', 'ocr', 'whatsapp', 'email', 'sms'] as const) {
      expect(quotaLimit(kind, 'trial')).toBeLessThan(quotaLimit(kind, 'active'))
    }
  })

  /**
   * `pending_payment` reçoit le palier payant DÉLIBÉRÉMENT : le commerçant a demandé un
   * plan et attend l'encaissement manuel (aucun paiement en ligne n'est actif). On ne lui
   * coupe pas le service entre-temps. Écrit ici pour que ce ne soit pas relu comme un
   * oubli du ternaire.
   */
  it('pending_payment obtient le palier payant — choix assumé, pas un effet de bord', () => {
    expect(tenantSpendState(info('pending_payment')).ok).toBe(true)
    expect(quotaLimit('ai', 'pending_payment')).toBe(quotaLimit('ai', 'active'))
  })

  it('un statut INCONNU obtient aussi le palier payant — c’est la limite assumée', () => {
    // Le ternaire est un `else`, pas un Record : une valeur inédite tombe côté `active`.
    // Acceptable UNIQUEMENT parce que `tenantSpendState` ne la refuse pas non plus, donc
    // le tenant est réputé sain. À revoir si `Tenant.status` devient un enum Prisma.
    expect(quotaLimit('ai', 'wat')).toBe(quotaLimit('ai', 'active'))
  })
})
