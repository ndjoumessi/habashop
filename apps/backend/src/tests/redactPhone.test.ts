import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Caviardage PII — CLAUDE.md : « numéros de téléphone jamais dans les logs Railway ».
 *
 * Les assertions portent sur CE QUI EST RÉELLEMENT JOURNALISÉ (contenu capturé du
 * console.warn), pas sur la présence d'un appel de fonction dans le source : c'est la
 * leçon des tests par regex de source relevée à la revue précédente.
 */

const { createMock, tenantStore, redisMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  tenantStore: { current: null as { isDemo: boolean; status: string; trialEnds: Date | null } | null },
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

import { redactPhone, redactError } from '../lib/redactPhone'
import { sendWhatsApp } from '../lib/spend/twilioClient'

beforeEach(() => {
  vi.clearAllMocks()
  tenantStore.current = { isDemo: false, status: 'active', trialEnds: null }
  redisMock.incrby.mockImplementation(async (k: string) => (String(k).startsWith('burst:') ? 1 : 1))
  process.env.TWILIO_ACCOUNT_SID = 'AC'
  process.env.TWILIO_AUTH_TOKEN = 'tok'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
})

describe('redactPhone — le numéro disparaît, le contexte reste', () => {
  it('caviarde un numéro international', () => {
    const out = redactPhone('+221771234567')
    expect(out).not.toContain('771234567')
    expect(out).toContain('4567')          // fin conservée pour le support
  })

  it('caviarde le numéro DANS un message d’erreur Twilio', () => {
    const out = redactError(new Error("The 'To' number whatsapp:+221771234567 is not a valid phone number"))
    expect(out).not.toContain('221771234567')
    expect(out).not.toContain('771234567')
    expect(out).toContain('not a valid phone number') // le motif reste exploitable
  })

  it('laisse intacts les nombres qui ne sont PAS des numéros', () => {
    // Sinon les logs deviennent illisibles : codes d'erreur, SID, montants, dates.
    expect(redactPhone('Twilio error code: 21211')).toContain('21211')
    expect(redactPhone('total 14350 XOF')).toContain('14350')
    expect(redactPhone('2026-07-22T21:00:00Z')).toContain('2026-07-22')
  })

  it('est idempotent et sûr sur une entrée vide ou non-chaîne', () => {
    const once = redactPhone('+221771234567')
    expect(redactPhone(once)).toBe(once)
    expect(redactPhone(null)).toBe('')
    expect(redactPhone(undefined)).toBe('')
    expect(redactError('boom')).toBe('boom')
  })

  it('caviarde TOUS les numéros d’une même ligne', () => {
    const out = redactPhone('de +221770000001 vers +221770000002')
    expect(out).not.toMatch(/\d{9,}/)
  })
})

describe('Chemin réel — aucun numéro dans ce qui est journalisé', () => {
  it('un échec Twilio ne publie pas le numéro du client', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createMock.mockRejectedValue(Object.assign(
      new Error("The 'To' number whatsapp:+221771234567 is not a valid phone number"),
      { code: 21211 },
    ))
    await sendWhatsApp({ tenantId: 'T', to: '+221771234567', body: 'x' , owner: { kind: 'customer' }})

    const logged = warn.mock.calls.flat().map(String).join(' | ')
    expect(logged).not.toContain('221771234567')
    expect(logged).not.toContain('771234567')
    expect(logged).not.toMatch(/\d{9,}/)   // aucune suite de 9+ chiffres
    warn.mockRestore()
  })

  it('plusieurs destinataires en échec : aucun numéro ne fuit', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createMock.mockRejectedValue(new Error('to +221770000001 failed'))
    await sendWhatsApp({ tenantId: 'T', to: ['+221770000001', '+221770000002'], body: 'x' , owner: { kind: 'customer' }})

    const logged = warn.mock.calls.flat().map(String).join(' | ')
    expect(logged).not.toMatch(/\d{9,}/)
    warn.mockRestore()
  })
})

describe('Méta-test — pas de journalisation brute d’un numéro', () => {
  const SRC = join(__dirname, '..')

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(e => {
      const full = join(dir, e)
      if (statSync(full).isDirectory()) return e === 'tests' ? [] : walk(full)
      return /\.ts$/.test(full) ? [full] : []
    })
  }

  it('aucun console.* ne passe un message d’erreur Twilio ou un numéro sans caviardage', () => {
    // Les erreurs Twilio embarquent le destinataire : les journaliser brutes republie
    // le numéro. On interdit le motif, pas l'intention.
    const offenders: string[] = []
    // ⚠️ On raisonne LIGNE PAR LIGNE et on vérifie la présence de `redact` DANS l'appel :
    // une lookahead `(?![^)]*redact)` ne voit pas un `redactPhone(` placé AVANT la
    // variable et signalait un appel pourtant correct (faux positif constaté).
    const CONSOLE   = /console\.(log|warn|error)\(/
    const PHONE_VAR = /\b(waPhone|formattedPhone|cleanPhone|customer\.phone|ownerPhone)\b/
    const RAW_ERR   = /\berr(or)?\.message\b/
    // `err.message` n'embarque un numéro que sur la surface d'envoi : une erreur Redis
    // ou Prisma n'en contient pas, et tout interdire noierait la règle sous le bruit.
    const SEND_SURFACE = ['lib/spend/twilioClient.ts', 'services/whatsappSend.ts', 'routes/whatsapp.ts']

    for (const f of walk(SRC)) {
      const rel = relative(SRC, f).split('\\').join('/')
      if (rel.startsWith('lib/redactPhone')) continue
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        if (!CONSOLE.test(line) || line.includes('redact')) continue
        if (PHONE_VAR.test(line)) offenders.push(`${rel} :: ${line.trim().slice(0, 70)}`)
        if (SEND_SURFACE.includes(rel) && RAW_ERR.test(line)) offenders.push(`${rel} :: ${line.trim().slice(0, 70)}`)
      }
    }
    expect(
      [...new Set(offenders)],
      'Numéro ou message d’erreur Twilio journalisé sans redactPhone/redactError — CLAUDE.md § PII.',
    ).toEqual([])
  })
})
