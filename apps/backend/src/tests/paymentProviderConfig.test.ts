import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  PAYMENT_PROVIDERS, providerMode, missingSecrets, requireProvider,
  PaymentNotConfiguredError, isNotConfigured, notConfiguredBody,
} from '../lib/payments/providerConfig'
import type { ProviderId } from '../lib/payments/providerConfig'
// ⚠️ Imports STATIQUES : les services lisent leur environnement À L'APPEL, donc une seule
// instance de module suffit — et on évite les doublons de classe qu'un `import()` sous
// `vi.resetModules()` fabriquerait (c'est ce qui a fait échouer `instanceof` au 1er tir).
import { createWaveCheckout } from '../services/wave'
import { createOMPayment } from '../services/orangeMoney'
import { getAccessToken } from '../services/mtnMomo'
import { getToken as campayGetToken, _resetTokenCache } from '../services/campay'
import { createInvoice, confirmInvoice } from '../services/paydunya'
import { verifyWavePayment } from '../services/wave'
import { verifyOMPayment } from '../services/orangeMoney'
import { getPaymentStatus } from '../services/mtnMomo'
import { getStatus as campayGetStatus } from '../services/campay'

/**
 * VERROU — un secret absent ne doit JAMAIS produire d'URL de checkout.
 *
 * Le défaut (mesuré sur Railway le 2026-08-06) : `WAVE_API_KEY` et `ORANGE_CLIENT_ID` sont
 * absentes en production, et les services rendaient alors `https://sandbox.wave.com/pay/
 * <ref>` — un artefact crédible, adossé à une `PlanRequest` en attente que rien ne pouvait
 * honorer puisque le webhook est fail-closed. Depuis l'alignement tarifaire, `starter` est
 * le plan par défaut de toute inscription ET il est achetable : c'était le chemin principal.
 *
 * ⚠️ L'assertion centrale est COMPORTEMENTALE, pas un grep : on APPELLE la fonction de
 * checkout avec un environnement vidé et on exige qu'elle ne rende aucune URL. Un test qui
 * se contenterait de lire la source resterait vert si la branche redevenait atteignable
 * autrement.
 *
 * ⚠️ `fetch` est mocké pour LEVER : si un service tentait malgré tout un appel réseau,
 * le test le verrait (échec bruyant) au lieu de partir sur Internet depuis la CI.
 */

const BACKEND = join(__dirname, '..', '..')
const SERVICES = join(BACKEND, 'src', 'services')

/** Toutes les variables citées par le registre, à vider avant chaque cas. */
const ALL_KEYS = [
  ...new Set(Object.values(PAYMENT_PROVIDERS).flatMap(p => [...p.secrets, ...(p.sandboxFlag ? [p.sandboxFlag] : [])])),
  'NODE_ENV',
]

const ENV_BACKUP: Record<string, string | undefined> = {}
beforeEach(() => {
  for (const k of ALL_KEYS) { ENV_BACKUP[k] = process.env[k]; delete process.env[k] }
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('APPEL RÉSEAU INTERDIT dans ce test') }))
})
afterEach(() => {
  for (const k of ALL_KEYS) {
    if (ENV_BACKUP[k] === undefined) delete process.env[k]
    else process.env[k] = ENV_BACKUP[k]
  }
  vi.unstubAllGlobals()
  _resetTokenCache()
})

/**
 * Point d'entrée « qui rend une URL » de chaque prestataire.
 * Le verrou les APPELLE tous ; il ne raisonne pas sur les noms de fichiers.
 */
const CHECKOUT_CALLS: Record<ProviderId, () => Promise<unknown>> = {
  wave: async () => {
    return createWaveCheckout({
      amount: 8000, currency: 'XOF', description: 'test', reference: 'HABA-T',
      redirectUrl: 'https://x.test/r', webhookUrl: 'https://x.test/w',
    })
  },
  orange_money: async () => {
    return createOMPayment({
      amount: 8000, reference: 'HABA-T', description: 'test',
      notifUrl: 'https://x.test/n', returnUrl: 'https://x.test/r', cancelUrl: 'https://x.test/c',
    })
  },
  mtn_momo: async () => getAccessToken(),
  campay: async () => campayGetToken(),
  paydunya: async () => {
    return createInvoice({
      amount: 8000, description: 'test', storeName: 'T',
      cancelUrl: 'https://x.test/c', returnUrl: 'https://x.test/r', callbackUrl: 'https://x.test/k',
    })
  },
}

