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

import { redactPhone, redactEmail, redactError } from '../lib/redactPhone'
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
    await sendWhatsApp({ tenantId: 'T', to: '+221771234567', body: 'x' , owner: { kind: 'customer' }, flow: 'transactional'})

    const logged = warn.mock.calls.flat().map(String).join(' | ')
    expect(logged).not.toContain('221771234567')
    expect(logged).not.toContain('771234567')
    expect(logged).not.toMatch(/\d{9,}/)   // aucune suite de 9+ chiffres
    warn.mockRestore()
  })

  it('plusieurs destinataires en échec : aucun numéro ne fuit', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createMock.mockRejectedValue(new Error('to +221770000001 failed'))
    await sendWhatsApp({ tenantId: 'T', to: ['+221770000001', '+221770000002'], body: 'x' , owner: { kind: 'customer' }, flow: 'transactional'})

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
    // ⚠️ L'ADRESSE E-MAIL EST UNE DONNÉE PERSONNELLE AU MÊME TITRE QUE LE NUMÉRO.
    // Ajouté le 2026-08-15 après avoir trouvé `console.log('📧 Email envoyé:', …, opts.to)`
    // dans `resendClient.ts` : le destinataire partait en clair dans les logs Railway.
    // La règle PII existait, elle n'avait jamais été transposée à ce canal.
    const EMAIL_VAR = /\b(opts\.to|payload\.to|\bto:\s*\w|recipientEmail|user\.email|admin\.email)\b/
    const RAW_ERR   = /\berr(or)?\.message\b/

    /**
     * ⚠️ PÉRIMÈTRE DÉRIVÉ, PLUS ÉCRIT À LA MAIN — et ce changement est la LEÇON du jour.
     *
     * `SEND_SURFACE` était une liste de TROIS chemins, tapée en dur. `resendClient.ts`
     * n'y figurait pas — il n'existait pas quand elle a été écrite — donc la fuite e-mail
     * a vécu là, sous un méta-test vert qui avait l'air de garder la surface d'envoi.
     * *Un périmètre écrit à la main est faux dès qu'on ajoute quelque chose, et
     * l'assertion de couverture ne le dira pas : elle prouve qu'on a lu N fichiers,
     * jamais que N était le bon N.*
     *
     * La surface d'envoi se DÉRIVE donc : tout `lib/spend/*Client.ts` — c'est-à-dire les
     * seuls modules autorisés à parler à un SDK payant, propriété déjà garantie par
     * `spendGuardAllowlist.test.ts` — plus les routes/services d'envoi nommés. Un
     * sixième prestataire câblé demain entre dans le périmètre sans que personne n'y pense.
     */
    const surfaceEnvoi = (rel: string) =>
      /^lib\/spend\/\w+Client\.ts$/.test(rel)
      || ['services/whatsappSend.ts', 'routes/whatsapp.ts'].includes(rel)

    const fichiers = walk(SRC)
    for (const f of fichiers) {
      const rel = relative(SRC, f).split('\\').join('/')
      if (rel.startsWith('lib/redactPhone')) continue
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        if (!CONSOLE.test(line) || line.includes('redact')) continue
        if (PHONE_VAR.test(line)) offenders.push(`${rel} :: ${line.trim().slice(0, 70)}`)
        if (surfaceEnvoi(rel) && (RAW_ERR.test(line) || EMAIL_VAR.test(line))) {
          offenders.push(`${rel} :: ${line.trim().slice(0, 70)}`)
        }
      }
    }

    // ⚠️ COUVERTURE — un `walk()` cassé rend une liste vide, donc « zéro coupable ».
    expect(fichiers.length).toBeGreaterThan(80)
    // Et le périmètre dérivé doit VRAIMENT contenir les clients payants : sans ce
    // contrôle, une regex trop stricte le viderait en se déclarant verte.
    const surfaces = fichiers.map(f => relative(SRC, f).split('\\').join('/')).filter(surfaceEnvoi)
    expect(surfaces).toContain('lib/spend/twilioClient.ts')
    expect(surfaces).toContain('lib/spend/resendClient.ts')
    expect(surfaces).toContain('lib/spend/smsClient.ts')

    expect(
      [...new Set(offenders)],
      'Numéro, adresse e-mail ou message d’erreur d’un SDK d’envoi journalisé sans caviardage — CLAUDE.md § PII.',
    ).toEqual([])
  })
})

describe('redactEmail — la personne disparaît, le fournisseur reste', () => {
  it('caviarde la partie locale et garde le domaine', () => {
    expect(redactEmail('kone.awa@boutique.sn')).toBe('k***@boutique.sn')
    // Le domaine sert au diagnostic de délivrabilité (« tous les gmail rebondissent ») ;
    // la partie locale est ce qui désigne la personne.
    expect(redactEmail('nelson.djoumessi@gmail.com')).toBe('n***@gmail.com')
  })

  it('caviarde DANS un message d’erreur, et toutes les adresses d’une ligne', () => {
    expect(redactEmail('Invalid recipient: a@x.sn, b@y.ci'))
      .toBe('Invalid recipient: a***@x.sn, b***@y.ci')
  })

  it('est idempotent et sûr sur une entrée vide ou non-chaîne', () => {
    const une = redactEmail('kone.awa@boutique.sn')
    expect(redactEmail(une)).toBe(une)
    for (const v of [null, undefined, 42, {}]) expect(() => redactEmail(v)).not.toThrow()
  })

  it('laisse intact ce qui n’est pas une adresse', () => {
    expect(redactEmail('total 12 500 FCFA · 2026-08-15')).toBe('total 12 500 FCFA · 2026-08-15')
  })

  it('⚠️ `redactError` traite les DEUX, et l’e-mail EN PREMIER', () => {
    // L'ordre est load-bearing : une partie locale numérique (`vendeur0771234567`) serait
    // attrapée par PHONE_LIKE au milieu de l'adresse, laissant un résultat NI lisible NI
    // anonyme. Ce cas échoue si quelqu'un inverse les deux passes.
    expect(redactError(new Error('to vendeur0771234567@boutique.sn failed')))
      .toBe('to v***@boutique.sn failed')
    // Et un message qui porte les deux formes est intégralement caviardé.
    const deux = redactError(new Error('client +221771234567 / awa@x.sn injoignable'))
    expect(deux).toContain('+221****4567')
    expect(deux).toContain('a***@x.sn')
  })
})
