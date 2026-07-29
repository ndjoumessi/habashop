import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

/**
 * ⚠️ CONTRAT DE `POST /api/orders` — moitié BACKEND d'un test JUMEAU.
 *
 * Le frontend exerce le MÊME fichier de cas (`apps/frontend/src/tests/orderCreatePayload.test.ts`)
 * pour prouver que son constructeur produit `valides[0]`. Ici on prouve que le zod de la route
 * ACCEPTE chaque `valides` et REFUSE chaque `invalides`. Changer la règle d'un seul côté fait
 * rougir l'autre — convention anti-dérive du dépôt.
 *
 * Pourquoi : la création de commande était cassée en production (0 commande en base) et
 * AUCUN test ne regardait la charge utile. Le zod faisait son travail ; personne ne vérifiait
 * que le front lui parlait la même langue.
 *
 * ⚠️ Le schéma est RECOPIÉ ici depuis `routes/orders.ts` (il n'y est pas exporté). Un test
 * ci-dessous relit la source et rougit si la définition d'origine change — sans quoi cette
 * copie pourrait dériver en silence et le contrat ne prouverait plus rien.
 */

const ROUTE = join(__dirname, '..', 'routes', 'orders.ts')

// Copie conforme de `ORDER_CREATE` (`routes/orders.ts`).
const ORDER_CREATE = z.object({
  supplierId: z.string().min(1),
  items: z.array(z.object({
    product:   z.string(),
    qty:       z.coerce.number(),
    unitPrice: z.coerce.number(),
  }).passthrough()).min(1),
  expectedAt: z.any().nullish(),
  notes:      z.string().nullish(),
}).passthrough()

const CAS = JSON.parse(readFileSync(
  join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'order-create-cases.json'), 'utf-8',
)) as {
  valides: Array<{ nom: string; payload: unknown }>
  invalides: Array<{ nom: string; pourquoi: string; payload: unknown }>
}

describe('POST /api/orders — contrat partagé avec le frontend', () => {
  it('le fichier de cas est bien chargé (sinon les `it.each` seraient vides et VERTS)', () => {
    expect(CAS.valides.length).toBeGreaterThan(0)
    expect(CAS.invalides.length).toBeGreaterThan(0)
  })

  it.each(CAS.valides.map(c => [c.nom, c.payload] as const))(
    'ACCEPTE — %s', (_nom, payload) => {
      const r = ORDER_CREATE.safeParse(payload)
      expect(r.success ? '' : JSON.stringify(r.error.issues)).toBe('')
    },
  )

  it.each(CAS.invalides.map(c => [c.nom, c.payload, c.pourquoi] as const))(
    'REFUSE — %s', (_nom, payload, pourquoi) => {
      const r = ORDER_CREATE.safeParse(payload)
      expect(r.success ? `ACCEPTÉ À TORT (${pourquoi})` : 'refusé').toBe('refusé')
    },
  )
})

describe('la copie du schéma n’a pas dérivé de la route', () => {
  const source = readFileSync(ROUTE, 'utf-8')

  it('la route lue est bien celle des commandes', () => {
    expect(source).toContain("app.post('/api/orders'")
    expect(source).toContain('const ORDER_CREATE')
  })

  it('les contraintes recopiées sont toujours celles de la source', () => {
    // Si l'une de ces lignes bouge côté route, ce test rougit et désigne la copie à mettre à
    // jour — ainsi que le fichier de cas partagé, donc le frontend.
    expect(source).toMatch(/supplierId:\s*z\.string\(\)\.min\(1\)/)
    expect(source).toMatch(/product:\s*z\.string\(\)/)
    expect(source).toMatch(/unitPrice:\s*z\.coerce\.number\(\)/)
    expect(source).toMatch(/\)\.min\(1\)/)
  })

  it('⚠️ le modèle ne porte AUCUNE notion de commande client', () => {
    // Justifie la décision produit : les commandes client restent locales et éphémères.
    // Si ces colonnes apparaissent un jour, ce test rougit et signale que la dette est levée.
    const schema = readFileSync(join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf-8')
    const modele = schema.slice(schema.indexOf('model PurchaseOrder'), schema.indexOf('model PurchaseOrderItem'))
    expect(modele).toContain('supplierId')
    for (const absent of ['clientName', 'clientPhone']) {
      expect(`${absent}: ${modele.includes(absent)}`).toBe(`${absent}: false`)
    }
  })
})
