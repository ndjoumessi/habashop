import { describe, it, expect } from 'vitest'
import {
  isFixtureTenant, CLIENT_TENANTS_WHERE, FIXTURE_TENANTS_WHERE, E2E_ID_PREFIX,
} from '../lib/fixtureTenant'

/**
 * VERROU — les fixtures ne sont pas des clients.
 *
 * La console Ops annonçait « 3 boutiques inscrites, toutes ont démarré ». MESURÉ le
 * 2026-08-06 : deux démos (`isDemo`) et un tenant E2E — **zéro client réel**. Un tableau
 * de bord qui affiche trois quand il y a zéro donne un chiffre auquel on va se fier.
 *
 * ⚠️ La décision se prend par PROPRIÉTÉ, jamais par une liste d'identifiants : une liste
 * vieillit, le prochain tenant de test n'y figure pas, et le chiffre redevient faux en
 * silence. C'est la même famille que le périmètre écrit à la main des verrous tarifaires.
 */

const t = (id: string, o: Partial<{ isDemo: boolean; isPlatform: boolean }> = {}) =>
  ({ id, isDemo: false, isPlatform: false, ...o })

describe('le prédicat décide par propriété', () => {
  // ⚠️ Tuple TYPÉ : un `it.each` dont les lignes ont plus d'éléments que la signature du
  // callback passe à l'exécution mais fait ÉCHOUER `tsc` — donc le BUILD backend, qui
  // décide du déploiement. Les tests verts ne suffisent pas (§ Rituel commit).
  const CAS_PREDICAT: [string, Partial<{ isDemo: boolean; isPlatform: boolean }>, boolean, string][] = [
    ['demo-tenant-001',   { isDemo: true },     true,  'boutique de démonstration'],
    ['demo-tenant-002',   { isDemo: true },     true,  'boutique de démonstration'],
    ['e2e-tenant',        {},                   true,  'convention d’ID E2E'],
    ['e2e-autre-chose',   {},                   true,  'convention d’ID E2E, quel que soit le suffixe'],
    ['cmrr2n9ua000rk',    { isPlatform: true }, true,  'tenant interne plateforme'],
    ['cmxyz-vrai-client', {},                   false, 'CLIENT'],
  ]
  it.each(CAS_PREDICAT)('%s → fixture=%s (%s)', (id, flags, attendu) => {
    expect(isFixtureTenant(t(id, flags))).toBe(attendu)
  })

  it('un identifiant qui CONTIENT « e2e » sans commencer par lui reste un client', () => {
    // Le préfixe, pas la sous-chaîne : « societe2e-shop » est un nom plausible.
    expect(isFixtureTenant(t('societe2e-shop'))).toBe(false)
    expect(isFixtureTenant(t('e2e-x'))).toBe(true)
  })

  it('les champs absents (Prisma partiel) ne font pas passer un client pour une fixture', () => {
    expect(isFixtureTenant({ id: 'abc' })).toBe(false)
    expect(isFixtureTenant({ id: 'abc', isDemo: null, isPlatform: null })).toBe(false)
  })
})

describe('les deux clauses Prisma sont bien COMPLÉMENTAIRES', () => {
  /**
   * ⚠️ Si elles ne l'étaient pas, un tenant pourrait être compté deux fois, ou dans aucun
   * des deux — et les totaux de la console ne sommeraient plus au nombre de tenants.
   */
  const CAS = [
    t('demo-tenant-001', { isDemo: true }),
    t('e2e-tenant'),
    t('interne', { isPlatform: true }),
    t('client-reel'),
  ]
  const matchFixture = (x: ReturnType<typeof t>) => !!x.isPlatform || !!x.isDemo || x.id.startsWith(E2E_ID_PREFIX)

  it('chaque tenant tombe dans EXACTEMENT une des deux clauses', () => {
    for (const x of CAS) {
      const f = matchFixture(x)
      expect(f).toBe(isFixtureTenant(x))
      // le complément : client ⇔ non-fixture
      expect(!f).toBe(!isFixtureTenant(x))
    }
  })

  it('la clause CLIENT exclut les trois propriétés, la clause FIXTURE les réunit', () => {
    expect(CLIENT_TENANTS_WHERE).toMatchObject({ isPlatform: false, isDemo: false })
    expect(CLIENT_TENANTS_WHERE.NOT).toEqual({ id: { startsWith: E2E_ID_PREFIX } })
    expect(FIXTURE_TENANTS_WHERE.OR).toHaveLength(3)
  })

  it('le préfixe est une CONSTANTE partagée, pas recopié dans les clauses', () => {
    expect(E2E_ID_PREFIX).toBe('e2e-')
    expect(JSON.stringify(FIXTURE_TENANTS_WHERE)).toContain(E2E_ID_PREFIX)
    expect(JSON.stringify(CLIENT_TENANTS_WHERE)).toContain(E2E_ID_PREFIX)
  })
})