/**
 * Point d'entrée « qui dit si c'est PAYÉ » de chaque prestataire.
 *
 * ⚠️ CE SECOND REGISTRE EXISTE PARCE QUE LE VERROU AVAIT UN TROU, trouvé en le sabotant :
 * n'exercer que les fonctions de checkout laissait `verifyWavePayment` et `verifyOMPayment`
 * hors de portée — or ce sont elles qui renvoyaient `paid: true` sans clé, c'est-à-dire une
 * CONFIRMATION DE PAIEMENT fabriquée, bien pire qu'un lien mort. Le sabotage « Orange
 * refabrique paid:true » passait au VERT. Un verrou qui ne couvre pas la pire branche est
 * un verrou qui rassure.
 *
 * `urlsIn` ne les aurait pas attrapées non plus : elles ne rendent aucune URL. D'où une
 * assertion distincte — aucune confirmation positive sans secret.
 */
const CONFIRMATION_CALLS: Record<ProviderId, () => Promise<unknown>> = {
  wave:         async () => verifyWavePayment('chk_test'),
  orange_money: async () => verifyOMPayment('HABA-T'),
  mtn_momo:     async () => getPaymentStatus('ref-test'),
  campay:       async () => campayGetStatus('ref-test'),
  paydunya:     async () => confirmInvoice('tok-test'),
}

/** Une confirmation POSITIVE de paiement dans la valeur rendue. */
function claimsPaid(value: unknown): boolean {
  let paid = false
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      if (/^(succeeded|success|successful|completed)$/i.test(v)) paid = true
    } else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (k === 'paid' && val === true) paid = true
        walk(val)
      }
    }
  }
  walk(value)
  return paid
}

const PROVIDERS = Object.keys(PAYMENT_PROVIDERS) as ProviderId[]

