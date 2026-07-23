import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * HARNAIS DE COLLISION — le gardien de la sous-surface « normalisation ».
 *
 * La normalisation téléphonique a été revertée QUATRE fois, chaque tentative ayant
 * fabriqué un numéro VALIDE d'un autre pays puis l'ayant fait LIVRER. Ce fichier
 * existe pour que la décision vienne d'une EXÉCUTION, jamais d'un raisonnement :
 * c'est la leçon la plus chère du § Chantier NORMALISATION du CLAUDE.md.
 *
 * Il n'assert pas sur du texte source ni sur une fonction pure recopiée : il exerce
 * `sendWhatsApp` avec le SDK Twilio MOCKÉ et regarde ce qui SERAIT parti — motif (b)
 * du § « Vérification en PROD » (assertion sur la décision, SDK mocké, zéro envoi réel).
 *
 * INVARIANT TESTÉ — un numéro NATIONAL dont on ne connaît pas le pays (flux CLIENT :
 * corps de requête, fiche client, liste de diffusion) ne doit JAMAIS être transformé
 * en E.164 d'un pays deviné, et doit être REFUSÉ. « On ne transforme pas » ne vaut
 * pas « on n'envoie pas » : coller un `+` produit souvent un numéro d'un AUTRE pays,
 * parfaitement valide, donc livrable.
 */

const { messagesCreate } = vi.hoisted(() => ({ messagesCreate: vi.fn() }))
vi.mock('twilio', () => ({
  default: () => ({ messages: { create: messagesCreate } }),
}))
vi.mock('./../lib/spend/spendGuard', () => ({
  authorizeSpend: vi.fn(async () => ({ ok: true, quotaKey: 'k' })),
  releaseQuota: vi.fn(async () => {}),
}))

import { sendWhatsApp } from '../lib/spend/twilioClient'

/** Numéros NATIONAUX dont le pays est INDÉTERMINABLE sans information externe. */
const NATIONAUX_AMBIGUS = [
  // Mesuré : valide en CM (+237…) ET en GN (+224…). Un `+` collé donne +621234567,
  // qui est un numéro INDONÉSIEN valide — donc livrable, vers un inconnu.
  { raw: '621234567', note: 'CM ou GN — `+` collé ⇒ Indonésie valide' },
  // Mesuré : valide dans CINQ pays (ML, BF, NE, TG, GA).
  { raw: '76123456', note: 'ML/BF/NE/TG/GA — aucun ne peut être choisi' },
  // Trunk zero : conservé par CI/BJ/CG, retiré par GA. Aucune règle uniforme.
  { raw: '0701234567', note: 'trunk zero — CI le conserve, GA le retire' },
  // Le préfixe international composé « à la main » par une caissière.
  { raw: '00622123456', note: '00→+ ⇒ +622123456, Indonésie valide' },
]

/** Contrôle POSITIF : un E.164 explicite doit continuer de partir. */
const INTERNATIONAUX_VALIDES = ['+221771234567', '+237699887766']

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TWILIO_ACCOUNT_SID = 'ACtest'
  process.env.TWILIO_AUTH_TOKEN = 'token'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
  messagesCreate.mockResolvedValue({ sid: 'SM1' })
})

