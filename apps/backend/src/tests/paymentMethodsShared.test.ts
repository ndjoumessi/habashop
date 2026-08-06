import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import {
  PAYMENT_METHODS, PAYMENT_METHODS as PM, getPaymentMethod, tunnelPaymentMethods,
  paymentMethodLabel, paymentMethodColor,
} from '../lib/paymentMethods'

/**
 * Cas PARTAGÉS front ↔ back — `docs/shared-fixtures/payment-methods.json`.
 *
 * ⚠️ Lus à l'EXÉCUTION (`readFileSync`), jamais importés : le contexte de build Docker du
 * backend est `apps/backend` seul, et un import hors de cette frontière casserait le
 * déploiement en TS2307 sans que `tsc` local ne le voie.
 *
 * TROIS implémentations coexistaient (`UpgradePlan.tsx`, `email.ts`, `AdminDashboard.tsx`)
 * avec quatre divergences mesurées — dont un ternaire binaire qui affichait le champ BRUT
 * (« virement », « mtn_money ») pour trois des cinq valeurs légitimes.
 */
const ROOT = resolve(__dirname, '..', '..', '..', '..')
const FIXTURE = join(ROOT, 'docs', 'shared-fixtures', 'payment-methods.json')
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')).methods as typeof PM

describe('couverture (une fixture déplacée rendrait ce test vert et vide)', () => {
  it('lit la fixture partagée, et elle est complète', () => {
    expect(fixture.length).toBe(5)
    expect(fixture.every(m => typeof m.id === 'string' && typeof m.emoji === 'string')).toBe(true)
  })
  it('la fixture couvre les DEUX formes — marque et libellé traduit', () => {
    expect(fixture.filter(m => m.brand !== null).length).toBeGreaterThanOrEqual(3)
    expect(fixture.filter(m => m.label !== null).length).toBeGreaterThanOrEqual(2)
  })
})

describe('le module coïncide avec la fixture, champ par champ', () => {
  it.each(fixture.map(m => m.id))('%s', (id) => {
    const ref = fixture.find(m => m.id === id)!
    const got = getPaymentMethod(id)
    expect(got).not.toBeNull()
    expect(got).toEqual(ref)
  })
  it('aucun moyen en trop, aucun manquant', () => {
    expect(PAYMENT_METHODS.map(m => m.id).sort()).toEqual(fixture.map(m => m.id).sort())
  })
})

describe('le jumeau n’a pas dérivé', () => {
  const body = (p: string) => {
    const s = readFileSync(p, 'utf8')
    return s.slice(s.indexOf('export type PaymentMethodId'))
  }
  const FRONT = join(ROOT, 'apps', 'frontend', 'src', 'lib', 'paymentMethods.ts')
  const BACK = join(ROOT, 'apps', 'backend', 'src', 'lib', 'paymentMethods.ts')
  it('les deux fichiers ont un corps IDENTIQUE', () => {
    expect(body(BACK)).toBe(body(FRONT))
  })
  it('… et le corps comparé est non vide', () => {
    expect(body(FRONT).length).toBeGreaterThan(800)
    expect(body(FRONT)).toContain('offeredInTunnel')
  })
})

describe('libellés — le défaut d’origine', () => {
  /**
   * ⚠️ `AdminDashboard` faisait `=== 'wave' ? … : === 'orange_money' ? … : BRUT`.
   * Trois des cinq valeurs légitimes s'affichaient telles qu'en base à l'opérateur.
   */
  it.each(['mtn_money', 'virement', 'card'])('%s n’est plus rendu BRUT', (id) => {
    const label = paymentMethodLabel(id)
    expect(label).not.toBe(id)
    expect(label).not.toMatch(/_/)
  })

  it('les marques ne sont pas traduites, les moyens génériques le sont', () => {
    for (const brand of ['wave', 'orange_money', 'mtn_money']) {
      const rendus = new Set((['fr', 'en', 'es', 'it'] as const).map(l => paymentMethodLabel(brand, l)))
      expect(rendus.size).toBe(1)
    }
    for (const generique of ['virement', 'card']) {
      const rendus = new Set((['fr', 'en', 'es', 'it'] as const).map(l => paymentMethodLabel(generique, l)))
      expect(rendus.size).toBeGreaterThan(1)
    }
  })

  it('le pictogramme n’est PAS collé au libellé — l’appelant compose', () => {
    // `email.ts` stockait « Wave 🌊 » comme libellé : impossible à réutiliser ailleurs.
    for (const m of PAYMENT_METHODS) expect(paymentMethodLabel(m.id)).not.toContain(m.emoji)
  })

  it('un identifiant inconnu est rendu tel quel, jamais assimilé', () => {
    expect(paymentMethodLabel('paypal')).toBe('paypal')
    expect(paymentMethodLabel('')).toBe('—')
    expect(paymentMethodColor('paypal')).toBe('var(--text3)')
  })
})

describe('proposé ≠ nommable — la distinction du catalogue de plans', () => {
  it('`card` est NOMMABLE mais pas proposé dans le tunnel', () => {
    expect(getPaymentMethod('card')!.offeredInTunnel).toBe(false)
    expect(paymentMethodLabel('card')).toBeTruthy()
    expect(tunnelPaymentMethods().map(m => m.id)).not.toContain('card')
  })
  it('le tunnel propose les quatre autres', () => {
    expect(tunnelPaymentMethods().map(m => m.id)).toEqual(['wave', 'orange_money', 'mtn_money', 'virement'])
  })
})

describe('couleurs — jeton CSS côté web, hex partout ailleurs', () => {
  it('chaque moyen a les deux formes, et elles ne se confondent pas', () => {
    for (const m of PAYMENT_METHODS) {
      expect(paymentMethodColor(m.id, 'css')).toBe(`var(${m.cssVar})`)
      expect(paymentMethodColor(m.id, 'hex')).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})
