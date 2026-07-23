import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Séparation des DEUX FLUX au point d'envoi.
 *
 * `phoneE164.test.ts` prouve que les fonctions pures produisent le bon numéro ; ce
 * fichier prouve que le bon flux est appliqué au bon destinataire, en assertant le
 * `to` REÇU PAR LE SDK (mocké — aucun envoi réel, cf. CLAUDE.md § Vérification en PROD).
 *
 * ⚠️ LEÇON DE LA REVUE DU COMMIT 18cc6eb9 : la version précédente de ce fichier
 * n'exerçait qu'une paire de pays séparée par la LONGUEUR (CI 10 chiffres vs SN 9).
 * Elle restait donc verte dans les cas de COLLISION de plans — la moitié de la classe
 * de fuite qui livre réellement. Les paires qui se recouvrent sont désormais couvertes.
 */

const { createMock, tenantStore, redisMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  tenantStore: {
    current: null as { isDemo: boolean; status: string; trialEnds: Date | null; country: string | null } | null,
  },
  redisMock: {
    get:    vi.fn(async (_k: string) => null as string | null),
    setex:  vi.fn(async (_k: string, _t: number, _v: string) => 'OK'),
    del:    vi.fn(async (..._k: string[]) => 1),
    incrby: vi.fn(async (_k: string, _by: number) => 1),
    decrby: vi.fn(async (_k: string, _by: number) => 0),
    expire: vi.fn(async (_k: string, _t: number) => 1),
  },
}))
vi.mock('twilio', () => ({ default: () => ({ messages: { create: createMock } }) }))
vi.mock('../redis', () => ({ redis: redisMock }))
vi.mock('../db', () => ({ prisma: { tenant: { findUnique: vi.fn(async () => tenantStore.current) } } }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { sendWhatsApp } from '../lib/spend/twilioClient'

/** Le `to` effectivement remis au SDK Twilio. */
const sentTo = (): string[] => createMock.mock.calls.map(c => String(c[0]?.to ?? ''))

function tenantIn(country: string | null) {
  tenantStore.current = { isDemo: false, status: 'active', trialEnds: null, country }
}

beforeEach(() => {
  vi.clearAllMocks()
  createMock.mockResolvedValue({ sid: 'SM_test' })
  tenantIn('SN')
  process.env.TWILIO_ACCOUNT_SID = 'AC'
  process.env.TWILIO_AUTH_TOKEN = 'tok'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
})

describe('Flux CLIENT — le pays de la boutique ne touche JAMAIS le numéro d’un tiers', () => {
  /**
   * ⚠️ LE CAS QUI A CAUSÉ LA REPRISE. Mesuré sur la bibliothèque : `621234567` est
   * valide en CM (`+237621234567`) ET en GN (`+224621234567`). Une boutique
   * camerounaise avec une cliente guinéenne fabriquait donc un `+237…` VALIDE —
   * un abonné camerounais sans lien — et Twilio le livrait.
   *
   * Ces paires-là sont invisibles à `isValid()` : seule la séparation des flux protège.
   */
  it.each([
    ['CM', '621234567',  'cliente guinéenne, plans CM/GN à 9 chiffres'],
    ['BF', '76123456',   'client malien, plan 8 chiffres partagé ML/BF/NE/TG'],
    ['ML', '76123456',   'client burkinabè, même collision en sens inverse'],
    ['SN', '0701234567', 'client ivoirien (le cas historique)'],
  ])('boutique %s + numéro national « %s » (%s) → RIEN n’est envoyé', async (country, phone) => {
    tenantIn(country)
    const res = await sendWhatsApp({ tenantId: 'T', to: phone, body: 'x', audience: 'customer' })

    expect(createMock).not.toHaveBeenCalled() // pas d'appel Twilio du tout
    expect(res.sent).toBe(0)
    expect(res.skipped).toBe(1)
    expect(res.sentTo).toEqual([])
  })

  it('un numéro international VALIDE passe intact, quel que soit le pays de la boutique', async () => {
    tenantIn('CM')
    await sendWhatsApp({ tenantId: 'T', to: '+224621234567', body: 'x', audience: 'customer' })
    expect(sentTo()).toEqual(['whatsapp:+224621234567']) // le +224 guinéen survit
  })

  it('le préfixe IDD « 00 » est accepté (réécriture syntaxique, pas une supposition de pays)', async () => {
    await sendWhatsApp({ tenantId: 'T', to: '00221771234567', body: 'x', audience: 'customer' })
    expect(sentTo()).toEqual(['whatsapp:+221771234567'])
  })

  it('un « + » suivi d’un numéro invalide est ÉCARTÉ, jamais transmis tel quel', async () => {
    // Régression de la revue : l'ancien code collait « + » à l'aveugle, et `+622123456`
    // est un numéro INDONÉSIEN valide — « on ne normalise pas » ne voulait pas dire
    // « on n'envoie pas ». Désormais si.
    const res = await sendWhatsApp({ tenantId: 'T', to: '+221000', body: 'x', audience: 'customer' })
    expect(createMock).not.toHaveBeenCalled()
    expect(res.skipped).toBe(1)
  })
})

describe('Flux COMMERÇANT — son propre numéro, résolu avec le pays de sa boutique', () => {
  it.each([
    ['SN', '771234567',  'whatsapp:+221771234567'],
    ['CI', '0701234567', 'whatsapp:+2250701234567'], // zéro conservé
    ['GA', '062345678',  'whatsapp:+24162345678'],   // zéro retiré
  ])('boutique %s : « %s » → %s', async (country, phone, expected) => {
    tenantIn(country)
    await sendWhatsApp({ tenantId: 'T', to: phone, body: 'x', audience: 'owner' })
    expect(sentTo()).toEqual([expected])
  })

  it('pays non reconnu (« France », nom hérité d’Onboarding) → RIEN n’est envoyé', async () => {
    tenantIn('France')
    const res = await sendWhatsApp({ tenantId: 'T', to: '771234567', body: 'x', audience: 'owner' })
    expect(createMock).not.toHaveBeenCalled()
    expect(res.skipped).toBe(1)
  })

  it('numéro du commerçant déjà international → intact', async () => {
    tenantIn('SN')
    await sendWhatsApp({ tenantId: 'T', to: '+33612345678', body: 'x', audience: 'owner' })
    expect(sentTo()).toEqual(['whatsapp:+33612345678'])
  })
})

describe('Cache de dépense — la clé « c » fait l’aller-retour', () => {
  /**
   * ⚠️ Sans ce test, renommer la clé d'un seul côté (écriture `c`, lecture `co`)
   * laissait les 26 tests verts pendant que la normalisation mourait en production :
   * la branche DB ne tourne qu'une fois par tenant par minute, tout le reste vient du
   * cache. C'est le mode d'échec du méta-test semver, un étage plus bas.
   */
  it('une entrée de cache CONTENANT le pays est réellement relue', async () => {
    tenantStore.current = null // la DB ne répondra pas : seul le cache peut fournir le pays
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ d: false, s: 'active', t: null, c: 'CI' }))
    await sendWhatsApp({ tenantId: 'T', to: '0701234567', body: 'x', audience: 'owner' })
    expect(sentTo()).toEqual(['whatsapp:+2250701234567'])
  })

  it('la clé écrite est bien celle qui est relue (aller-retour complet)', async () => {
    tenantIn('CI')
    await sendWhatsApp({ tenantId: 'T', to: '+221771234567', body: 'x', audience: 'customer' })
    const payload = String(redisMock.setex.mock.calls.at(-1)?.[2] ?? '')

    // On rejoue EXACTEMENT ce qui a été écrit, sans le réécrire à la main.
    vi.clearAllMocks()
    createMock.mockResolvedValue({ sid: 'SM_test' })
    tenantStore.current = null
    redisMock.get.mockResolvedValueOnce(payload)
    await sendWhatsApp({ tenantId: 'T', to: '0701234567', body: 'x', audience: 'owner' })
    expect(sentTo()).toEqual(['whatsapp:+2250701234567'])
  })

  it('entrée écrite AVANT ce déploiement (sans pays) → rien n’est envoyé, rien n’est inventé', async () => {
    tenantStore.current = null
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ d: false, s: 'active', t: null }))
    const res = await sendWhatsApp({ tenantId: 'T', to: '771234567', body: 'x', audience: 'owner' })
    expect(createMock).not.toHaveBeenCalled()
    expect(res.skipped).toBe(1)
  })
})

