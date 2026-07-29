import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { toOrderPayload } from '@/components/orders/ordersShared'

/**
 * ⚠️ CHARGE UTILE DE `POST /api/orders` — moitié FRONTEND d'un test JUMEAU.
 *
 * Le backend exerce le MÊME fichier de cas contre le vrai zod `ORDER_CREATE`
 * (`apps/backend/src/tests/orderCreateContract.test.ts`). Modifier la règle d'un seul côté
 * fait rougir l'autre — c'est la convention anti-dérive du dépôt (`barcode-cases.json`,
 * `loyalty-discount-cases.json`).
 *
 * Pourquoi ce verrou existe : la création de commande était cassée EN PRODUCTION, avec
 * **0 commande en base**, parce que le front envoyait les lignes du formulaire telles quelles
 * — `{ id, name, price, qty, emoji }` — là où le zod exige `{ product, qty, unitPrice }`.
 * `create: (data: any)` acceptait tout, `tsc` était vert, et l'utilisateur ne voyait qu'un
 * « Échec de la création ». Aucun test ne regardait la charge utile.
 */

const CAS = JSON.parse(readFileSync(
  join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'order-create-cases.json'), 'utf-8',
)) as {
  valides: Array<{ nom: string; payload: Record<string, unknown> }>
  invalides: Array<{ nom: string; pourquoi: string; payload: Record<string, unknown> }>
}

describe('toOrderPayload — ce qu’on envoie vraiment au serveur', () => {
  it('le fichier de cas partagé est bien chargé (sinon ce bloc ne prouve rien)', () => {
    expect(CAS.valides.length).toBeGreaterThan(0)
    expect(CAS.invalides.length).toBeGreaterThan(0)
  })

  it('produit exactement le cas nominal du fichier partagé', () => {
    const attendu = CAS.valides[0].payload
    const obtenu = toOrderPayload({
      supplierId: 'sup_1',
      items: [
        { emoji: '🌾', name: 'Riz parfumé 5kg', price: 4500, qty: 10 },
        { emoji: '🫒', name: 'Huile palme 1L', price: 1800, qty: 4 },
      ],
      expectedAt: '2026-08-05',
      notes: 'Livraison matin',
    })
    expect(obtenu).toEqual(attendu)
  })

  it('traduit le vocabulaire du formulaire vers celui du fil', () => {
    const p = toOrderPayload({ supplierId: 's1', items: [{ emoji: '🌾', name: 'Riz', price: 4500, qty: 10 }] })
    // `name` → `product` (le NOM SEUL : l'emoji est une décoration d'écran, la base garde
    // une donnée exploitable) ; `price` → `unitPrice`. Ni `id` ni `emoji` ne partent.
    expect(p.items[0]).toEqual({ product: 'Riz', qty: 10, unitPrice: 4500 })
    expect(Object.keys(p.items[0]).sort()).toEqual(['product', 'qty', 'unitPrice'])
  })

  it('n’émet JAMAIS la forme qui a cassé la production', () => {
    const p = toOrderPayload({ supplierId: 's1', items: [{ emoji: '🌾', name: 'Riz', price: 4500, qty: 10 }] })
    const casse = CAS.invalides.find(c => c.nom.includes('CASSÉ LA PROD'))!
    expect(casse).toBeDefined()
    expect(p.items[0]).not.toEqual(casse.payload.items?.[0 as never])
    for (const interdit of ['name', 'price', 'emoji', 'id']) {
      expect(Object.keys(p.items[0])).not.toContain(interdit)
    }
  })

  it('`supplierId` est requis par le TYPE — la branche client ne peut plus appeler', () => {
    // @ts-expect-error `supplierId` manquant : c'est exactement ce que faisait la branche
    // client, qui se faisait refuser en 400 (le modèle n'a pas de commande client).
    expect(() => toOrderPayload({ items: [] })).toBeDefined()
  })

  it('échéance et notes absentes → `null`, jamais `undefined`', () => {
    // `undefined` disparaît à la sérialisation JSON : le serveur recevrait une clé absente.
    // `null` est explicite et accepté par `nullish()`.
    const p = toOrderPayload({ supplierId: 's1', items: [{ emoji: '', name: 'Sucre', price: 900, qty: 1 }] })
    expect(p.expectedAt).toBeNull()
    expect(p.notes).toBeNull()
    expect(p.items[0].product).toBe('Sucre') // le nom seul, quoi qu'il y ait dans `emoji`
  })
})
