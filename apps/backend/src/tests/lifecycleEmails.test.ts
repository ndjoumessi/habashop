import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PLANS, purchasablePlans, planAmountXOF } from '../lib/plans'

/**
 * VERROU — les e-mails de CYCLE DE VIE, jugés sur ce qu'ils ENVOIENT.
 *
 * Contexte (mesuré le 2026-08-06). Trois de ces e-mails annonçaient
 * « 24 900 F CFA/mois » : le prix de `pro`, plan qui n'existe plus, dans une QUATRIÈME
 * grille. Le bouton du même e-mail pointe vers `/app/upgrade`, qui lit `lib/plans.ts` et
 * affiche 8 000 / 25 000. Le commerçant lisait un prix et en voyait un autre en cliquant.
 *
 * Une CINQUIÈME grille, de libellés celle-là, vivait deux fonctions plus bas :
 *   const planLabel = plan === 'pro' ? 'Pro' : 'Enterprise'
 * alors que `admin.ts` et `payments.ts` passent l'identifiant réel du `PlanRequest`.
 * Toute activation Starter ou Business annonçait « Votre plan Enterprise est activé ».
 *
 * ⚠️ CE VERROU JUGE LE RENDU, PAS LA SOURCE. Un `expect(src).toContain(…)` resterait vert
 * si le bloc devenait inatteignable, et rougirait sur un reformatage. On monte donc les
 * vraies fonctions, avec le client Resend mocké, et on lit les octets envoyés.
 * L'absence de littéral dans le fichier est jugée ailleurs, par `planPriceLiterals`.
 */

const captured: { subject: string; html: string }[] = []
vi.mock('../lib/spend/resendClient', () => ({
  sendPlatformEmail: (m: { subject: string; html: string }) => { captured.push(m); return Promise.resolve(true) },
  sendTenantEmail:   (_t: string, m: { subject: string; html: string }) => { captured.push(m); return Promise.resolve(true) },
}))

import {
  sendWelcomeEmail, sendTrialReminder7Days, sendTrialReminder3Days,
  sendUpgradeConfirmation, sendTrialExpired,
} from '../services/email'

const BASE = { to: 'a@b.com', shopName: 'Chez Fatou', ownerName: 'Fatou Diop' }

/**
 * ⚠️ TROIS SÉPARATEURS DE MILLIERS COEXISTENT, et c'est ce qui a rendu le verrou
 * tarifaire précédent inopérant : il cherchait `\b8000\b` quand toute chaîne écrit
 * « 8 000 ». MESURÉ dans le dépôt — `landingShared.ts` emploie U+0020 (espace nue),
 * `toLocaleString('fr-FR')` rend U+202F (espace fine insécable), et U+00A0 traîne dans
 * les gabarits HTML. On normalise AVANT de chercher, jamais l'inverse.
 */
const NUM_SEP = /[\s\u00a0\u202f\u2009.]/g
const digitsOf = (s: string): number => Number(s.replace(NUM_SEP, ''))

/** Tous les montants « … F CFA » réellement présents dans un rendu. */
function xofAmountsIn(html: string): number[] {
  return [...html.matchAll(/(\d[\d\s\u00a0\u202f\u2009.]*)\s*F\s*CFA/g)].map(m => digitsOf(m[1]))
}

/** Texte visible : balises retirées, entités déroulées. */
const visible = (html: string): string => html
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')

async function renderAll(): Promise<Record<string, { subject: string; html: string }>> {
  captured.length = 0
  await sendWelcomeEmail({ ...BASE, plan: 'starter' })
  await sendTrialReminder7Days({ ...BASE, caToday: 412500, txCount: 63, currency: 'XOF' })
  await sendTrialReminder3Days(BASE)
  await sendUpgradeConfirmation({ ...BASE, plan: 'starter', amount: 8000, method: 'virement', ref: 'PR-42' })
  await sendTrialExpired(BASE)
  const [welcome, remind7, remind3, upgrade, expired] = captured
  return { welcome, remind7, remind3, upgrade, expired }
}

let mails: Record<string, { subject: string; html: string }>
beforeEach(async () => { mails = await renderAll() })

/** Les quatre e-mails envoyés AVANT que le plan soit payé. */
const PRE_PAYMENT = ['welcome', 'remind7', 'remind3', 'expired'] as const

describe('couverture (un envoi qui ne part plus rendrait ce test vert et vide)', () => {
  it('les cinq e-mails sont rendus et non vides', () => {
    expect(Object.keys(mails)).toHaveLength(5)
    for (const [name, m] of Object.entries(mails)) {
      expect(m, name).toBeTruthy()
      expect(m.html.length, name).toBeGreaterThan(800)
      expect(m.subject.length, name).toBeGreaterThan(10)
    }
  })
  it('le corpus contient bien des montants (sinon les règles de prix sont vacantes)', () => {
    const all = Object.values(mails).flatMap(m => xofAmountsIn(m.html))
    expect(all.length, 'aucun montant : les assertions de prix ne prouveraient rien').toBeGreaterThanOrEqual(4)
  })
})

