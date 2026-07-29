import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  mapApiOrder, toSupplierOption,
  type ApiOrder, type ApiOrderItem, type OrderSupplierOption,
} from '@/components/orders/ordersShared'
import type { ApiSupplier } from '@/components/suppliers/suppliersShared'

/**
 * ⚠️ FRONTIÈRE COMMANDES — le fil n'est PAS le domaine, et le fournisseur EMBARQUÉ non plus.
 *
 * `GET /api/orders` fait `include: { items: true, supplier: true }` sans `select` : le
 * `supplier` reçu est la ligne Prisma BRUTE (`ApiSupplier`), donc `categories` en chaîne et
 * `leadTime` en camelCase. C'est la frontière dans la frontière.
 *
 * Trois lectures fantômes vivaient ici — `s.specialty`, `s.category`, `s.lead_time` — aucune
 * n'a jamais existé côté serveur : la puce « Package » affichait le VIDE en production. Et le
 * filtre comparait `status` à `'inactive'` quand le serveur n'émet que
 * `'Actif' | 'Pause' | 'Inactif'` : un fournisseur désactivé restait proposé à la commande.
 *
 * Le vrai garde n'est pas ce fichier, ce sont les TYPES : `OrderSupplierOption` rend un champ
 * absent impossible (TS2339) et une comparaison hors union impossible (TS2367). Les
 * `@ts-expect-error` ci-dessous ÉCHOUENT si l'erreur cesse d'avoir lieu — ils gardent le garde.
 */

const BACKEND_ROUTE = join(__dirname, '..', '..', '..', 'backend', 'src', 'routes', 'orders.ts')

const FOURNISSEUR_FIL: ApiSupplier = {
  id: 'sup_1', tenantId: 't1', name: 'Grossiste Dakar',
  categories: 'Riz, Huile, Sucre',
  phone: '+221771234567', email: null, address: null,
  leadTime: 5, rating: 4, status: 'Actif', notes: null,
  createdAt: '2026-07-01T10:00:00.000Z', updatedAt: '2026-07-01T10:00:00.000Z', deletedAt: null,
}

const LIGNE_ITEM: ApiOrderItem = {
  id: 'it_1', orderId: 'ord_1', productName: 'Riz parfumé 5kg', qty: 10, unitPrice: 4500, total: 45000,
}

const COMMANDE_FIL: ApiOrder = {
  id: 'ord_1', tenantId: 't1', ref: 'CMD-2026-0001',
  supplierId: 'sup_1', createdById: 'u1',
  status: 'DRAFT', total: 45000,
  expectedAt: '2026-08-05T00:00:00.000Z', notes: null,
  createdAt: '2026-07-29T09:30:00.000Z', updatedAt: '2026-07-29T09:30:00.000Z', deletedAt: null,
  items: [LIGNE_ITEM], supplier: FOURNISSEUR_FIL,
}

describe('lecture — `mapApiOrder` traverse les quatre écarts fil ↔ domaine', () => {
  const o = mapApiOrder(COMMANDE_FIL)

  it('`supplier` : objet entier → le NOM', () => {
    expect(o.supplier).toBe('Grossiste Dakar')
  })

  it('`items[].productName` → `items[].product`', () => {
    expect(o.items[0].product).toBe('Riz parfumé 5kg')
    expect(o.items[0].unitPrice).toBe(4500)
  })

  it('`status` anglais → libellé français', () => {
    expect(o.status).toBe('BROUILLON')
    expect(mapApiOrder({ ...COMMANDE_FIL, status: 'IN_TRANSIT' }).status).toBe('EN TRANSIT')
    // Statut inconnu → repli, jamais une valeur hors de l'union `OrderStatus`.
    expect(mapApiOrder({ ...COMMANDE_FIL, status: 'PAS_UN_STATUT' }).status).toBe('BROUILLON')
  })

  it('`createdAt` ISO → `date` en YYYY-MM-DD, et `expectedAt` idem', () => {
    expect(o.date).toBe('2026-07-29')
    expect(o.expectedAt).toBe('2026-08-05')
    expect(mapApiOrder({ ...COMMANDE_FIL, expectedAt: null }).expectedAt).toBe('')
  })
})