describe('Flux CLIENT — pays inconnu, aucune inférence permise', () => {
  it.each(NATIONAUX_AMBIGUS)('n’envoie RIEN pour « $raw » ($note)', async ({ raw }) => {
    const res = await sendWhatsApp({ tenantId: 'tenant-1', to: raw, body: 'test' , owner: { kind: 'customer' }, flow: 'transactional'})

    // Le refus est le comportement sûr : un message non envoyé est bénin,
    // un message au MAUVAIS destinataire est une fuite.
    expect(messagesCreate, `un envoi a été tenté pour le national « ${raw} »`).not.toHaveBeenCalled()
    expect(res.sent).toBe(0)
    expect(res.code, 'le refus doit être TRACÉ par un code explicite').toBeTruthy()
  })

  it('ne fabrique JAMAIS un E.164 d’un pays non demandé', async () => {
    for (const { raw } of NATIONAUX_AMBIGUS) {
      messagesCreate.mockClear()
      await sendWhatsApp({ tenantId: 'tenant-1', to: raw, body: 'test' , owner: { kind: 'customer' }, flow: 'transactional'})
      const destinations = messagesCreate.mock.calls.map(c => String(c[0]?.to ?? ''))
      expect(destinations, `« ${raw} » a produit une destination : ${destinations.join(', ')}`).toEqual([])
    }
  })

  it('une liste de diffusion mixte n’envoie qu’aux numéros internationaux', async () => {
    await sendWhatsApp({
      tenantId: 'tenant-1',
      to: ['+221771234567', '621234567', '76123456'],
      body: 'promo',
      owner: { kind: 'customer' },
      flow: 'transactional',
    })
    const destinations = messagesCreate.mock.calls.map(c => String(c[0]?.to ?? ''))
    expect(destinations).toEqual(['whatsapp:+221771234567'])
  })
})

describe('Flux COMMERÇANT — son numéro, son pays', () => {
  it('normalise un national AVEC un pays ISO-2 reconnu', async () => {
    const res = await sendWhatsApp({
      tenantId: 't', to: '771234567', body: 'résumé',
      owner: { kind: 'merchant', country: 'SN' },
      flow: 'transactional',
    })
    expect(String(messagesCreate.mock.calls[0][0].to)).toBe('whatsapp:+221771234567')
    expect(res.sent).toBe(1)
  })

  it('REFUSE quand `tenant.country` n’est pas un ISO-2 (« France » existe en prod)', async () => {
    for (const country of ['France', '', null, 'XX']) {
      messagesCreate.mockClear()
      const res = await sendWhatsApp({
        tenantId: 't', to: '771234567', body: 'résumé',
        owner: { kind: 'merchant', country },
        flow: 'transactional',
      })
      expect(messagesCreate, `pays « ${country} » a laissé passer un envoi`).not.toHaveBeenCalled()
      expect(res.code).toBe('COUNTRY_UNKNOWN')
    }
  })

  // « International d'abord, `country` en REPLI pour le national uniquement. »
  // Un numéro déjà valide ne dépend pas du champ pays : refuser le résumé quotidien
  // d'un commerçant dont l'onboarding a écrit « France » serait un refus SÛR mais FAUX.
  it.each(['France', '', null, 'XX'])(
    'ACCEPTE un ownerPhone déjà international même si country vaut « %s »',
    async (country) => {
      messagesCreate.mockClear()
      const res = await sendWhatsApp({
        tenantId: 't', to: '+221771234567', body: 'résumé',
        owner: { kind: 'merchant', country },
        flow: 'transactional',
      })
      expect(String(messagesCreate.mock.calls[0]?.[0]?.to)).toBe('whatsapp:+221771234567')
      expect(res.sent).toBe(1)
      expect(res.refused ?? []).toEqual([])
    },
  )

  it('le pays du commerçant ne s’applique JAMAIS au numéro d’un client', async () => {
    // Le même national, déclaré client, reste refusé — même si un pays existait
    // ailleurs dans le contexte. C'est la fuite n°2 (tenant.country appliqué au
    // numéro du DESTINATAIRE) rendue impossible par le typage.
    const res = await sendWhatsApp({
      tenantId: 't', to: '771234567', body: 'reçu',
      owner: { kind: 'customer' },
      flow: 'transactional',
    })
    expect(messagesCreate).not.toHaveBeenCalled()
    expect(res.code).toBe('PHONE_NOT_INTERNATIONAL')
  })
})

describe('Contrôle POSITIF — un E.164 explicite part normalement', () => {
  it.each(INTERNATIONAUX_VALIDES)('envoie bien vers %s', async (phone) => {
    const res = await sendWhatsApp({ tenantId: 'tenant-1', to: phone, body: 'test' , owner: { kind: 'customer' }, flow: 'transactional'})
    expect(messagesCreate).toHaveBeenCalledTimes(1)
    expect(String(messagesCreate.mock.calls[0][0].to)).toBe(`whatsapp:${phone}`)
    expect(res.sent).toBe(1)
  })
})
