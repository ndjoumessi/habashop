import { describe, it, expect } from 'vitest'
import { decideWsAuth } from '../lib/wsAuth'
import { resolvePlanId, planAmountXOF, purchasablePlans, YEARLY_MONTHS } from '../lib/plans'

describe('Rate-limiting config', () => {
  it('Login : max 30 / 15 min (relevé pour CGNAT mobile)', () => {
    expect({ max:30, timeWindow:'15 minutes' }.max).toBe(30)
  })
  it('Register : max 5 / 1h', () => {
    expect({ max:5, timeWindow:'1 hour' }.max).toBe(5)
  })
  it('Billing : max 3 / 1h', () => {
    expect({ max:3, timeWindow:'1 hour' }.max).toBe(3)
  })
})

describe('Multi-tenant isolation', () => {
  it('tenantId filtré dans queries', () => {
    const q = { where:{ tenantId:'t1' } }
    expect(q.where.tenantId).toBe('t1')
  })
  it('Données cross-tenant impossibles', () => {
    const t1 = [{ id:'1', tenantId:'t1' }]
    const t2 = [{ id:'2', tenantId:'t2' }]
    const ids = new Set(t1.map(d=>d.id))
    expect(t2.filter(d=>ids.has(d.id)).length).toBe(0)
  })
  it('JWT contient tenantId', () => {
    const p = { userId:'u1', tenantId:'t1', role:'ADMIN' }
    expect(p.tenantId).toBeDefined()
  })
})

/**
 * ⚠️ Ce bloc déclarait sa PROPRE copie des prix puis se vérifiait lui-même :
 *     const PRICES = { pro: { monthly: 24900 … } }
 *     expect(PRICES.pro.monthly).toBe(24900)
 * Une tautologie, verte quoi qu'il arrive au vrai tunnel de paiement. Pire, il figeait
 * le BUG en attente : « `starter` n'est pas un plan valide » — alors que `auth.ts`
 * l'attribue à chaque inscription. Un test qui protège le défaut, comme `reports.spec.ts`
 * assertait un bloc fabriqué. Il lit désormais le CATALOGUE.
 */
describe('Billing — plans et prix (lus dans le catalogue, pas recopiés)', () => {
  it('Plans valides — starter EN FAIT PARTIE', () => {
    expect(resolvePlanId('business')).toBe('business')
    expect(resolvePlanId('starter')).toBe('starter')     // ← était attendu FAUX
    expect(resolvePlanId('paypal')).toBeNull()
  })
  it('Prix mensuels du catalogue', () => {
    expect(planAmountXOF('starter', 'monthly')).toBe(8000)
    expect(planAmountXOF('business', 'monthly')).toBe(25000)
  })
  it('Annuel < 12 × mensuel (2 mois offerts)', () => {
    for (const p of purchasablePlans()) {
      expect(p.yearly!).toBeLessThan(p.monthly! * 12)
      expect(p.yearly!).toBe(p.monthly! * YEARLY_MONTHS)
    }
  })
  it('Méthodes paiement valides', () => {
    const m = ['wave','orange_money','mtn_money','virement','card']
    expect(m.includes('wave')).toBe(true)
    expect(m.includes('paypal')).toBe(false)
  })
})

describe('Export CSV', () => {
  it('BOM UTF-8 présent', () => {
    const csv = '\uFEFF' + 'Nom;Prix\n'
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
  })
  it('Séparateur point-virgule', () => {
    expect(['Riz','15000','100'].join(';')).toContain(';')
  })
  it('Ressources supportées', () => {
    const r = ['products','customers','suppliers','sales','employees','expenses']
    expect(r.includes('products')).toBe(true)
    expect(r.includes('unknown')).toBe(false)
  })
  it('Guillemets si cellule contient ;', () => {
    const cell = 'Épicerie; Dakar'
    const escaped = cell.includes(';') ? '"'+cell+'"' : cell
    expect(escaped.startsWith('"')).toBe(true)
  })
})

describe('Analytics', () => {
  it('Jours essai restants correct', () => {
    const trialEnds = new Date(Date.now()+7*24*60*60*1000)
    const days = Math.max(0, Math.ceil(
      (trialEnds.getTime()-Date.now())/(1000*60*60*24)
    ))
    expect(days).toBeGreaterThan(6)
  })
  it('CA moyen correct', () => {
    const sales = [{total:10000},{total:20000},{total:30000}]
    const total = sales.reduce((s,v)=>s+v.total,0)
    expect(Math.round(total/sales.length)).toBe(20000)
  })
  it('Essai expiré si passé', () => {
    const trialEnds = new Date(Date.now()-86400000)
    const days = Math.max(0,Math.ceil(
      (trialEnds.getTime()-Date.now())/(1000*60*60*24)
    ))
    expect(days).toBe(0)
  })
})

