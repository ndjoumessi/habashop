import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { suppliersApi } from '@/lib/api'
import { mapApiSupplier, type ApiSupplier } from '@/components/suppliers/suppliersShared'

/**
 * ⚠️ FRONTIÈRE FOURNISSEURS — `categories` est une CHAÎNE sur le fil, un `string[]` dans l'UI.
 *
 * Ce verrou est INVERSÉ par rapport à l'intuition : on garde que l'écriture envoie bien une
 * CHAÎNE. Un « nettoyage » a déjà transformé les deux appels en `categories.split(...)`, ce
 * qui envoyait un tableau — refusé par le zod backend (`z.string().nullish()`) avec un 400 sur
 * chaque création et chaque édition. `tsc` était VERT : le type de retour était une assertion,
 * pas une vérification. D'où ces tests, qui exercent le payload RÉEL.
 *
 * Le piège était d'autant plus discret que l'état local, lui, splittait correctement : l'écran
 * affichait le bon résultat, seul le serveur recevait faux — visible au prochain rechargement.
 */

const BACKEND_ROUTE = join(__dirname, '..', '..', '..', 'backend', 'src', 'routes', 'suppliers.ts')

/** Ligne telle que `GET /api/suppliers` la rend (Prisma brut, dates ISO). */
const LIGNE_FIL: ApiSupplier = {
  id: 'sup_1', tenantId: 't1', name: 'Grossiste Dakar',
  categories: 'Riz, Huile, Sucre',
  phone: '+221771234567', email: null, address: null,
  leadTime: 5, rating: 4, status: 'Actif', notes: null,
  createdAt: '2026-07-01T10:00:00.000Z', updatedAt: '2026-07-01T10:00:00.000Z', deletedAt: null,
}

let corpsEnvoyes: unknown[]

beforeEach(() => {
  corpsEnvoyes = []
  localStorage.setItem('habashop_token', 'jeton-de-test')
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.body) corpsEnvoyes.push(JSON.parse(String(init.body)))
    // ⚠️ `request()` lit `await res.text()` puis `JSON.parse`, jamais `res.json()` — mesuré
    // dans `api.ts:109`. Un mock qui n'expose que `json()` échoue sur `res.text is not a
    // function`, et l'aurait fait en décrivant un monde qui n'existe pas.
    return { ok: true, status: 200, text: async () => JSON.stringify(LIGNE_FIL) } as unknown as Response
  }))
})
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

describe('écriture — `categories` part en CHAÎNE, jamais en tableau', () => {
  it('create envoie une chaîne', async () => {
    await suppliersApi.create({ name: 'Grossiste Dakar', categories: 'Riz, Huile' })
    const body = corpsEnvoyes[0] as Record<string, unknown>
    expect(typeof body.categories, `categories envoyé comme ${JSON.stringify(body.categories)} — le backend exige une chaîne (zod z.string().nullish())`).toBe('string')
    expect(Array.isArray(body.categories)).toBe(false)
    expect(body.categories).toBe('Riz, Huile')
  })

  it('update envoie une chaîne', async () => {
    await suppliersApi.update('sup_1', { name: 'Grossiste Dakar', categories: 'Riz, Huile' })
    const body = corpsEnvoyes[0] as Record<string, unknown>
    expect(typeof body.categories).toBe('string')
    expect(Array.isArray(body.categories)).toBe(false)
  })

  it('un TABLEAU est refusé À LA COMPILATION (le bon côté de la barrière)', () => {
    // Le garde le plus fort n'est pas ce test mais la ligne ci-dessous : `@ts-expect-error`
    // ÉCHOUE si l'erreur n'a PAS lieu. Élargir `SupplierWrite.categories` pour accepter un
    // tableau rendrait cette directive inutilisée → `tsc` rouge, donc CI rouge.
    // @ts-expect-error categories doit être une chaîne, pas un string[]
    const refuse: Parameters<typeof suppliersApi.create>[0] = { name: 'X', categories: ['Riz'] }
    expect(refuse).toBeTruthy()
  })
})

describe('lecture — `mapApiSupplier` recompose le string[] depuis la chaîne fil', () => {
  it('découpe, taille et écarte les vides', () => {
    expect(mapApiSupplier(LIGNE_FIL).categories).toEqual(['Riz', 'Huile', 'Sucre'])
    expect(mapApiSupplier({ ...LIGNE_FIL, categories: ' Riz ,, Huile , ' }).categories).toEqual(['Riz', 'Huile'])
  })

  it('`null` sur le fil → tableau vide, jamais `undefined`', () => {
    // Un `undefined` ferait exploser `.join(', ')` et `.includes()` côté écran.
    expect(mapApiSupplier({ ...LIGNE_FIL, categories: null }).categories).toEqual([])
  })

  it('aller-retour : ce que l’UI affiche se re-sérialise en la chaîne du fil', () => {
    // C'est exactement ce que fait le formulaire d'édition (`categories.join(', ')`).
    const ui = mapApiSupplier(LIGNE_FIL)
    expect(ui.categories.join(', ')).toBe(LIGNE_FIL.categories)
  })
})

describe('correspondance avec le backend — le zod n’a pas changé de forme', () => {
  // Le schéma vit dans `apps/backend` et n'est pas importable ici (workspaces séparés), donc
  // la correspondance est relue depuis la SOURCE. Si le backend passait un jour à un tableau,
  // ce test rougit et désigne le type frontend à mettre à jour — au lieu de laisser les deux
  // côtés diverger en silence, ce qui est précisément ce qui a produit le 400.
  const source = readFileSync(BACKEND_ROUTE, 'utf-8')

  it('la route lue est bien celle des fournisseurs (sinon le test ne prouve rien)', () => {
    expect(source).toContain("app.post('/api/suppliers'")
    expect(source).toContain("app.put('/api/suppliers/:id'")
  })

  it('le zod déclare `categories` en chaîne nullish', () => {
    expect(source).toMatch(/categories:\s*z\.string\(\)\.nullish\(\)/)
  })

  it('`GET` rend la ligne brute — aucun `select` qui restreindrait la forme fil', () => {
    // `ApiSupplier` décrit TOUS les champs scalaires du modèle. Un `select` introduirait
    // une forme plus étroite et rendrait ce type faux.
    expect(source).toMatch(/prisma\.supplier\.findMany\(\{\s*where:/)
    expect(source).not.toMatch(/supplier\.findMany\([^)]*select:/)
  })
})
