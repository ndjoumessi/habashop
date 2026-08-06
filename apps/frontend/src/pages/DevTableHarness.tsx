import { useEffect, useState } from 'react'
import AdminDashboard from '@/pages/AdminDashboard'

/**
 * HARNAIS DE MESURE — DÉVELOPPEMENT UNIQUEMENT.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * La table dense de la console Ops n'avait jamais été VUE. Son verrou
 * (`adminTableDense.test.tsx`) l'exerce à 50 lignes en **jsdom**, qui ne fait aucune mise en
 * page : ni largeur, ni retour à la ligne, ni débordement. On affirmait donc qu'elle ne
 * déborde pas sans l'avoir mesuré — le seul endroit du dépôt où une affirmation visuelle
 * n'était adossée à rien.
 *
 * ⚠️ La garde d'isolation P0 (`App.tsx` `PlatformAdminOnly`, `Sidebar.tsx`, figée par
 * `smoke.spec.ts`) protège la ROUTE `/admin`, pas le COMPOSANT — et elle reste INTACTE. Ce
 * harnais rend le même composant sur une route distincte qui **n'existe qu'en développement**.
 * On ne desserre pas un garde pour se donner un instrument : c'est le § « Vérification en
 * PROD » appliqué à l'UI.
 *
 * ─── ABSENCE DU BUNDLE DE PRODUCTION ─────────────────────────────────────────
 * Ce module n'est jamais importé statiquement : `App.tsx` fait
 * `import.meta.env.DEV ? lazy(() => import(…)) : null`. Le `import()` DOIT rester DANS la
 * branche — un `lazy()` inconditionnel laisserait Rollup émettre le chunk, exactement le
 * défaut qui avait livré `demo1234` en production.
 * ⚠️ Et l'absence n'est pas AFFIRMÉE, elle est VÉRIFIÉE sur le `dist/` livré :
 * `npm run verify:demo-flag` cherche aussi le marqueur ci-dessous. L'artefact décide.
 */
export const HARNESS_MARKER = '__habashop_dev_table_harness__'

/** Noms GÉNÉRÉS — jamais empruntés à une maquette ni à la production (§ Neutraliser les exemples). */
const LONG = 'Supérette du Grand Marché Central et Dépôt Régional'

function fauxTenants(n: number) {
  return Array.from({ length: n }, (_, k) => ({
    id: `harness-${String(k + 1).padStart(2, '0')}`,
    // Un nom long tous les 5 : c'est la colonne élastique qu'on veut voir se comporter.
    name: k % 5 === 0 ? `${LONG} ${k + 1}` : `Boutique ${String(k + 1).padStart(2, '0')}`,
    plan: ['starter', 'business', 'enterprise'][k % 3],
    status: ['active', 'trial', 'pending_payment', 'suspended', 'cancelled'][k % 5],
    country: ['CM', 'SN', 'CI'][k % 3],
    currency: 'XAF',
    createdAt: new Date(2026, 0, 1 + k).toISOString(),
    users: (k % 7) + 1,
    products: (k * 13) % 400,
    sales: (k * 97) % 5000,
    // ⚠️ CA à NEUF chiffres — le cas qui fait passer une cellule monétaire à la ligne.
    revenue: k % 4 === 0 ? 987_654_321 : (k * 1_234_567) % 90_000_000,
    mrr: k % 3 === 0 ? 25_000 : 8_000,
    lastActivityAt: k % 6 === 0 ? null : new Date(2026, 7, 1 + (k % 5)).toISOString(),
    isFixture: false,
  }))
}

/**
 * Intercepte les appels de la console Ops. On stubbe `fetch` plutôt que le module `adminApi` :
 * le composant rendu reste EXACTEMENT celui de production, y compris son chemin réseau.
 */
function installerFauxReseau(n: number) {
  const vrai = window.fetch.bind(window)
  const tenants = fauxTenants(n)
  window.fetch = (async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url)
    const json = (data: unknown) =>
      new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/api/admin/tenants')) return json(tenants)
    if (url.includes('/api/admin/plan-requests')) return json([])
    if (url.includes('/api/admin/stats')) {
      return json({
        totalTenants: n, activeTenants: n, totalUsers: 120, totalSales: 48_000,
        totalRevenue: 987_654_321, mrr: 640_000,
      })
    }
    return vrai(entree as RequestInfo, init)
  }) as typeof window.fetch
  return () => { window.fetch = vrai }
}

export default function DevTableHarness() {
  const [pret, setPret] = useState(false)
  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get('n') ?? 50)
    const defaire = installerFauxReseau(Number.isFinite(n) && n > 0 ? n : 50)
    setPret(true)
    return defaire
  }, [])
  if (!pret) return null
  return <div data-testid={HARNESS_MARKER}><AdminDashboard /></div>
}
