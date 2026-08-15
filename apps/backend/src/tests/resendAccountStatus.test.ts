import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * SONDE RESEND — ce qu'on affirme, et surtout ce qu'on refuse d'affirmer.
 *
 * ── D'OÙ ELLE VIENT ──────────────────────────────────────────────────────────────────
 * Elle remplace `ResendMonitor`, un panneau « Monitoring temps réel · LIVE » dont TOUTES
 * les valeurs étaient fabriquées (`Math.random()` toutes les 5 s, adresses de commerçants
 * inventées, alertes dérivées des faux chiffres). Le remplacement n'est donc pas
 * « rebrancher la même chose en vrai » : c'est décider, fait par fait, ce qu'on sait.
 *
 * ── L'INVARIANT CENTRAL : TROIS ÉTATS, JAMAIS DEUX ───────────────────────────────────
 * `domaineVerifie` vaut `true`, `false`, ou **`null` quand rien ne permet de conclure**.
 * Un `false` par défaut serait une AFFIRMATION — « votre domaine n'est pas vérifié » —
 * alors que la vérité est « je n'ai pas pu regarder ». Même famille que `ratingSummary`
 * qui rend `null` plutôt que 0, et que `vatRateFor` qui refuse d'inventer 18.
 *
 * ⚠️ Le SDK est MOCKÉ : aucun test unitaire ne parle à un service payant (filet global
 * `mockPaidSdks.ts`, et ici un `vi.mock` local qui a précédence).
 */

const sdk = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class { domains = { list: sdk.list } },
}))

import {
  resendAccountStatus, invalidateResendAccountCache, domaineDe, lireDomaines,
} from '../lib/spend/resendClient'

beforeEach(() => {
  vi.clearAllMocks()
  invalidateResendAccountCache()
  process.env.RESEND_API_KEY = 're_test_000'
  process.env.EMAIL_FROM = 'HabaShop <bonjour@habashop.com>'
})

describe('domaineDe — extraction, pas devinette', () => {
  it('lit les deux formes d’expéditeur', () => {
    expect(domaineDe('HabaShop <bonjour@habashop.com>')).toBe('habashop.com')
    expect(domaineDe('bonjour@habashop.com')).toBe('habashop.com')
    expect(domaineDe('HabaShop <onboarding@resend.dev>')).toBe('resend.dev')
  })

  it('une adresse illisible rend `null`, jamais une chaîne inventée', () => {
    for (const mauvais of ['', 'pas-une-adresse', 'a@', null, undefined, 42 as unknown as string]) {
      expect(domaineDe(mauvais as string)).toBeNull()
    }
  })
})

describe('lireDomaines — défensif PAR EXPÉRIENCE', () => {
  // ⚠️ Une réponse TRUTHY sans les clés attendues a déjà rendu un écran BLANC dans ce
  // produit (`txStats.mtn.count`). On n'y suppose plus aucune forme.
  it('accepte les deux enveloppes connues du SDK', () => {
    expect(lireDomaines({ data: [{ name: 'habashop.com', status: 'verified' }] }))
      .toEqual([{ name: 'habashop.com', statut: 'verified', verified: true }])
    expect(lireDomaines({ data: { data: [{ name: 'x.sn', status: 'pending' }] } }))
      .toEqual([{ name: 'x.sn', statut: 'pending', verified: false }])
  })

  it('⚠️ une forme inattendue rend `null` — PAS une liste vide', () => {
    // Une liste vide se lirait « aucun domaine », soit une affirmation. `null` dit
    // « je ne sais pas », ce qui est la vérité.
    for (const bizarre of [null, undefined, {}, { data: 'texte' }, { data: [{ pasDeNom: 1 }] }]) {
      expect(lireDomaines(bizarre)).toBeNull()
    }
  })

  it('DISCRIMINANT — une liste VRAIMENT vide reste une liste vide', () => {
    // Sans ce cas, un détecteur qui rendrait `null` partout passerait le test ci-dessus
    // pour la mauvaise raison. Zéro domaine est un fait ; on doit pouvoir le dire.
    expect(lireDomaines({ data: [] })).toEqual([])
  })

  it('un statut inconnu n’est pas assimilé à « vérifié »', () => {
    // Une valeur inédite doit rester NEUTRE et VISIBLE, jamais l'état favorable.
    expect(lireDomaines({ data: [{ name: 'x.sn', status: 'inedit' }] }))
      .toEqual([{ name: 'x.sn', statut: 'inedit', verified: false }])
    expect(lireDomaines({ data: [{ name: 'x.sn' }] }))
      .toEqual([{ name: 'x.sn', statut: 'inconnu', verified: false }])
  })
})

