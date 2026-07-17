import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'

// db.ts instancie PrismaClient → on mocke @prisma/client pour un import sans engine.
vi.mock('@prisma/client', () => ({
  PrismaClient: class { $extends() { return this } },
}))
vi.mock('../lib/userStatus', () => ({ isUserActive: vi.fn().mockResolvedValue(true) }))

import { applyTenantScope } from '../db'
import { tenantCtx, initTenantStore } from '../lib/tenantContext'
import { authenticate } from '../middleware/authenticate'

const T = 'tenant-A'

describe('applyTenantScope — cœur de l\'auto-scoping (item 8)', () => {
  it('modèle scopé + findMany SANS where → injecte tenantId (defense-in-depth : filtre oublié)', () => {
    const args: any = {}
    expect(applyTenantScope('Product', 'findMany', args, T)).toBe(true)
    expect(args.where).toEqual({ tenantId: T })
  })

  it('findFirst avec autres conditions → tenantId ajouté (ET logique)', () => {
    const args: any = { where: { sku: 'X' } }
    applyTenantScope('Product', 'findFirst', args, T)
    expect(args.where).toEqual({ sku: 'X', tenantId: T })
  })

  it('tenantId DÉJÀ présent → inchangé (n\'écrase pas un cross-tenant volontaire)', () => {
    const args: any = { where: { tenantId: 'autre-boutique' } }
    expect(applyTenantScope('Sale', 'aggregate', args, T)).toBe(false)
    expect(args.where.tenantId).toBe('autre-boutique')
  })

  it('modèle EXCLU (User) → inchangé', () => {
    const args: any = {}
    expect(applyTenantScope('User', 'findMany', args, T)).toBe(false)
    expect(args.where).toBeUndefined()
  })

  it('modèle EXCLU (StockTransfer, isolation par 2 FK) → inchangé', () => {
    const args: any = {}
    expect(applyTenantScope('StockTransfer', 'findFirst', args, T)).toBe(false)
    expect(args.where).toBeUndefined()
  })

  it('findUnique (clé unique) → hors périmètre, inchangé', () => {
    const args: any = { where: { id: 'p1' } }
    expect(applyTenantScope('Product', 'findUnique', args, T)).toBe(false)
    expect(args.where).toEqual({ id: 'p1' })
  })

  it('update par id (clé unique) → hors périmètre (reste au handler)', () => {
    const args: any = { where: { id: 'p1' }, data: { stockQty: 1 } }
    expect(applyTenantScope('Product', 'update', args, T)).toBe(false)
  })

  it('create sans tenantId → data.tenantId posé', () => {
    const args: any = { data: { name: 'X' } }
    expect(applyTenantScope('Customer', 'create', args, T)).toBe(true)
    expect(args.data.tenantId).toBe(T)
  })

  it('create AVEC tenantId → inchangé', () => {
    const args: any = { data: { name: 'X', tenantId: 'déjà' } }
    expect(applyTenantScope('Customer', 'create', args, T)).toBe(false)
    expect(args.data.tenantId).toBe('déjà')
  })

  it('AuditLog est scopé (dans le périmètre)', () => {
    const args: any = {}
    expect(applyTenantScope('AuditLog', 'findMany', args, T)).toBe(true)
  })
})

describe('tenantCtx — contexte ALS', () => {
  it('getStore renvoie le tenant à l\'intérieur de run(), rien à l\'extérieur', () => {
    expect(tenantCtx.getStore()).toBeUndefined()
    tenantCtx.run({ tenantId: T }, () => {
      expect(tenantCtx.getStore()?.tenantId).toBe(T)
    })
    expect(tenantCtx.getStore()).toBeUndefined()
  })
})

describe('authenticate → handler : le contexte ALS se propage (vrai flux Fastify)', () => {
  async function buildApp() {
    const app = Fastify({ logger: false })
    // Reproduit le hook global de server.ts (établit le store au contexte racine).
    app.addHook('onRequest', (_r, _y, done) => { initTenantStore(); done() })
    await app.register(jwt, { secret: 'test-secret-ext' })
    // Route protégée par le VRAI authenticate : le handler lit le contexte ALS
    // que l'extension Prisma utiliserait → prouve la propagation onRequest → handler.
    app.get('/ctx', { preHandler: authenticate }, async () => ({ ctx: tenantCtx.getStore()?.tenantId ?? null }))
    await app.ready()
    return app
  }

  it('boutique active → le handler voit tenantCtx = activeTenantId (propagation onRequest→handler)', async () => {
    const app = await buildApp()
    const token = app.jwt.sign({ userId: 'u1', role: 'ADMIN', tenantId: 'A', activeTenantId: 'A' })
    const res = await app.inject({ method: 'GET', url: '/ctx', headers: { Authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json().ctx).toBe('A')
  })
})