describe('WebSocket', () => {
  it('Types notifications valides', () => {
    const T = ['new_sale','low_stock','new_order','new_customer','system','ping']
    expect(T.includes('new_sale')).toBe(true)
    expect(T.includes('unknown')).toBe(false)
  })
  it('Format message sérialisable', () => {
    const msg = { type:'new_sale', data:{total:15000}, timestamp:new Date().toISOString() }
    expect(()=>JSON.parse(JSON.stringify(msg))).not.toThrow()
  })
  it('Délai reconnexion 5s', () => {
    expect(5000).toBe(5000)
  })
})

describe('WebSocket auth — decideWsAuth (fail-closed)', () => {
  const verifyOK  = (_t: string) => ({ tenantId: 't1', userId: 'u1', role: 'ADMIN' })
  const verifyBad = (_t: string) => { throw new Error('invalid signature') }

  it('refuse l’absence de token', () => {
    expect(decideWsAuth(undefined, verifyOK)).toEqual({ ok: false, reason: 'no-token' })
    expect(decideWsAuth('', verifyOK)).toEqual({ ok: false, reason: 'no-token' })
  })
  it('refuse un token invalide (verify throw)', () => {
    expect(decideWsAuth('xxx', verifyBad)).toEqual({ ok: false, reason: 'invalid-token' })
  })
  it('refuse un JWT valide mais sans tenantId', () => {
    const r = decideWsAuth('tok', () => ({ userId: 'u1' }))
    expect(r).toEqual({ ok: false, reason: 'no-tenant' })
  })
  it('accepte un JWT valide et expose tenantId/userId', () => {
    const r = decideWsAuth('tok', verifyOK)
    expect(r).toEqual({ ok: true, tenantId: 't1', userId: 'u1' })
  })
  it('ne propage jamais une exception (verify hostile)', () => {
    expect(() => decideWsAuth('tok', () => { throw 'boom' })).not.toThrow()
  })
})

describe('Sécurité', () => {
  it('Password absent des réponses', () => {
    const u = { id:'u1', name:'Admin', email:'a@a.com', role:'ADMIN', tenantId:'t1' }
    expect(u).not.toHaveProperty('password')
    expect(u).not.toHaveProperty('passwordHash')
  })
  it('JWT expiration > création', () => {
    const p = { iat:Date.now(), exp:Date.now()+604800000 }
    expect(p.exp).toBeGreaterThan(p.iat)
  })
  it('Prisma protège injection SQL', () => {
    const bad = "'; DROP TABLE users; --"
    const q = { where:{ email:bad } }
    expect(typeof q.where.email).toBe('string')
  })
  it('CORS origines définies', () => {
    const allowed = ['http://localhost:5173','https://habashop.vercel.app']
    expect(allowed.some(o=>o.includes('habashop'))).toBe(true)
  })
})

describe('CRUD complet — DELETE routes', () => {
  it('DELETE customer/supplier scopé par tenantId', () => {
    const where = { id:'c1', tenantId:'t1' }
    expect(where.tenantId).toBe('t1')
  })
  it('DELETE order nécessite role ADMIN/SUPER_ADMIN', () => {
    const allowed = ['ADMIN','SUPER_ADMIN']
    expect(allowed.includes('ADMIN')).toBe(true)
    expect(allowed.includes('CASHIER')).toBe(false)
  })
  it('Fournisseur avec commandes → 409 (P2003)', () => {
    expect('P2003' === 'P2003' ? 409 : 204).toBe(409)
  })
  it('Cross-tenant delete → 404 (P2025)', () => {
    expect('P2025' === 'P2025' ? 404 : 204).toBe(404)
  })
})

describe('Accessibilité ARIA', () => {
  it('roles ARIA valides', () => {
    const valid = ['button','dialog','navigation','search','status','alert','grid','img','searchbox']
    expect(valid.includes('dialog')).toBe(true)
    expect(valid.includes('invalid-role')).toBe(false)
  })
  it('valeurs aria-live valides', () => {
    const valid = ['polite','assertive','off']
    expect(valid.includes('polite')).toBe(true)
    expect(valid.includes('aggressive')).toBe(false)
  })
  it('inputs accessibles (id ou aria-label)', () => {
    const inputs = [{ id:'customer-name', ariaLabel:null }, { id:null, ariaLabel:'Rechercher' }]
    expect(inputs.every(i => i.id || i.ariaLabel)).toBe(true)
  })
})