describe('les trois champs fantômes ne peuvent plus revenir', () => {
  it('`toSupplierOption` alimente `specialty` depuis `categories` (la puce était VIDE)', () => {
    expect(toSupplierOption(FOURNISSEUR_FIL).specialty).toBe('Riz, Huile, Sucre')
    // `categories` nul sur le fil → chaîne vide, jamais `undefined` (React afficherait « rien »
    // dans les deux cas, mais `undefined` se propagerait dans `title={}` et les comparaisons).
    expect(toSupplierOption({ ...FOURNISSEUR_FIL, categories: null }).specialty).toBe('')
  })

  it('`leadTime` vient du champ camelCase, jamais d’un repli « — »', () => {
    expect(toSupplierOption(FOURNISSEUR_FIL).leadTime).toBe(5)
    // `Int @default(3)` NON nullable : 0 est une valeur légitime, que l'ancien `||` écrasait.
    expect(toSupplierOption({ ...FOURNISSEUR_FIL, leadTime: 0 }).leadTime).toBe(0)
  })

  it('un champ ABSENT du fil est refusé À LA COMPILATION (TS2339)', () => {
    const s: OrderSupplierOption = toSupplierOption(FOURNISSEUR_FIL)
    // @ts-expect-error `specialty` n'existe pas sur ApiSupplier — c'était la lecture fantôme
    expect(FOURNISSEUR_FIL.specialty).toBeUndefined()
    // @ts-expect-error `lead_time` (snake_case) n'a jamais existé
    expect(FOURNISSEUR_FIL.lead_time).toBeUndefined()
    // @ts-expect-error `category` au singulier n'existe pas — le champ est `categories`
    expect(FOURNISSEUR_FIL.category).toBeUndefined()
    expect(s.id).toBe('sup_1')
  })

  it('une comparaison de statut HORS UNION est refusée À LA COMPILATION (TS2367)', () => {
    const s = toSupplierOption(FOURNISSEUR_FIL)
    // @ts-expect-error le serveur n'émet que 'Actif' | 'Pause' | 'Inactif' — jamais 'inactive'
    expect(s.status !== 'inactive').toBe(true)
    // …la comparaison JUSTE, elle, compile.
    expect(s.status !== 'Inactif').toBe(true)
    expect(toSupplierOption({ ...FOURNISSEUR_FIL, status: 'Inactif' }).status).toBe('Inactif')
  })
})

describe('correspondance backend — la forme fil n’a pas bougé', () => {
  const source = readFileSync(BACKEND_ROUTE, 'utf-8')

  it('la route lue est bien celle des commandes (sinon le test ne prouve rien)', () => {
    expect(source).toContain("app.get('/api/orders'")
    expect(source).toContain("app.post('/api/orders'")
  })

  it('`GET` embarque items ET supplier, sans `select` qui restreindrait la forme', () => {
    // `ApiOrder` décrit la ligne brute + les deux relations. Un `select` la rendrait fausse.
    expect(source).toMatch(/include:\s*\{\s*items:\s*true,\s*supplier:\s*true\s*\}/)
    expect(source).not.toMatch(/purchaseOrder\.findMany\([^)]*select:/)
  })

  it('le POST ne rend PAS le supplier — la réponse de création est plus étroite', () => {
    // Justifie le `Omit<ApiOrder, 'supplier'>` d'`api.ts` : `include: { items: true }` seul.
    const post = source.slice(source.indexOf("app.post('/api/orders'"), source.indexOf("app.patch('/api/orders/:id/status'"))
    expect(post).toMatch(/include:\s*\{\s*items:\s*true\s*\}/)
    expect(post).not.toMatch(/include:\s*\{[^}]*supplier/)
  })
})