describe('resendAccountStatus — l’absence de mesure se DIT', () => {
  it('clé absente → inerte et NON CONCLUANT, le SDK n’est jamais appelé', async () => {
    delete process.env.RESEND_API_KEY
    const r = await resendAccountStatus()
    expect(r.configured).toBe(false)
    expect(r.echec).toBe('NOT_CONFIGURED')
    expect(r.domaineVerifie).toBeNull()
    expect(r.domaines).toBeNull()
    expect(sdk.list).not.toHaveBeenCalled()
  })

  it('API injoignable → `null`, jamais `false`', async () => {
    sdk.list.mockRejectedValue(new Error('ECONNRESET'))
    const r = await resendAccountStatus()
    expect(r.echec).toBe('UNREACHABLE')
    expect(r.domaineVerifie).toBeNull()
    // ⚠️ Le cœur du test : un défaut réseau doit rendre l'écran MUET, jamais affirmatif.
    expect(r.domaineVerifie).not.toBe(false)
  })

  it('domaine d’expédition vérifié → `true`', async () => {
    sdk.list.mockResolvedValue({ data: [{ name: 'habashop.com', status: 'verified' }] })
    expect((await resendAccountStatus()).domaineVerifie).toBe(true)
  })

  it('⚠️ expédier depuis resend.dev n’est PAS « vérifié »', async () => {
    // Le défaut de production : le panneau AFFIRMAIT « Domaine : resend.dev » en littéral,
    // sans dire que c'est un domaine PARTAGÉ dont la réputation ne nous appartient pas.
    process.env.EMAIL_FROM = 'HabaShop <onboarding@resend.dev>'
    sdk.list.mockResolvedValue({ data: [{ name: 'habashop.com', status: 'verified' }] })
    const r = await resendAccountStatus()
    expect(r.domaineExpedition).toBe('resend.dev')
    expect(r.domaineVerifie).toBe(false)
  })

  it('un domaine vérifié qui n’est PAS celui d’expédition ne compte pas', async () => {
    // Posséder un domaine vérifié ne dit rien de celui d'où l'on expédie RÉELLEMENT.
    sdk.list.mockResolvedValue({ data: [
      { name: 'autre.sn', status: 'verified' },
      { name: 'habashop.com', status: 'pending' },
    ] })
    expect((await resendAccountStatus()).domaineVerifie).toBe(false)
  })

  it('le cache borne la CADENCE, et s’invalide', async () => {
    sdk.list.mockResolvedValue({ data: [] })
    await resendAccountStatus(1_000)
    await resendAccountStatus(1_500)
    expect(sdk.list).toHaveBeenCalledTimes(1)      // second appel servi par le mémo
    await resendAccountStatus(70_000)
    expect(sdk.list).toHaveBeenCalledTimes(2)      // TTL écoulé → nouvelle mesure
    invalidateResendAccountCache()
    await resendAccountStatus(70_100)
    expect(sdk.list).toHaveBeenCalledTimes(3)
  })

  it('⚠️ AUCUNE adresse de destinataire ne peut sortir par cette route', async () => {
    // On ne relaie PAS `emails.list` / `logs.list` : leurs réponses portent les adresses
    // des clients de nos commerçants. Ce cas fige ce refus — si quelqu'un branche un jour
    // le flux d'e-mails ici, il devra d'abord supprimer cette assertion, donc y penser.
    //
    // ⚠️ PREMIÈRE VERSION DE CE CAS : FAUSSE, et c'est instructif. Elle interdisait TOUTE
    // adresse dans la réponse — donc elle épinglait `expediteur`, c'est-à-dire NOTRE
    // propre adresse d'envoi, celle qui figure dans l'en-tête de chaque e-mail que nous
    // expédions. Ce n'est pas une donnée personnelle d'un tiers, et c'est précisément ce
    // que le panneau doit montrer. Un verrou qui interdit ce qu'on veut afficher se fait
    // désarmer. La bonne frontière n'est pas « aucune adresse » mais « aucune adresse de
    // DESTINATAIRE » : on retire donc l'expéditeur, puis on exige qu'il ne reste rien.
    sdk.list.mockResolvedValue({ data: [{ name: 'habashop.com', status: 'verified' }] })
    const r = await resendAccountStatus()
    const rendu = JSON.stringify(r)
    const sansExpediteur = rendu.split(JSON.stringify(r.expediteur)).join('""')
    expect(sansExpediteur).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i)
    expect(rendu).not.toMatch(/re_[A-Za-z0-9]/)     // ni la clé d'API
    // La date de mesure est présente : « vérifié il y a N s » n'est pas décoratif.
    expect(Date.parse(r.mesureA)).not.toBeNaN()
  })
})
