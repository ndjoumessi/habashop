import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'

// db.ts instancie PrismaClient → on mocke @prisma/client pour un import sans engine.
vi.mock('@prisma/client', () => ({
  PrismaClient: class { $extends() { return this } },
}))
vi.mock('../lib/userStatus', () => ({ isUserActive: vi.fn().mockResolvedValue(true) }))

import { applyTenantScope, TenantScopeMismatchError } from '../db'
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

  it('create AVEC tenantId = contexte → inchangé (pas de double injection)', () => {
    const args: any = { data: { name: 'X', tenantId: T } }
    expect(applyTenantScope('Customer', 'create', args, T)).toBe(false)
    expect(args.data.tenantId).toBe(T)
  })

  // ── Garde-fou écriture (Q1) : tenantId explicite ≠ contexte → THROW, jamais
  //    d'écrasement silencieux. ────────────────────────────────────────────────
  it('create avec tenantId ≠ contexte → TenantScopeMismatchError (403)', () => {
    const args: any = { data: { name: 'X', tenantId: 'autre-boutique' } }
    expect(() => applyTenantScope('Customer', 'create', args, T)).toThrow(TenantScopeMismatchError)
    expect(args.data.tenantId).toBe('autre-boutique') // jamais écrasé
    try { applyTenantScope('Customer', 'create', args, T) } catch (e: any) { expect(e.statusCode).toBe(403) }
  })

  it('createMany : tenantId injecté sur CHAQUE ligne absente', () => {
    const args: any = { data: [{ name: 'A' }, { name: 'B', tenantId: T }] }
    expect(applyTenantScope('Product', 'createMany', args, T)).toBe(true)
    expect(args.data[0].tenantId).toBe(T)
    expect(args.data[1].tenantId).toBe(T)
  })

  it('createMany : UNE ligne avec tenantId ≠ contexte → throw (aucune ligne ne passe)', () => {
    const args: any = { data: [{ name: 'A' }, { name: 'B', tenantId: 'autre' }] }
    expect(() => applyTenantScope('Product', 'createMany', args, T)).toThrow(TenantScopeMismatchError)
  })

  it('upsert : create.tenantId absent → injecté ; where composite non touché', () => {
    const args: any = { where: { tenantId_date: { tenantId: T, date: 'd' } }, create: { total: 1 }, update: { total: 1 } }
    expect(applyTenantScope('TicketZ', 'upsert', args, T)).toBe(true)
    expect(args.create.tenantId).toBe(T)
    expect(args.where).toEqual({ tenantId_date: { tenantId: T, date: 'd' } })
  })

  it('upsert : create.tenantId ≠ contexte → throw', () => {
    const args: any = { where: { id: 'x' }, create: { tenantId: 'autre' }, update: {} }
    expect(() => applyTenantScope('Shift', 'upsert', args, T)).toThrow(TenantScopeMismatchError)
  })

  it('upsert : update.tenantId ≠ contexte → throw (pas de réassignation via update)', () => {
    const args: any = { where: { id: 'x' }, create: { tenantId: T }, update: { tenantId: 'autre' } }
    expect(() => applyTenantScope('Attendance', 'upsert', args, T)).toThrow(TenantScopeMismatchError)
  })

  it('create sur modèle NON scopé avec tenantId étranger → laissé au handler (pas de throw)', () => {
    const args: any = { data: { fromTenantId: T, toTenantId: 'autre' } }
    expect(applyTenantScope('StockTransfer', 'create', args, T)).toBe(false)
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
  // ── Chaîne de services imbriqués (exigence A) : le contexte doit SURVIVRE à
  //    plusieurs awaits, des ticks macro/micro-task et des appels de service
  //    profonds — pas seulement une lecture directe dans le handler. ──────────
  const tick = () => new Promise<void>(r => setImmediate(r))
  const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

  async function serviceDeep(): Promise<string | null> {
    await tick()                                    // await n°3 (macro-task)
    await Promise.resolve()                         // await n°4 (micro-task)
    return tenantCtx.getStore()?.tenantId ?? null   // lecture au niveau le plus profond
  }

  async function serviceMid(ms: number): Promise<{ deep: string | null; injected: string | undefined }> {
    await delay(ms)                                 // await n°2 — force l'entrelacement des requêtes
    const deep = await serviceDeep()
    // Simule ce que fait l'extension Prisma À CE POINT du flux : l'injection
    // doit utiliser le tenant du contexte courant, pas celui d'une autre requête.
    const args: any = {}
    const ctx = tenantCtx.getStore()
    if (ctx?.tenantId) applyTenantScope('Product', 'findMany', args, ctx.tenantId)
    return { deep, injected: args.where?.tenantId }
  }

  async function buildApp() {
    const app = Fastify({ logger: false })
    // Reproduit le hook global de server.ts (établit le store au contexte racine).
    app.addHook('onRequest', (_r, _y, done) => { initTenantStore(); done() })
    await app.register(jwt, { secret: 'test-secret-ext' })
    // Route protégée par le VRAI authenticate ; le handler traverse une chaîne
    // de services multi-await avant de lire le contexte (exigence A).
    app.get('/ctx', { preHandler: authenticate }, async (req) => {
      await tick()                                  // await n°1 dans le handler
      const ms = Number((req.query as any).ms ?? 0)
      const { deep, injected } = await serviceMid(ms)
      return { handler: tenantCtx.getStore()?.tenantId ?? null, deep, injected: injected ?? null }
    })
    await app.ready()
    return app
  }

  it('le contexte tient à travers handler → service → sous-service (4 awaits, macro+micro-tasks)', async () => {
    const app = await buildApp()
    const token = app.jwt.sign({ userId: 'u1', role: 'ADMIN', tenantId: 'A', activeTenantId: 'A' })
    const res = await app.inject({ method: 'GET', url: '/ctx', headers: { Authorization: `Bearer ${token}` } })
    expect(res.statusCode).toBe(200)
    // Même tenant vu dans le handler, au fond de la chaîne, ET injecté par l'extension.
    expect(res.json()).toEqual({ handler: 'A', deep: 'A', injected: 'A' })
  })

  it('2 requêtes CONCURRENTES entrelacées (tenants A et B) → aucun store partagé, chacune injecte SON tenant', async () => {
    const app = await buildApp()
    const tokenA = app.jwt.sign({ userId: 'uA', role: 'ADMIN', tenantId: 'A', activeTenantId: 'A' })
    const tokenB = app.jwt.sign({ userId: 'uB', role: 'ADMIN', tenantId: 'B', activeTenantId: 'B' })
    // A attend 20 ms au milieu de sa chaîne pendant que B (5 ms) la traverse et
    // termine AVANT A → si le store fuyait entre requêtes, A verrait 'B'.
    const [resA, resB] = await Promise.all([
      app.inject({ method: 'GET', url: '/ctx?ms=20', headers: { Authorization: `Bearer ${tokenA}` } }),
      app.inject({ method: 'GET', url: '/ctx?ms=5', headers: { Authorization: `Bearer ${tokenB}` } }),
    ])
    expect(resA.json()).toEqual({ handler: 'A', deep: 'A', injected: 'A' })
    expect(resB.json()).toEqual({ handler: 'B', deep: 'B', injected: 'B' })
  })
})
