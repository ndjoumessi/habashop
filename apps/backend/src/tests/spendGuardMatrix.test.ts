import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * MATRICE COMPLÈTE — 4 clients facturés × 5 motifs de refus (#184).
 *
 * ⚠️ Le défaut fermé ici n'est PAS la logique du garde : elle était déjà couverte par
 * `spendGuard.test.ts`. C'est sa PROPAGATION. Mesuré avant ce fichier :
 *
 *   DEMO_TENANT_FORBIDDEN  5 fichiers · QUOTA_EXCEEDED 5 · BURST_EXCEEDED 3
 *   TRIAL_EXPIRED          2 fichiers
 *   TENANT_INACTIVE        1 fichier — `spendGuard.test.ts` SEUL
 *
 * `TENANT_INACTIVE` n'était donc exercé qu'au niveau du garde lui-même : aucun chemin
 * CLIENT ne prouvait qu'il remonte. Un client peut parfaitement lire `decision.ok === false`,
 * renvoyer le bon code… et appeler le SDK quand même. Le code d'erreur rendu ne prouve rien.
 *
 * ⚠️ D'où la forme de chaque cas : on assert que **le SDK n'a JAMAIS été appelé**
 * (`expect(sdk).not.toHaveBeenCalled()`), pas seulement que le code de refus est correct.
 * C'est la forme (b) du § « Vérification en PROD » de CLAUDE.md — une assertion sur la
 * DÉCISION, SDK mocké, donc zéro dépense réelle. Un contrôle positif sur un vrai endpoint
 * avait autrefois expédié un WhatsApp facturé ; on ne recommence pas.
 */

const { twilioSend, anthropicSend, resendSend, smsSend, tenantStore, redisMock } = vi.hoisted(() => ({
  twilioSend: vi.fn(async () => ({ sid: 'SM_test' })),
  anthropicSend: vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] })),
  resendSend: vi.fn(async () => ({ id: 'em_test' })),
  smsSend: vi.fn(async () => ({ SMSMessageData: { Recipients: [{ statusCode: 101 }] } })),
  tenantStore: { current: null as TenantRow | null },
  redisMock: {
    get: vi.fn(async () => null), setex: vi.fn(async () => 'OK'), del: vi.fn(async () => 1),
    incrby: vi.fn(async (_k: string, _by: number) => 1),
    decrby: vi.fn(async (_k: string, _by: number) => 0),
    expire: vi.fn(async (_k: string, _t: number) => 1),
  },
}))

