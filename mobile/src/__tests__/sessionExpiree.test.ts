import { readFileSync } from 'fs'
import { join } from 'path'
import axios from 'axios'
import { estSessionExpiree, CODE_JETON_INVALIDE } from '@/lib/sessionExpiree'

// Anti-dérive : ce test ET son jumeau apps/backend/src/tests/codeJetonInvalide.test.ts
// lisent le MÊME fichier. Renommer le code d'un seul côté fait échouer l'autre.
const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, '../../../docs/shared-fixtures/auth-refusal.json'), 'utf8'),
) as { tokenInvalid: string }

/** Erreur axios réaliste : `data` est le CORPS renvoyé par le serveur. */
const erreur = (status?: number, data?: unknown) =>
  new axios.AxiosError(
    status ? `HTTP ${status}` : 'timeout',
    status ? 'ERR_BAD_RESPONSE' : 'ECONNABORTED',
    undefined, undefined,
    status ? ({ status, data } as never) : undefined,
  )

describe('estSessionExpiree — identification POSITIVE du jeton mort', () => {
  it('le code vient de la fixture partagée avec le backend', () => {
    expect(CODE_JETON_INVALIDE).toBe(FIXTURE.tokenInvalid)
  })

  it('401 + TOKEN_INVALID = session expirée', () => {
    expect(estSessionExpiree(erreur(401, { error: 'Non autorisé', code: FIXTURE.tokenInvalid }))).toBe(true)
  })

  it('401 + compte supprimé = même remède', () => {
    expect(estSessionExpiree(erreur(401, { error: 'Compte introuvable', code: FIXTURE.tokenInvalid }))).toBe(true)
  })

  // ⚠️ LE PIÈGE. Trois routes rendent 401 pour « mauvais mot de passe ». Déconnecter
  // dessus, c'est éjecter un commerçant qui fait une faute de frappe dans « Changer le
  // mot de passe » ou dans l'écran de suppression de compte.
  it('401 SANS code (mot de passe incorrect) = PAS une expiration', () => {
    expect(estSessionExpiree(erreur(401, { error: 'Mot de passe actuel incorrect' }))).toBe(false)
    expect(estSessionExpiree(erreur(401, { error: 'Email ou mot de passe incorrect' }))).toBe(false)
    expect(estSessionExpiree(erreur(401, undefined))).toBe(false)
  })

  it('403 (rôle insuffisant — OCR MANAGER+, démo) = PAS une expiration', () => {
    expect(estSessionExpiree(erreur(403, { error: 'Accès refusé' }))).toBe(false)
    expect(estSessionExpiree(erreur(403, { code: 'DEMO_TENANT_FORBIDDEN' }))).toBe(false)
  })

  it('hors ligne / timeout (aucune réponse) = PAS une expiration', () => {
    expect(estSessionExpiree(erreur())).toBe(false)
  })

  it('5xx, 400, erreur non-axios = PAS une expiration', () => {
    expect(estSessionExpiree(erreur(500, { error: 'Erreur serveur' }))).toBe(false)
    expect(estSessionExpiree(erreur(400, { code: 'NO_ACTIVE_TENANT' }))).toBe(false)
    expect(estSessionExpiree(new Error('boom'))).toBe(false)
    expect(estSessionExpiree(null)).toBe(false)
  })
})

// ─── L'intercepteur est-il réellement BRANCHÉ ? ──────────────────────────────
// Le test ci-dessus prouve la RÈGLE ; celui-ci prouve qu'un appel réel la traverse.
describe('apiClient — un 401 de jeton déconnecte, un 401 de mot de passe non', () => {
  function reponse(status: number, data: unknown) {
    return async (config: never) => {
      throw new axios.AxiosError('refus', 'ERR_BAD_REQUEST', config, undefined,
        { status, data, statusText: '', headers: {}, config } as never)
    }
  }

  async function scenario(status: number, data: unknown) {
    jest.resetModules()
    // ⚠️ `authStore` d'abord : c'est LUI qui installe l'intercepteur (cf. le bas du
    // fichier) — api.ts ne peut pas l'installer sans créer un cycle d'imports.
    const { useAuthStore } = require('@/stores/authStore')
    const { apiClient } = require('@/services/api')
    await useAuthStore.getState().setAuth('jeton', { id: 'u1' }, { id: 't1', currency: 'XOF' })
    apiClient.defaults.adapter = reponse(status, data)
    await expect(apiClient.get('/api/products')).rejects.toBeTruthy()
    return useAuthStore.getState()
  }

  it('401 + TOKEN_INVALID → déconnecté, et l’écran de connexion peut le DIRE', async () => {
    const s = await scenario(401, { error: 'Non autorisé', code: FIXTURE.tokenInvalid })
    expect(s.isLoggedIn).toBe(false)
    expect(s.token).toBeNull()
    expect(s.sessionExpired).toBe(true)
  })

  it('401 de mot de passe → la session SURVIT (contrôle discriminant)', async () => {
    const s = await scenario(401, { error: 'Mot de passe actuel incorrect' })
    expect(s.isLoggedIn).toBe(true)
    expect(s.sessionExpired).toBe(false)
  })

  it('hors ligne (5xx) → la session survit', async () => {
    const s = await scenario(503, { error: 'indisponible' })
    expect(s.isLoggedIn).toBe(true)
    expect(s.sessionExpired).toBe(false)
  })

  // L'intercepteur s'installe au chargement d'`authStore`. Ce qui le garantit au
  // démarrage, c'est que la racine de l'application importe le store — on l'épingle,
  // sinon un « nettoyage » d'import désarmerait le garde sans qu'aucun test ne bouge.
  it('la racine de l’application charge bien authStore', () => {
    const racine = readFileSync(join(__dirname, '../../app/_layout.tsx'), 'utf8')
    expect(racine).toMatch(/from\s+'@\/stores\/authStore'/)
  })

  it('se reconnecter efface le drapeau — sinon le bandeau resterait pour toujours', async () => {
    jest.resetModules()
    const { useAuthStore } = require('@/stores/authStore')
    await useAuthStore.getState().expireSession()
    expect(useAuthStore.getState().sessionExpired).toBe(true)
    await useAuthStore.getState().setAuth('neuf', { id: 'u1' }, { id: 't1', currency: 'XOF' })
    expect(useAuthStore.getState().sessionExpired).toBe(false)
  })
})
