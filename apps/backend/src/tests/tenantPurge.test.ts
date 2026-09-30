import { describe, it, expect, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { purgePlan, hardDeleteTenant, TENANT_ROOT, type PurgeTx } from '../lib/tenantPurge'

/**
 * ORDRE DE SUPPRESSION DÉRIVÉ — assertions de COUVERTURE, pas d'exécution.
 *
 * ⚠️ Le critère « porte un champ `tenantId` » est FAUX et ce test le prouve : StockTransfer
 * porte fromTenantId/toTenantId, SaleItem et PurchaseOrderItem n'ont aucun champ tenant et
 * pointent leur parent en Restrict. Les trois sont nommés ci-dessous.
 */

const plan = purgePlan()
const noms = plan.map(e => e.model)
const rang = new Map(noms.map((n, k) => [n, k]))

/** Arêtes enfant → parent, relues depuis le DMMF (la même source que le code testé). */
const liens = new Map(Prisma.dmmf.datamodel.models.map(m => [m.name, m.fields
  .filter(f => f.kind === 'object' && (f.relationFromFields ?? []).length > 0)
  .map(f => f.type)]))

describe('purgePlan', () => {
  it('COUVERTURE : le plan n’est pas vide et couvre l’essentiel du schéma', () => {
    // Un `walk()` cassé rendrait une liste vide, donc un vert qui ne garde rien.
    expect(plan.length).toBeGreaterThanOrEqual(28)
  })

  it('⚠️ contient les TROIS cas que le critère `tenantId` ratait', () => {
    for (const m of ['StockTransfer', 'SaleItem', 'PurchaseOrderItem']) {
      expect(noms, `${m} absent du plan → le tenant.delete() échouerait`).toContain(m)
    }
  })

  it('⚠️ n’inclut PAS `UserAuditLog` — un audit de sécurité survit à la suppression', () => {
    expect(noms).not.toContain('UserAuditLog')
  })

  it('n’inclut pas `Tenant` lui-même (supprimé à part, en dernier)', () => {
    expect(noms).not.toContain(TENANT_ROOT)
  })

  it('TOUTE arête enfant → parent place l’enfant AVANT le parent', () => {
    const violations: string[] = []
    for (const n of noms) {
      for (const cible of liens.get(n) ?? []) {
        if (cible === TENANT_ROOT) continue
        const rc = rang.get(cible)
        const rn = rang.get(n)
        if (rc === undefined || rn === undefined) continue
        if (rn > rc) violations.push(`${n} après ${cible}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('TÉMOIN NÉGATIF : l’ordre de déclaration VIOLE des arêtes — le tri n’est pas décoratif', () => {
    const declare = Prisma.dmmf.datamodel.models.map(m => m.name).filter(n => rang.has(n))
    const rangNaif = new Map(declare.map((n, k) => [n, k]))
    let violations = 0
    for (const n of declare) {
      for (const cible of liens.get(n) ?? []) {
        if (cible === TENANT_ROOT) continue
        const rc = rangNaif.get(cible)
        const rn = rangNaif.get(n)
        if (rc === undefined || rn === undefined) continue
        if (rn > rc) violations++
      }
    }
    // Mesuré sur le schéma du 2026-10-01 : 21. On exige « > 0 » pour ne pas figer un nombre.
    expect(violations).toBeGreaterThan(0)
  })

  it('les modèles à FK tenant directe ciblent le scalaire ; StockTransfer en OR sur ses DEUX', () => {
    const sale = plan.find(e => e.model === 'Sale')
    expect(sale?.where('T1')).toEqual({ tenantId: 'T1' })
    const st = plan.find(e => e.model === 'StockTransfer')
    expect(st?.where('T1')).toEqual({ OR: [{ fromTenantId: 'T1' }, { toTenantId: 'T1' }] })
  })

  it('les modèles SANS champ tenant passent par une relation imbriquée', () => {
    const poi = plan.find(e => e.model === 'PurchaseOrderItem')
    expect(poi?.where('T1')).toEqual({ order: { tenantId: 'T1' } })
  })
})

/** Faux client : un délégué `deleteMany` par modèle du plan, plus `tenant.delete`. */
function fauxTx(onDelete: (model: string, where: object) => void, count = 0): PurgeTx {
  const tx: Record<string, unknown> = {
    tenant: { delete: vi.fn(async () => { onDelete(TENANT_ROOT, {}); return {} }) },
  }
  for (const e of plan) {
    tx[e.delegate] = {
      deleteMany: vi.fn(async ({ where }: { where: object }) => {
        onDelete(e.model, where)
        return { count }
      }),
    }
  }
  return tx as unknown as PurgeTx
}

describe('hardDeleteTenant', () => {
  it('supprime dans l’ordre du plan, puis le tenant EN DERNIER', async () => {
    const appels: string[] = []
    await hardDeleteTenant(fauxTx(m => appels.push(m)), 'T1')
    expect(appels.at(-1)).toBe(TENANT_ROOT)
    expect(appels.slice(0, -1)).toEqual(plan.map(e => e.model))
  })

  it('⚠️ le mock APPLIQUE le filtre : un `where` sans le tenant serait détecté', async () => {
    const manquants: string[] = []
    await hardDeleteTenant(fauxTx((m, where) => {
      // Le tenant doit apparaître quelque part dans la clause — sinon on supprimerait
      // les lignes de TOUT LE MONDE. Un mock qui ignore ses arguments laisserait passer
      // exactement ce défaut.
      if (m !== TENANT_ROOT && !JSON.stringify(where).includes('T1')) manquants.push(m)
    }), 'T1')
    expect(manquants).toEqual([])
  })

  it('rend le compte de lignes supprimées par modèle — un ménage se mesure', async () => {
    const compte = await hardDeleteTenant(fauxTx(() => {}, 2), 'T1')
    expect(Object.keys(compte).length).toBe(plan.length)
    expect(Object.values(compte).every(n => n === 2)).toBe(true)
  })

  it('⚠️ un délégué Prisma absent lève BRUYAMMENT — jamais une purge partielle muette', async () => {
    const tx = fauxTx(() => {}) as unknown as Record<string, unknown>
    delete tx[plan[0].delegate]
    await expect(hardDeleteTenant(tx as unknown as PurgeTx, 'T1')).rejects.toThrow(/délégué Prisma absent/)
  })
})
