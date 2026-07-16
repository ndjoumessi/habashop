import { readFileSync } from 'node:fs'

// Préconditions data/config du tenant E2E actif — source de vérité UNIQUE.
// Interroge l'API en LECTURE une seule fois, avec le token déjà obtenu par le projet
// `setup` (storageState) → AUCUN re-login (respect du rate-limit login 30/15min/IP).
// Les specs data/config-dépendantes s'y réfèrent pour un skip annoté (dette : issue #5).

const API = process.env.API_URL ?? 'https://habashop-production.up.railway.app'
const AUTH_FILE = process.env.E2E_AUTH_FILE ?? 'e2e/.auth/user.json'

export type Preconditions = {
  /** Le dashboard a un `categoryBreakdown` non vide → le donut « CA par catégorie » se rend. */
  hasRecentSales: boolean
  /** Au moins un client → les flux clients/fidélité ont une ligne à cibler. */
  hasCustomers: boolean
  /** Devise du tenant = EUR (certains tests d'affichage l'exigent). */
  currencyIsEUR: boolean
  /** `requireCashier=true` → l'ouverture de caisse affiche le champ « fond de caisse ». */
  requiresCashierFund: boolean
}

let cache: Promise<Preconditions> | null = null

function tokenFromStorageState(): string {
  const state = JSON.parse(readFileSync(AUTH_FILE, 'utf-8'))
  for (const origin of state.origins ?? []) {
    for (const item of origin.localStorage ?? []) {
      if (item.name === 'habashop_token' && item.value) return item.value
    }
  }
  throw new Error(`Token E2E introuvable dans ${AUTH_FILE} — le projet 'setup' a-t-il tourné ?`)
}

async function get(path: string, token: string): Promise<any> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

/** Résout les préconditions (mémoïsé : 1 seul appel réseau par worker, jamais de re-login). */
export function getPreconditions(): Promise<Preconditions> {
  if (!cache) {
    cache = (async () => {
      const token = tokenFromStorageState()
      const [tenant, customers, dash] = await Promise.all([
        get('/api/tenant', token),
        get('/api/customers', token),
        get('/api/dashboard/stats', token),
      ])
      const categoryBreakdown = Array.isArray(dash?.categoryBreakdown) ? dash.categoryBreakdown : []
      return {
        hasRecentSales: categoryBreakdown.length > 0,
        hasCustomers: Array.isArray(customers) && customers.length > 0,
        currencyIsEUR: tenant?.currency === 'EUR',
        requiresCashierFund: tenant?.requireCashier === true,
      }
    })()
  }
  return cache
}
