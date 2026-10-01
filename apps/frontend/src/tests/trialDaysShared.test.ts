import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { joursDEssaiRestants } from '@/lib/trialDays'
import { getTrialInfo } from '@/stores/appStore'

/** Mêmes cas que le backend — modifier la règle d'un seul côté fait rougir l'autre. */
const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../docs/shared-fixtures/trial-days-left.json'), 'utf-8'),
) as { cases: { nom: string; trialEnds: string | null; now: string; attendu: number }[] }

describe('joursDEssaiRestants — cas partagés avec le backend', () => {
  it('le fichier de cas est bien lu', () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(8)
  })
  for (const c of fixture.cases) {
    it(`${c.nom}`, () => {
      expect(joursDEssaiRestants(c.trialEnds, new Date(c.now))).toBe(c.attendu)
    })
  }
})

/**
 * ⚠️ DÉCISIF — LA PASTILLE ET LE BANDEAU DOIVENT S'ACCORDER.
 *
 * Mesuré à l'écran : « ESSAI · 14J » au-dessus de « 7 jour(s) d'essai restant(s) ». Le
 * bandeau lit `trialDaysLeft` du serveur, dérivé de `trialEnds` ; la pastille recalculait
 * `createdAt + 14 jours` côté client. Les deux ne s'accordaient que par la convention de
 * l'inscription — qu'une démo jetable (7 j) et surtout une ACTIVATION DE PLAN (30 ou 365 j)
 * font voler en éclats.
 */
describe('getTrialInfo — une seule source, celle du serveur', () => {
  const MAINTENANT = Date.now()
  const dans = (jours: number) => new Date(MAINTENANT + jours * 86_400_000).toISOString()
  const ilYa = (jours: number) => new Date(MAINTENANT - jours * 86_400_000).toISOString()

  it('⚠️ le compte vient de `trialEnds`, PAS de `createdAt + 14`', () => {
    const t = { status: 'trial', plan: 'starter', createdAt: ilYa(0), trialEnds: dans(7) }
    expect(getTrialInfo(t as never)).toEqual({ isTrial: true, daysLeft: 7 })
  })

  it('⚠️ et la pastille rend EXACTEMENT ce que le serveur rendrait', () => {
    for (const jours of [1, 3, 7, 14, 30, 365]) {
      const fin = dans(jours)
      const t = { status: 'trial', plan: 'starter', createdAt: ilYa(100), trialEnds: fin }
      expect(
        getTrialInfo(t as never).daysLeft,
        `pastille et bandeau divergent à ${jours} jours`,
      ).toBe(joursDEssaiRestants(fin, new Date(MAINTENANT)))
    }
  })

  /**
   * ⚠️ MESURÉ EN PRODUCTION : `demo-tenant-002` porte `plan = 'starter'` et
   * `status = 'active'`. L'ancien critère était une LISTE DE PLANS contenant `'starter'` —
   * qui est un plan PAYANT (9 900 FCFA/mois). Un client qui paie se voyait donc badger
   * « Essai · 0 j » en ROUGE, pendant que le bandeau se taisait. Le critère est désormais
   * celui du serveur : le STATUT.
   */
  it('⚠️ un tenant ACTIF sur un plan payant n’est PAS en essai, même si le plan s’appelle « starter »', () => {
    const t = { status: 'active', plan: 'starter', createdAt: ilYa(400), trialEnds: null }
    expect(getTrialInfo(t as never)).toEqual({ isTrial: false, daysLeft: 0 })
  })

  it('un essai sans échéance ne s’affiche pas — on n’invente pas quatorze jours', () => {
    const t = { status: 'trial', plan: 'starter', createdAt: ilYa(0), trialEnds: null }
    expect(getTrialInfo(t as never)).toEqual({ isTrial: false, daysLeft: 0 })
  })

  it('un essai dépassé rend 0, et reste un essai (le bandeau dira « expiré »)', () => {
    const t = { status: 'trial', plan: 'starter', createdAt: ilYa(30), trialEnds: ilYa(2) }
    expect(getTrialInfo(t as never)).toEqual({ isTrial: true, daysLeft: 0 })
  })
})