vi.mock('twilio', () => ({ default: () => ({ messages: { create: twilioSend } }) }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: anthropicSend }; beta = { messages: { create: anthropicSend } } },
}))
vi.mock('resend', () => ({ Resend: class { emails = { send: resendSend } } }))
vi.mock('africastalking', () => ({ default: () => ({ SMS: { send: smsSend } }) }))
vi.mock('../redis', () => ({ redis: redisMock }))
vi.mock('../db', () => ({ prisma: { tenant: { findUnique: vi.fn(async () => tenantStore.current) } } }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { sendWhatsApp } from '../lib/spend/twilioClient'
import { createMessage } from '../lib/spend/anthropicClient'
import { sendTenantEmail } from '../lib/spend/resendClient'
import { sendSms } from '../lib/spend/smsClient'
import type { PhoneOwner } from '../lib/spend/recipientPhone'
import {
  DEMO_TENANT_FORBIDDEN, TRIAL_EXPIRED, TENANT_INACTIVE, QUOTA_EXCEEDED, BURST_EXCEEDED,
} from '../lib/spend/spendGuard'

/** Numéro E.164 complet : la résolution téléphonique ne doit JAMAIS être la cause du refus. */
const PHONE = '+221771234567'

/**
 * ⚠️ `PhoneOwner` est un OBJET (`{ kind }`), pas une chaîne. Une première version passait
 * `owner: 'merchant'` : les 27 tests étaient VERTS parce que `owner.kind` valait `undefined`,
 * donc la branche commerçant s'appliquait par défaut — et le numéro, déjà international,
 * résolvait de toute façon. Les cas « client » n'exerçaient donc jamais le flux client.
 * `tsc` l'a vu, la suite non : c'est la raison d'être du typecheck NON PIPÉ au rituel.
 */
type TenantRow = { isDemo: boolean; status: string; trialEnds: Date | null }
/** Tout contrat client qui expose son motif de refus. */
type Refusable = { code?: string }
/** Forme minimale d'une réponse Africa's Talking, côté mock. */
type SmsResponse = { SMSMessageData: { Recipients: { statusCode: number }[] } }
/** Paramètres Anthropic minimaux — typés via le SDK plutôt qu'écrasés en `any`. */
const AI_PARAMS = { model: 'm', max_tokens: 1, messages: [] } as Parameters<typeof createMessage>[0]['params']

const MERCHANT: PhoneOwner = { kind: 'merchant', country: 'SN' }
const CUSTOMER: PhoneOwner = { kind: 'customer' }

function seedTenant(over: Partial<{ isDemo: boolean; status: string; trialEnds: Date | null }> = {}) {
  tenantStore.current = { isDemo: false, status: 'active', trialEnds: null, ...over }
}

/** Compteur quotidien à `n` ; la rafale reste basse (clé `burst:` distincte). */
function seedCounter(n: number, burst = 1) {
  redisMock.incrby.mockImplementation(async (key: string) =>
    String(key).startsWith('burst:') ? burst : n)
}

beforeEach(() => {
  vi.clearAllMocks()
  seedTenant()
  seedCounter(1)
  process.env.TWILIO_ACCOUNT_SID = 'AC_test'
  process.env.TWILIO_AUTH_TOKEN = 'token_test'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
  process.env.ANTHROPIC_API_KEY = 'sk-test'
  process.env.RESEND_API_KEY = 're_test'
  process.env.SMS_API_KEY = 'at_test'
  process.env.COST_BURST_PER_MIN = '10'
})

/** Les 5 états qui doivent faire refuser, et le code attendu. */
const MOTIFS = [
  {
    code: DEMO_TENANT_FORBIDDEN,
    label: 'boutique de démonstration',
    seed: () => seedTenant({ isDemo: true }),
  },
  {
    code: TRIAL_EXPIRED,
    label: 'essai terminé',
    seed: () => seedTenant({ status: 'trial', trialEnds: new Date('2020-01-01') }),
  },
  {
    code: TENANT_INACTIVE,
    label: 'boutique suspendue',
    seed: () => seedTenant({ status: 'suspended' }),
  },
  {
    code: QUOTA_EXCEEDED,
    label: 'quota journalier dépassé',
    seed: () => seedCounter(100_000),
  },
  {
    code: BURST_EXCEEDED,
    label: 'rafale dépassée',
    seed: () => seedCounter(1, 999),
  },
] as const

/** Les 4 clients : comment les appeler, et QUEL mock de SDK ne doit pas bouger. */
const CLIENTS = [
  {
    nom: 'twilioClient (WhatsApp)',
    sdk: () => twilioSend,
    // `flow: 'transactional'` — le reçu de vente est volontairement exempté de RAFALE,
    // l'utiliser ici masquerait le cas BURST_EXCEEDED.
    appel: () => sendWhatsApp({ tenantId: 'T', to: PHONE, body: 'x', owner: MERCHANT, flow: 'transactional' }),
    refus: (r: Refusable) => r.code,
  },
  {
    nom: 'anthropicClient (IA/OCR)',
    sdk: () => anthropicSend,
    appel: () => createMessage({ tenantId: 'T', kind: 'ai', params: AI_PARAMS }),
    refus: (r: Refusable) => r.code,
  },
  {
    nom: 'resendClient (e-mail tenant)',
    sdk: () => resendSend,
    // `sendTenantEmail` rend un booléen : le refus se lit `false` — d'où l'assertion
    // séparée sur le SDK, seule à distinguer « refusé » de « refusé mais envoyé quand même ».
    appel: () => sendTenantEmail('T', { to: 'a@b.c', subject: 's', html: '<p>x</p>' }),
    refus: () => undefined,
  },
  {
    nom: 'smsClient (Africa\'s Talking)',
    sdk: () => smsSend,
    appel: () => sendSms({ tenantId: 'T', to: PHONE, message: 'x', owner: MERCHANT }),
    refus: (r: Refusable) => r.code,
  },
] as const

describe('matrice garde de dépense — 4 clients × 5 motifs (#184)', () => {
  it('la matrice est complète (garde anti-scan-vide)', () => {
    // Sans ceci, un tableau vidé par erreur rendrait zéro test — donc un vert qui ne garde rien.
    expect(CLIENTS).toHaveLength(4)
    expect(MOTIFS).toHaveLength(5)
  })

  for (const client of CLIENTS) {
    for (const motif of MOTIFS) {
      it(`${client.nom} — ${motif.label} : AUCUN appel au SDK`, async () => {
        motif.seed()
        const res = await client.appel() as Refusable | boolean

        // L'assertion qui compte : la dépense n'a pas eu lieu.
        expect(client.sdk(), `${client.nom} a appelé son SDK malgré ${motif.code}`).not.toHaveBeenCalled()

        // Et le refus remonte bien à l'appelant, avec le bon motif quand le contrat l'expose.
        const code = typeof res === 'boolean' ? undefined : client.refus(res)
        if (code !== undefined) {
          expect(code, `${client.nom} : motif remonté incorrect`).toBe(motif.code)
        } else {
          expect(res, `${client.nom} : le refus ne remonte pas`).toBe(false)
        }
      })
    }
  }

  it('contre-épreuve : boutique saine → le SDK EST appelé', async () => {
    // Sans elle, un client cassé qui n'envoie JAMAIS rendrait les 20 cas ci-dessus verts.
    for (const client of CLIENTS) {
      vi.clearAllMocks()
      seedTenant()
      seedCounter(1)
      await client.appel()
      expect(client.sdk(), `${client.nom} n'envoie plus rien du tout`).toHaveBeenCalled()
    }
  })
})

/**
 * `smsClient` réserve `recipients.length` unités d'un coup — un risque que les trois autres
 * clients n'ont pas (ils réservent 1). La libération PARTIELLE est donc une surface propre :
 * si elle sur-libère, un tenant peut dépasser son quota ; si elle sous-libère, il paie des
 * SMS jamais partis.
 */
describe('smsClient — réservation multi-destinataires et libération partielle (#184)', () => {
  it('réserve autant d\'unités que de destinataires RÉSOLUS, pas de destinataires soumis', async () => {
    // 3 soumis, 1 seul E.164 certain → 1 unité réservée. Un numéro écarté ne coûte rien.
    const res = await sendSms({
      tenantId: 'T', owner: CUSTOMER, message: 'x',
      to: [PHONE, '77123456', 'pas-un-numero'],
    })
    expect(res.refused?.reduce((s, r) => s + r.count, 0)).toBe(2)
    const reserved = redisMock.incrby.mock.calls.filter(c => !String(c[0]).startsWith('burst:'))
    expect(reserved.map(c => c[1])).toEqual([1])
  })

  it('rend les unités des envois ÉCHOUÉS, et seulement celles-là', async () => {
    // 3 destinataires, 2 refusés par l'opérateur → 2 unités rendues, 1 consommée.
    smsSend.mockResolvedValueOnce({
      SMSMessageData: { Recipients: [{ statusCode: 101 }, { statusCode: 403 }, { statusCode: 500 }] },
    } as SmsResponse)
    const res = await sendSms({
      tenantId: 'T', owner: CUSTOMER, message: 'x',
      to: ['+221771234567', '+221771234568', '+221771234569'],
    })
    expect(res.sent).toBe(1)
    expect(res.failed).toBe(2)
    expect(redisMock.decrby).toHaveBeenCalledWith(expect.any(String), 2)
  })

  it('un échec TOTAL rend toutes les unités', async () => {
    smsSend.mockRejectedValueOnce(new Error(`réseau injoignable ${PHONE}`))
    const res = await sendSms({
      tenantId: 'T', owner: CUSTOMER, message: 'x',
      to: ['+221771234567', '+221771234568'],
    })
    expect(res.sent).toBe(0)
    expect(res.failed).toBe(2)
    expect(redisMock.decrby).toHaveBeenCalledWith(expect.any(String), 2)
  })

  it('un envoi entièrement réussi ne rend AUCUNE unité', async () => {
    // Symétrie indispensable : une libération inconditionnelle rendrait le quota inopérant.
    smsSend.mockResolvedValueOnce({
      SMSMessageData: { Recipients: [{ statusCode: 101 }, { statusCode: 102 }] },
    } as SmsResponse)
    await sendSms({ tenantId: 'T', owner: CUSTOMER, message: 'x', to: ['+221771234567', '+221771234568'] })
    expect(redisMock.decrby).not.toHaveBeenCalled()
  })

  it('clé SMS absente → les unités réservées sont rendues (aucune dépense, aucun débit)', async () => {
    delete process.env.SMS_API_KEY
    const res = await sendSms({ tenantId: 'T', owner: CUSTOMER, message: 'x', to: [PHONE, '+221771234568'] })
    expect(res.code).toBe('SMS_NOT_CONFIGURED')
    expect(res.failed).toBe(2)
    expect(smsSend).not.toHaveBeenCalled()
    expect(redisMock.decrby).toHaveBeenCalledWith(expect.any(String), 2)
  })
})