describe('Le goulot remonte ce que les appelants doivent distinguer', () => {
  it('sépare envoyés, écartés et échoués sur une même liste', async () => {
    createMock
      .mockResolvedValueOnce({ sid: 'SM1' })
      .mockRejectedValueOnce(new Error('Twilio refuse'))
    const res = await sendWhatsApp({
      tenantId: 'T',
      to: ['+221771234567', '+33612345678', '771234567', 'abc'],
      body: 'x',
      audience: 'customer',
    })
    expect(res.sent).toBe(1)      // le premier
    expect(res.failed).toBe(1)    // le deuxième, refusé par Twilio
    expect(res.skipped).toBe(2)   // les deux non internationaux
    expect(res.sentTo).toEqual(['+221771234567'])
  })

  it('les unités non dépensées sont rendues au compteur, écartés compris', async () => {
    const res = await sendWhatsApp({
      tenantId: 'T', to: ['+221771234567', '771234567', '0701234567'], body: 'x', audience: 'customer',
    })
    expect(res.sent).toBe(1)
    expect(res.skipped).toBe(2)
    expect(redisMock.decrby).toHaveBeenCalledWith(expect.stringContaining('quota:whatsapp:T:'), 2)
  })

  it('un refus de garde reste un refus — rien n’est envoyé', async () => {
    tenantStore.current = { isDemo: true, status: 'active', trialEnds: null, country: 'SN' }
    const res = await sendWhatsApp({ tenantId: 'demo', to: '+221771234567', body: 'x', audience: 'customer' })
    expect(createMock).not.toHaveBeenCalled()
    expect(res.denied).toBe(true)
  })
})
