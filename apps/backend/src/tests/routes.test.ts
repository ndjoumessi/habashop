import { describe, it, expect } from 'vitest'
import { decideWsAuth } from '../lib/wsAuth'
import { resolvePlanId, planAmountXOF, purchasablePlans, YEARLY_MONTHS } from '../lib/plans'

/**
 * ⚠️ CE FICHIER COMPTAIT 36 CAS ; IL EN COMPTE 8.
 *
 * Vingt-huit d'entre eux ne touchaient la production par AUCUN moyen — ni import, ni
 * lecture de source, ni `app.inject`. Ils déclaraient une valeur et la vérifiaient :
 *
 *     it('Prisma protège injection SQL', () => {
 *       const q = { where: { email: "'; DROP TABLE users; --" } }
 *       expect(typeof q.where.email).toBe('string')      // …et alors ?
 *     })
 *     it('DELETE customer/supplier scopé par tenantId', () => {
 *       const where = { id:'c1', tenantId:'t1' }
 *       expect(where.tenantId).toBe('t1')
 *     })
 *
 * Le tort n'était pas de laisser passer une régression — ils n'en voyaient aucune. C'était
 * que leur TITRE dissuadait d'écrire le vrai test : « l'isolation multi-tenant ? c'est
 * déjà couvert ». Sur le défaut dont la violation fait fuiter les données d'un commerçant
 * vers un autre. La vraie couverture existe, ailleurs et pour de bon :
 * `tenantIsolation.test.ts` — 12 routes injectées avec l'identité du tenant B demandant
 * une ressource du tenant A, 404/403 attendus, plus 2 contrôles positifs qui prouvent que
 * le mock ne rend pas 404 partout.
 *
 * UN TEST QUI N'AFFIRME RIEN SE SUPPRIME, IL NE SE RÉPARE PAS : le réparer inventerait
 * une couverture que personne n'a demandée, sur un code que personne n'a jugé prioritaire
 * de tester. Le supprimer rend le chiffre honnête.
 *
 * Ne subsistent que les cas qui exercent du code réel.
 */

describe('Billing — plans et prix (lus dans le catalogue, pas recopiés)', () => {
  it('Plans valides — starter EN FAIT PARTIE', () => {
    expect(resolvePlanId('business')).toBe('business')
    expect(resolvePlanId('starter')).toBe('starter')     // ← était attendu FAUX
    expect(resolvePlanId('paypal')).toBeNull()
  })
  it('Prix mensuels du catalogue', () => {
    expect(planAmountXOF('starter', 'monthly')).toBe(8000)
    expect(planAmountXOF('business', 'monthly')).toBe(25000)
  })
  it('Annuel < 12 × mensuel (2 mois offerts)', () => {
    for (const p of purchasablePlans()) {
      expect(p.yearly!).toBeLessThan(p.monthly! * 12)
      expect(p.yearly!).toBe(p.monthly! * YEARLY_MONTHS)
    }
  })
})

describe('WebSocket auth — decideWsAuth (fail-closed)', () => {
  const verifyOK  = (_t: string) => ({ tenantId: 't1', userId: 'u1', role: 'ADMIN' })
  const verifyBad = (_t: string) => { throw new Error('invalid signature') }

  it('refuse l’absence de token', () => {
    expect(decideWsAuth(undefined, verifyOK)).toEqual({ ok: false, reason: 'no-token' })
    expect(decideWsAuth('', verifyOK)).toEqual({ ok: false, reason: 'no-token' })
  })
  it('refuse un token invalide (verify throw)', () => {
    expect(decideWsAuth('xxx', verifyBad)).toEqual({ ok: false, reason: 'invalid-token' })
  })
  it('refuse un JWT valide mais sans tenantId', () => {
    const r = decideWsAuth('tok', () => ({ userId: 'u1' }))
    expect(r).toEqual({ ok: false, reason: 'no-tenant' })
  })
  it('accepte un JWT valide et expose tenantId/userId', () => {
    const r = decideWsAuth('tok', verifyOK)
    expect(r).toEqual({ ok: true, tenantId: 't1', userId: 'u1' })
  })
  it('ne propage jamais une exception (verify hostile)', () => {
    expect(() => decideWsAuth('tok', () => { throw 'boom' })).not.toThrow()
  })
})