describe('les prix envoyés sont ceux du catalogue', () => {
  const CATALOG = new Set(
    PLANS.flatMap(p => [p.monthly, p.yearly]).filter((n): n is number => typeof n === 'number'),
  )

  it('tout montant « F CFA » appartient au catalogue (ou est le montant réellement payé)', () => {
    const hits: string[] = []
    for (const [name, m] of Object.entries(mails)) {
      for (const amount of xofAmountsIn(m.html)) {
        // `upgrade` imprime le montant STOCKÉ du PlanRequest : c'est un fait comptable,
        // pas une annonce tarifaire. Il est fourni par le test (8000) et reste vérifié.
        if (CATALOG.has(amount)) continue
        hits.push(`${name} → ${amount}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('le prix d’entrée annoncé est bien le minimum ACHETABLE du catalogue', () => {
    const entry = Math.min(...purchasablePlans().map(p => p.monthly!).filter(Boolean))
    for (const name of ['remind3', 'expired'] as const) {
      expect(xofAmountsIn(mails[name].html), name).toContain(entry)
    }
  })

  it('la relance J-7 énumère TOUS les plans achetables, aucun de plus', () => {
    const shown = xofAmountsIn(mails.remind7.html)
    for (const p of purchasablePlans()) expect(shown, p.label).toContain(p.monthly!)
    // Enterprise est sur devis : aucun montant ne doit être avancé pour lui.
    expect(planAmountXOF('enterprise', 'monthly')).toBeNull()
  })

  it('AUCUN prix de l’ancienne grille, quel que soit le séparateur', () => {
    const OLD = [9900, 24900, 49900, 249000, 499000, 14400, 34750]
    const hits: string[] = []
    for (const [name, m] of Object.entries(mails)) {
      const flat = m.html.replace(NUM_SEP, '') + ' ' + m.subject.replace(NUM_SEP, '')
      for (const n of OLD) if (new RegExp(`\\b${n}\\b`).test(flat)) hits.push(`${name} → ${n}`)
    }
    expect(hits).toEqual([])
  })
})

describe('le libellé de plan vient du catalogue', () => {
  it.each([
    ['starter',    'Starter'],
    ['business',   'Business'],
    ['pro',        'Business'],   // alias de lecture — jamais « Pro »
    ['enterprise', 'Enterprise'],
  ])('plan %s → « %s »', async (planId, label) => {
    captured.length = 0
    await sendUpgradeConfirmation({ ...BASE, plan: planId, amount: 8000, method: 'virement' })
    const m = captured[0]
    expect(visible(m.html)).toContain(`Votre plan ${label} est activé`)
    expect(m.subject).toContain(`Plan ${label} activé`)
  })

  it('un plan Starter n’annonce JAMAIS « Enterprise » (le défaut d’origine)', async () => {
    captured.length = 0
    await sendUpgradeConfirmation({ ...BASE, plan: 'starter', amount: 8000, method: 'virement' })
    expect(visible(captured[0].html)).not.toContain('Enterprise')
    expect(captured[0].subject).not.toContain('Enterprise')
  })
})

describe('aucun moyen de paiement inactif n’est proposé', () => {
  /**
   * ⚠️ MESURÉ le 2026-08-06 : Wave et Orange Money n'ont AUCUNE clé, MTN/Campay/PayDunya
   * tournent en bac à sable. Aucun de ces canaux n'encaisse. Les proposer par écrit
   * (« Payez par Wave · Orange Money · MTN Money · Virement ») envoyait le commerçant
   * vers un tunnel qui rend 422.
   *
   * La confirmation d'abonnement est EXCLUE : elle rapporte la méthode réellement
   * enregistrée sur le `PlanRequest`, un fait passé, pas une invitation à payer.
   */
  const DEAD = /\bWave\b|Orange\s*Money|MTN\s*(Money|MoMo)|PayDunya|Campay/i

  it.each(PRE_PAYMENT)('%s ne propose aucune marque de paiement', (name) => {
    expect(visible(mails[name].html)).not.toMatch(DEAD)
  })

  it('… et le motif saurait mordre (contre-épreuve)', () => {
    // Forme COPIÉE depuis la version fautive de `sendTrialExpired`, pas réécrite.
    expect('Wave · Orange Money · MTN Money · Virement').toMatch(DEAD)
    expect('nous convenons du règlement (Mobile Money ou virement)').not.toMatch(DEAD)
  })
})

describe('la réserve sur le paiement accompagne chaque appel à payer', () => {
  const NOTICE = /Le paiement en ligne n'est pas encore actif/

  it.each(PRE_PAYMENT)('%s porte la réserve', (name) => {
    expect(visible(mails[name].html)).toMatch(NOTICE)
  })

  it('la confirmation d’abonnement ne la porte PAS (le plan est déjà activé)', () => {
    expect(visible(mails.upgrade.html)).not.toMatch(NOTICE)
  })

  it('la réserve est écrite UNE fois, et partagée', () => {
    // Quatre rendus identiques au caractère près ⇒ une seule source.
    const extracted = PRE_PAYMENT.map(n => (NOTICE.exec(visible(mails[n].html)) ? visible(mails[n].html) : '')
      .replace(/[\s\S]*(Le paiement en ligne[\s\S]{0,260}?activons)[\s\S]*/, '$1'))
    expect(new Set(extracted).size, 'la réserve diverge entre e-mails').toBe(1)
    expect(extracted[0].length).toBeGreaterThan(120)
  })
})

describe('aucun engagement de délai invérifiable', () => {
  /**
   * « Support prioritaire sous 4h », « nous vous rappelons sous 2h », « sous 24h » : même
   * famille que le « SLA garanti 99,9 % » retiré de la vitrine le même jour. Aucun
   * système de tickets, aucune astreinte — rien à pointer qui l'implémente. La vitrine
   * dit « Support prioritaire » sans horloge ; les e-mails ne l'avaient pas suivie.
   */
  it.each(Object.keys({ welcome: 0, remind7: 0, remind3: 0, upgrade: 0, expired: 0 }))(
    '%s ne promet aucun délai de réponse chiffré', (name) => {
      expect(visible(mails[name].html)).not.toMatch(/sous\s*\d+\s*(h|heures?)\b/i)
    })
})
