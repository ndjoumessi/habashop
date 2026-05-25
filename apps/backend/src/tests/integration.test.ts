import { describe, it, expect, beforeAll } from 'vitest'

// Tests d'intégration — LECTURE SEULE contre l'API prod.
// Aucune écriture (pas de create/update/delete) : sûr à exécuter en CI sur chaque push main.
// On se connecte UNE SEULE FOIS et on réutilise les tokens (le login est rate-limité 10/15min).
const API = process.env.API_URL ?? 'https://habashop-production.up.railway.app'

async function apiCall(
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

async function login(email: string, pwd: string): Promise<string> {
  const { body } = await apiCall('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: pwd }),
  })
  return body?.token ?? ''
}

// Tokens partagés (connexion unique au démarrage du fichier)
let token = ''
let token2 = ''
const auth = () => ({ Authorization: `Bearer ${token}` })

beforeAll(async () => {
  token = await login('admin@habashop.com', 'demo1234')
  token2 = await login('kone@habashop.com', 'demo1234')
})

// ── Auth ─────────────────────────────────────
describe('Integration — Auth', () => {
  it('Login admin → token JWT', () => {
    // déjà connecté dans beforeAll : on valide le token obtenu
    expect(token).toBeTruthy()
    expect(token.split('.').length).toBe(3) // header.payload.signature
  })

  it('Login mauvais password → 401', async () => {
    const { status } = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@habashop.com', password: 'wrongpassword' }),
    })
    expect(status).toBe(401)
  })

  it('Routes protégées sans token → 401', async () => {
    const routes = ['/api/products', '/api/customers', '/api/analytics/summary', '/api/billing/status']
    for (const route of routes) {
      const { status } = await apiCall(route)
      expect(status, `${route} devrait être 401`).toBe(401)
    }
  })
})

// ── Products (lecture) ───────────────────────
describe('Integration — Products', () => {
  it('GET /api/products → liste', async () => {
    const { status, body } = await apiCall('/api/products', { headers: auth() })
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })

  it('GET /api/products/low-stock → liste', async () => {
    const { status, body } = await apiCall('/api/products/low-stock', { headers: auth() })
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })
})

// ── Customers (lecture) ──────────────────────
describe('Integration — Customers', () => {
  it('GET /api/customers → liste', async () => {
    const { status, body } = await apiCall('/api/customers', { headers: auth() })
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })
})

// ── Analytics ─────────────────────────────────
describe('Integration — Analytics', () => {
  it('GET /api/analytics/summary → KPIs', async () => {
    const { status, body } = await apiCall('/api/analytics/summary', { headers: auth() })
    expect(status).toBe(200)
    expect(body.caToday).toBeDefined()
    expect(body.customers).toBeDefined()
    expect(typeof body.caToday).toBe('number')
  })

  it('GET /api/analytics → complet', async () => {
    const { status, body } = await apiCall('/api/analytics', { headers: auth() })
    expect(status).toBe(200)
    expect(body.kpis).toBeDefined()
    expect(body.charts).toBeDefined()
  })
})

// ── Billing ───────────────────────────────────
describe('Integration — Billing', () => {
  it('GET /api/billing/status → statut tenant', async () => {
    const { status, body } = await apiCall('/api/billing/status', { headers: auth() })
    expect(status).toBe(200)
    expect(body.plan).toBeDefined()
    expect(body.status).toBeDefined()
  })
})

// ── Isolation multi-tenant ────────────────────
describe('Integration — Isolation multi-tenant', () => {
  it('Tenant 1 et Tenant 2 ont des données séparées', async () => {
    const [r1, r2] = await Promise.all([
      apiCall('/api/customers', { headers: { Authorization: `Bearer ${token}` } }),
      apiCall('/api/customers', { headers: { Authorization: `Bearer ${token2}` } }),
    ])
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    const ids1 = new Set((Array.isArray(r1.body) ? r1.body : []).map((c: any) => c.id))
    const data2 = Array.isArray(r2.body) ? r2.body : []
    const crossed = data2.filter((c: any) => ids1.has(c.id))
    expect(crossed.length).toBe(0)
  })
})

// ── Super-Admin ───────────────────────────────
describe('Integration — Super-Admin', () => {
  it('GET /api/admin/stats → stats plateforme', async () => {
    const { status, body } = await apiCall('/api/admin/stats', { headers: auth() })
    expect(status).toBe(200)
    expect(body.totalTenants).toBeGreaterThan(0)
  })

  it('GET /api/admin/plan-requests → liste', async () => {
    const { status, body } = await apiCall('/api/admin/plan-requests', { headers: auth() })
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })
})

// ── Export CSV ────────────────────────────────
describe('Integration — Export CSV', () => {
  it('GET /api/export/products → CSV valide', async () => {
    const res = await fetch(`${API}/api/export/products`, { headers: auth() })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    // fetch().text() retire le BOM → on vérifie les octets bruts EF BB BF
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes)).toContain(';')
  })

  it('GET /api/export/customers → CSV valide', async () => {
    const res = await fetch(`${API}/api/export/customers`, { headers: auth() })
    expect(res.status).toBe(200)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
  })
})

// ── Health ────────────────────────────────────
describe('Integration — Health', () => {
  it('GET /api/health-extended → OK', async () => {
    const { status, body } = await apiCall('/api/health-extended')
    expect(status).toBe(200)
    expect(body.status).toBe('ok')
  })
})
