import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { api } from '@/lib/api'
import { markDemoSession, clearDemoSession } from '@/lib/demoSession'

/**
 * UN 401 N'A PAS UN SEUL SENS — et `request()` les confondait tous.
 *
 * Mesuré le 2026-10-02 : l'intercepteur purgeait le jeton et redirigeait vers /login sur
 * TOUT 401. Or `PATCH /api/auth/password` (Réglages → Changer le mot de passe) rend 401
 * quand le mot de passe ACTUEL est faux : un commerçant qui se trompe de frappe était
 * DÉCONNECTÉ, et l'écran de connexion lui annonçait « Session expirée » — un diagnostic
 * faux sur une erreur qu'il venait de commettre.
 *
 * La distinction vient du serveur : seules les gardes de JETON posent `code`
 * (`apps/backend/src/lib/authRefusal.ts`). Cas partagés : `docs/shared-fixtures/auth-refusal.json`.
 */
const CODE = (JSON.parse(
  readFileSync(join(__dirname, '../../../../docs/shared-fixtures/auth-refusal.json'), 'utf8'),
) as { tokenInvalid: string }).tokenInvalid

function reponse(status: number, corps: unknown): Response {
  const texte = JSON.stringify(corps)
  return { status, ok: status < 400, text: async () => texte } as Response
}

function poserLocation(pathname: string): { pathname: string; href: string } {
  const loc = { pathname, href: '' }
  Object.defineProperty(window, 'location', { value: loc, writable: true, configurable: true })
  return loc
}

let loc: { pathname: string; href: string }

beforeEach(() => {
  localStorage.setItem('habashop_token', 'jeton-en-cours')
  localStorage.setItem('habashop-auth', '{"state":{"token":"jeton-en-cours"}}')
  clearDemoSession()
  loc = poserLocation('/settings')
})
afterEach(() => { localStorage.clear(); clearDemoSession(); vi.restoreAllMocks() })

describe('401 de JETON → la session sort', () => {
  it('purge le stockage et renvoie sur /login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(401, { error: 'Non autorisé', code: CODE })))
    await expect(api.get('/api/products')).rejects.toThrow(/Session expirée/)
    expect(localStorage.getItem('habashop_token')).toBeNull()
    expect(localStorage.getItem('habashop-auth')).toBeNull()
    expect(loc.href).toBe('/login')
  })

  it('compte supprimé (démo purgée) → vitrine, pas un formulaire qu’on ne peut pas remplir', async () => {
    markDemoSession()
    loc = poserLocation('/dashboard')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(401, { error: 'Compte introuvable', code: CODE })))
    await expect(api.get('/api/products')).rejects.toThrow(/démonstration a expiré/)
    expect(loc.href).toBe('/?demo=expiree')
  })
})

describe('401 d’IDENTIFIANTS → la session SURVIT', () => {
  it('⚠️ mot de passe actuel faux (Réglages) : ni purge, ni redirection, et le VRAI message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(401, { error: 'Mot de passe actuel incorrect' })))

    const err: Error & { status?: number } = await api
      .patch('/api/auth/password', { currentPassword: 'faux', newPassword: 'motdepasse12' })
      .then(() => { throw new Error('la requête aurait dû échouer') })
      .catch((e: unknown) => e as Error & { status?: number })

    expect(err.message).toBe('Mot de passe actuel incorrect')
    expect(err.status).toBe(401)
    expect(localStorage.getItem('habashop_token')).toBe('jeton-en-cours')
    expect(localStorage.getItem('habashop-auth')).not.toBeNull()
    expect(loc.href).toBe('')
  })

  it('connexion refusée → le message du serveur, pas « Session expirée »', async () => {
    loc = poserLocation('/login')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(401, { error: 'Email ou mot de passe incorrect' })))
    await expect(api.post('/api/auth/login', { email: 'a@b.c', password: 'faux' }))
      .rejects.toThrow('Email ou mot de passe incorrect')
  })

  it('même en session de DÉMO, un mot de passe faux ne termine pas la démo', async () => {
    markDemoSession()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(401, { error: 'Mot de passe incorrect' })))
    await expect(api.delete('/api/account/me', { password: 'faux' })).rejects.toThrow('Mot de passe incorrect')
    expect(loc.href).toBe('')
    expect(localStorage.getItem('habashop_token')).toBe('jeton-en-cours')
  })

  it('401 sans corps lisible → prudence : on NE déconnecte PAS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false, text: async () => '' } as Response))
    await expect(api.get('/api/products')).rejects.toThrow()
    expect(localStorage.getItem('habashop_token')).toBe('jeton-en-cours')
    expect(loc.href).toBe('')
  })
})

describe('contrôles', () => {
  it('le code vient de la fixture partagée avec le backend', () => {
    expect(CODE).toBe('TOKEN_INVALID')
  })
  it('403 (rôle refusé) n’a jamais déconnecté et ne doit pas commencer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(403, { error: 'Accès refusé' })))
    await expect(api.get('/api/admin/tenants')).rejects.toThrow('Accès refusé')
    expect(localStorage.getItem('habashop_token')).toBe('jeton-en-cours')
  })
  it('contrôle positif : une réponse 200 passe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(200, { ok: true })))
    await expect(api.get('/api/products')).resolves.toEqual({ ok: true })
  })
})

// ─── UNE SEULE SORTIE DE SESSION ─────────────────────────────────────────────
// ⚠️ Il en existait DEUX. `src/services/api.ts` — un second client axios, mort depuis le
// premier commit de la vitrine (0 importateur mesuré contre 127 pour `lib/api`, et sa route
// `/api/auth/refresh` n'existe pas au backend) — portait sa PROPRE politique : « tout 401
// ⇒ purge + /login ». Supprimé. Ce verrou empêche qu'une seconde politique rentre en douce :
// un client HTTP qu'on écrit sans y penser hérite du défaut qu'on vient de corriger.
describe('périmètre — qui a le droit de décider d’une sortie de session', () => {
  const AUTORISES: Record<string, string> = {
    'lib/api.ts': 'le client HTTP unique — seul juge du 401',
    'lib/demoSession.ts': 'marque une session de démo (commentaire explicatif)',
    'stores/authStore.ts': 'déconnexion VOLONTAIRE, jamais déduite d’un statut',
    'components/landing/DemoExpiredNotice.tsx': 'affiche /?demo=expiree',
  }

  function sansCommentaires(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  }
  function fichiers(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) { if (e !== 'tests') fichiers(p, acc) }
      else if (/\.tsx?$/.test(e)) acc.push(p)
    }
    return acc
  }

  it('aucun module non nommé ne manipule un 401', () => {
    const racine = join(__dirname, '..')
    const liste = fichiers(racine)
    expect(liste.length).toBeGreaterThan(150) // couverture : le parcours a bien lu src/

    const porteurs = liste
      .filter(f => sansCommentaires(readFileSync(f, 'utf8')).includes('401'))
      .map(f => f.slice(racine.length + 1).split('\\').join('/'))

    for (const f of porteurs) {
      expect(Object.keys(AUTORISES), `${f} manipule un 401 sans être nommé`).toContain(f)
    }
    // Le client unique DOIT en faire partie — sinon le filtre ne mesure rien.
    expect(porteurs).toContain('lib/api.ts')
  })
})