/** Toute chaîne qui ressemble à une URL de paiement dans la valeur rendue. */
function urlsIn(value: unknown): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') { if (/^https?:\/\//i.test(v)) out.push(v) }
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(value)
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
describe('couverture (sans ça, un prestataire oublié rendrait ce verrou décoratif)', () => {
  it('le registre couvre les CINQ prestataires', () => {
    expect(PROVIDERS.sort()).toEqual(['campay', 'mtn_momo', 'orange_money', 'paydunya', 'wave'])
  })

  it('chaque prestataire a un appel de checkout ET un appel de confirmation exercés', () => {
    for (const p of PROVIDERS) {
      expect(typeof CHECKOUT_CALLS[p], `${p} checkout`).toBe('function')
      expect(typeof CONFIRMATION_CALLS[p], `${p} confirmation`).toBe('function')
    }
    expect(Object.keys(CHECKOUT_CALLS).sort()).toEqual(PROVIDERS.sort())
    expect(Object.keys(CONFIRMATION_CALLS).sort()).toEqual(PROVIDERS.sort())
  })

  it('aucun service de paiement sur disque n’échappe au registre', () => {
    // ⚠️ C'est l'assertion qui empêche la dérive : un 6ᵉ prestataire ajouté dans
    // `services/` sans entrée au registre fait échouer CE test, pas un autre.
    const KNOWN = new Set(['wave.ts', 'orangeMoney.ts', 'mtnMomo.ts', 'campay.ts', 'paydunya.ts'])
    const suspects = readdirSync(SERVICES).filter(f => {
      if (!f.endsWith('.ts')) return false
      const src = readFileSync(join(SERVICES, f), 'utf8')
      // Un service « de paiement » = il parle à un HÔTE de prestataire. Le premier motif
      // retenu (checkout|paymentUrl|requestToPay) ratait `campay.ts`, dont l'API dit
      // `collect` et `getPaymentLink` : viser le vocabulaire d'un prestataire, c'est rater
      // ceux qui parlent une autre langue. On vise les HÔTES, qui ne mentent pas.
      return /api\.wave\.com|api\.orange\.com|momodeveloper|momoapi|campay\.net|paydunya\.com/i.test(src)
    })
    expect(new Set(suspects), `services de paiement non déclarés : ${suspects.filter(f => !KNOWN.has(f))}`)
      .toEqual(KNOWN)
  })

  it('chaque prestataire déclare au moins un secret', () => {
    for (const p of PROVIDERS) expect(PAYMENT_PROVIDERS[p].secrets.length, p).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('L’INVARIANT — secret absent, aucun opt-in ⇒ AUCUNE URL rendue', () => {
  for (const provider of PROVIDERS) {
    it(`${provider} refuse au lieu de fabriquer`, async () => {
      expect(missingSecrets(provider).length, 'l’environnement du test n’est pas vide').toBeGreaterThan(0)

      let rendu: unknown
      let leve: unknown
      try { rendu = await CHECKOUT_CALLS[provider]() } catch (e) { leve = e }

      // 1) rien qui ressemble à une URL n'a été rendu
      expect(urlsIn(rendu), `${provider} a rendu une URL sans secret`).toEqual([])
      // 2) et le refus est TYPÉ (pas une panne réseau déguisée)
      expect(leve, `${provider} n'a pas refusé`).toBeDefined()
      expect(isNotConfigured(leve), `${provider} : refus non typé`).toBe(true)
      expect((leve as Error).name).toBe('PaymentNotConfiguredError')
      expect((leve as PaymentNotConfiguredError).provider).toBe(provider)
      expect((leve as PaymentNotConfiguredError).missing.length).toBeGreaterThan(0)
    })
  }

  for (const provider of PROVIDERS) {
    it(`${provider} ne CONFIRME aucun paiement sans secret`, async () => {
      let rendu: unknown
      let leve: unknown
      try { rendu = await CONFIRMATION_CALLS[provider]() } catch (e) { leve = e }

      expect(claimsPaid(rendu), `${provider} a confirmé un paiement sans secret`).toBe(false)
      expect(isNotConfigured(leve), `${provider} : refus non typé`).toBe(true)
    })
  }

  it('claimsPaid détecte bien une confirmation fabriquée (contre-preuve)', () => {
    expect(claimsPaid({ status: 'succeeded', paid: true })).toBe(true)
    expect(claimsPaid({ status: 'SUCCESS', amount: 0, paid: true })).toBe(true)
    expect(claimsPaid({ status: 'completed' })).toBe(true)
    expect(claimsPaid({ status: 'pending', paid: false })).toBe(false)
    expect(claimsPaid(undefined)).toBe(false)
  })

  it('le message de refus ne divulgue AUCUNE valeur de secret, seulement des noms', () => {
    process.env.WAVE_API_KEY = 'sk_live_secret_a_ne_pas_fuir'
    process.env.ORANGE_CLIENT_ID = ''      // vide → manquant
    const err = new PaymentNotConfiguredError('orange_money', missingSecrets('orange_money'))
    expect(err.message).not.toContain('sk_live_secret_a_ne_pas_fuir')
    expect(err.message).toContain('ORANGE_CLIENT_ID')
  })
})

describe('sandbox VOLONTAIRE ≠ secret absent', () => {
  it('Wave : opt-in explicite hors production → artefact simulé assumé', async () => {
    process.env.WAVE_SANDBOX_LINKS = '1'
    process.env.NODE_ENV = 'test'
    const r = await createWaveCheckout({
      amount: 8000, currency: 'XOF', description: 'test', reference: 'HABA-T',
      redirectUrl: 'https://x.test/r', webhookUrl: 'https://x.test/w',
    })
    expect(r.checkoutUrl).toContain('sandbox.wave.com')
  })

  it('⚠️ le MÊME opt-in est INOPÉRANT en production', async () => {
    process.env.WAVE_SANDBOX_LINKS = '1'
    process.env.NODE_ENV = 'production'
    expect(providerMode('wave').mode).toBe('unconfigured')
    await expect(CHECKOUT_CALLS.wave()).rejects.toSatisfy(isNotConfigured)
  })

  it('MTN, Campay et PayDunya n’ont AUCUN mode simulé — même avec un drapeau', () => {
    for (const p of ['mtn_momo', 'campay', 'paydunya'] as ProviderId[]) {
      expect(PAYMENT_PROVIDERS[p].sandboxFlag, p).toBeNull()
      expect(providerMode(p).mode, p).toBe('unconfigured')
    }
  })

  it('un drapeau à une autre valeur que "1" ne vaut pas opt-in', () => {
    process.env.NODE_ENV = 'test'
    for (const v of ['0', 'true', 'yes', '']) {
      process.env.WAVE_SANDBOX_LINKS = v
      expect(providerMode('wave').mode, `valeur ${JSON.stringify(v)}`).toBe('unconfigured')
    }
  })

  it('secrets présents → live, sans jamais consulter le drapeau', () => {
    process.env.WAVE_API_KEY = 'wk_test'
    process.env.NODE_ENV = 'production'
    expect(providerMode('wave')).toEqual({ mode: 'live', missing: [] })
  })

  it('un secret BLANC vaut absent (`""` n’est pas une clé)', () => {
    process.env.WAVE_API_KEY = '   '
    expect(providerMode('wave').mode).toBe('unconfigured')
  })
})

describe('Campay — deux authentifications valides, une seule suffit', () => {
  it('jeton statique seul → live', () => {
    process.env.CAMPAY_TOKEN = 'tok'
    expect(providerMode('campay').mode).toBe('live')
  })
  it('identifiant + mot de passe → live', () => {
    process.env.CAMPAY_USERNAME = 'u'; process.env.CAMPAY_PASSWORD = 'p'
    expect(providerMode('campay').mode).toBe('live')
  })
  it('identifiant SEUL → refus (une moitié d’authentification n’en est pas une)', () => {
    process.env.CAMPAY_USERNAME = 'u'
    expect(providerMode('campay').mode).toBe('unconfigured')
  })
})

describe('corps de réponse des routes', () => {
  it('422 PAYMENT_NOT_CONFIGURED, avec un contact et sans jargon technique', () => {
    const b = notConfiguredBody('wave')
    expect(b.code).toBe('PAYMENT_NOT_CONFIGURED')
    expect(b.provider).toBe('wave')
    expect(b.contactEmail).toBeTruthy()
    expect(b.error).toMatch(/pas encore actif/i)
    expect(b.error).not.toMatch(/API_KEY|undefined|null|500|502/)
  })
  it('requireProvider rend le mode quand il ne lève pas', () => {
    process.env.WAVE_API_KEY = 'wk'
    expect(requireProvider('wave')).toBe('live')
  })
})

describe('les services consomment bien le garde partagé (anti-réintroduction)', () => {
  const SRC = (f: string) => readFileSync(join(SERVICES, f), 'utf8')
  const FILES = ['wave.ts', 'orangeMoney.ts', 'mtnMomo.ts', 'campay.ts', 'paydunya.ts']

  it('les cinq fichiers existent et sont non vides', () => {
    for (const f of FILES) {
      expect(existsSync(join(SERVICES, f)), f).toBe(true)
      expect(SRC(f).length, f).toBeGreaterThan(500)
    }
  })

  it('chacun importe providerConfig', () => {
    for (const f of FILES) expect(SRC(f), f).toContain("lib/payments/providerConfig")
  })

  it('aucun n’a gardé de constante de module pour son secret', () => {
    // ⚠️ Une constante figée au chargement rend les tests process.env inopérants — c'est
    // la convention déjà écrite pour les flags `_SANDBOX_AUTO_SUCCESS`.
    const interdits = [
      /^const WAVE_API_KEY\s*=/m,
      /^const OM_CLIENT_ID\s*=/m,
      /^const SUB_KEY\s*=/m,
    ]
    for (const f of FILES) {
      for (const re of interdits) expect(re.test(SRC(f)), `${f} : ${re}`).toBe(false)
    }
  })
})

describe('auto-exclusion : le verrou survit à son propre scan', () => {
  const SELF = join(BACKEND, 'src', 'tests', 'paymentProviderConfig.test.ts')
  it('ce fichier cite bien des URL sandbox (sinon la preuve serait vide)', () => {
    expect(readFileSync(SELF, 'utf8')).toContain('sandbox.wave.com')
  })
  it("n'est PAS dans le répertoire scanné", () => {
    expect(SELF.startsWith(SERVICES)).toBe(false)
    expect(SELF).toContain('/src/tests/')
  })
})

describe('limites assumées', () => {
  it('les documente', () => {
    const LIMITES = [
      // 1 — On prouve qu'AUCUNE URL n'est rendue sans secret. On ne prouve pas qu'une URL
      //     rendue AVEC secret soit valide : cela demanderait le vrai prestataire.
      'validite-de-l-url-en-mode-live-non-verifiee',
      // 2 — Les webhooks restent couverts ailleurs (payments.test.ts) : ils étaient déjà
      //     fail-closed, c'est l'aller qui ne l'était pas.
      'webhooks-couverts-ailleurs',
      // 3 — La détection d'un 6ᵉ service de paiement repose sur un motif textuel
      //     (checkout / paymentUrl / requestToPay…). Un service nommé autrement et
      //     n'employant aucun de ces mots passerait.
      'detection-d-un-nouveau-service-par-motif-textuel',
      // 4 — `NODE_ENV` est le seul signal de « production » utilisé. Un environnement de
      //     pré-production qui ne le pose pas pourrait activer un artefact simulé.
      'production-identifiee-par-NODE_ENV-seulement',
    ]
    expect(LIMITES).toHaveLength(4)
  })
})
