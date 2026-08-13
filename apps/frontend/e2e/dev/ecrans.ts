import { expect, type Page } from '@playwright/test'

/**
 * AMORÇAGE D'UN ÉCRAN COMPLET — barre latérale, en-tête, `page-content`, la vraie page.
 *
 * ─── CE QUE ÇA AJOUTE AUX HARNAIS DE COMPOSANTS ──────────────────────────────
 * Les harnais `?vue=…` montent des COMPOSANTS avec des props fabriquées. C'était leur
 * limite, écrite à chaque fois : « ils mesurent les surfaces, pas les écrans ». Un
 * défaut qui ne surviendrait qu'avec la mise en page RÉELLE — la barre latérale qui
 * mange 260 px, le `padding` de `.page-content`, un en-tête collant — leur échappait.
 * Ici on ne monte RIEN : on ouvre l'application, à ses vraies routes.
 *
 * ─── COMMENT, SANS BACKEND ───────────────────────────────────────────────────
 * `page.addInitScript` s'exécute AVANT tout script de la page : on y amorce le store
 * persisté (donc la session) et on y remplace `fetch`. L'application démarre alors
 * authentifiée, et chaque appel d'API reçoit une réponse déterministe. Aucun serveur
 * d'API n'est nécessaire — ce qui compte, puisque le job de densité ne démarre que
 * `vite dev`.
 *
 * ⚠️ AUCUNE GARDE N'EST DESSERRÉE. On fournit une session comme le ferait une
 * connexion ; `ProtectedRoute`, `RoleRoute` et `PlatformAdminOnly` s'appliquent
 * normalement. Le rôle amorcé est un SUPER_ADMIN **de boutique** — donc `/admin`
 * reste refusé, exactement comme au compte E2E. C'est la raison d'être du harnais
 * `/__dev/table`, et elle ne change pas.
 *
 * ⚠️ LA RÉPONSE PAR DÉFAUT EST UNE LISTE VIDE, JAMAIS UNE ERREUR. Un 500 ferait
 * rendre un état d'erreur : l'écran serait « complet » et VIDE, donc mesurable et
 * mesurant zéro. Le compte de lignes attendu, côté spec, est ce qui empêche ce
 * faux vert.
 */

/** Image RÉELLE sans réseau : 3:1, trois bandes — le rognage y est observable. */
export const PHOTO_ECRAN =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100">'
    + '<rect x="0" y="0" width="100" height="100" fill="#e11d48"/>'
    + '<rect x="100" y="0" width="100" height="100" fill="#0ea5e9"/>'
    + '<rect x="200" y="0" width="100" height="100" fill="#22c55e"/></svg>')

export const NB_PRODUITS = 24

/**
 * ⚠️ Le nom réaliste fait ~22 caractères — la longueur observée en production
 * (« Tomate concentrée 800g »). Plus court, la colonne élastique serait plus étroite
 * qu'en vrai et un budget de largeur passerait au vert sur une table qui déborde.
 */
export function seedEcran(page: Page) {
  return page.addInitScript(({ photo, n }) => {
    // ── 1. La session, sous la forme EXACTE du store persisté (`partialize`).
    localStorage.setItem('habashop-auth', JSON.stringify({
      state: {
        user: {
          id: 'u-1', name: 'Témoin', email: 'temoin@habashop.test',
          role: 'SUPER_ADMIN', isPlatformAdmin: false, tenantId: 'boutique-a',
        },
        token: 'jeton-de-mesure',
        isAuthenticated: true,
        tenants: [{ id: 'boutique-a', name: 'Boutique A', role: 'SUPER_ADMIN' }],
        activeTenantId: 'boutique-a',
      },
      version: 0,
    }))
    // Le jeton est lu DIRECTEMENT dans `localStorage` par `lib/api.ts` — pas depuis
    // le store. Sans lui, les requêtes partent sans en-tête d'autorisation.
    localStorage.setItem('habashop_token', 'jeton-de-mesure')

    const produits = Array.from({ length: n }, (_, k) => ({
      id: `p-${k + 1}`, _id: `p-${k + 1}`, productId: `p-${k + 1}`,
      sku: `PRD-${String(k + 1).padStart(4, '0')}`,
      name: `Produit témoin ${String(k + 1).padStart(3, '0')} 800g`,
      emoji: '🌾',
      // Une photo sur deux : les DEUX branches de `ProductThumb` doivent être exercées.
      image: k % 2 === 0 ? photo : null,
      category: ['Épicerie', 'Céréales', 'Corps gras', 'Laitiers', 'Conserves', 'Hygiène'][k % 6],
      buyPrice: ((k * 137) % 9000) + 200, sellPrice: Math.round((((k * 137) % 9000) + 200) * 1.35),
      buy: ((k * 137) % 9000) + 200, sell: Math.round((((k * 137) % 9000) + 200) * 1.35),
      price: 1200, stock: (k * 17) % 300, stockQty: (k * 17) % 300,
      threshold: 10 + (k % 40), unit: 'pièce', description: null,
      hasPromotion: k % 9 === 0, promotionPrice: 100, promotionEnd: '2099-12-31',
      supplier: '', supplierId: null, barcode: '',
    }))

    // ── 2. Le réseau. Réponse par DÉFAUT = liste vide, jamais une erreur.
    const vrai = window.fetch.bind(window)
    window.fetch = (async (entree: RequestInfo | URL, init?: RequestInit) => {
      const url = String(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url)
      const json = (d: unknown) =>
        new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (!url.includes('/api/')) return vrai(entree as RequestInfo, init)
      // ⚠️ `/api/auth/me` AVANT tout : `App.tsx` l'appelle au montage et fait
      // `.catch(() => logout())`. Une réponse générique y dégrade l'utilisateur (le
      // `role` disparaît) et peut renvoyer sur `/login` — l'écran mesuré serait alors
      // la page de connexion, « complète » et parfaitement hors sujet.
      if (url.includes('/api/auth/me')) {
        return json({ id: 'u-1', name: 'Témoin', email: 'temoin@habashop.test', role: 'SUPER_ADMIN', tenantId: 'boutique-a', isPlatformAdmin: false })
      }
      if (url.includes('/api/products')) return json(produits)
      if (url.includes('/api/public/catalog')) {
        return json({ tenant: { name: 'Boutique témoin', slug: 'temoin', currency: 'XOF', lang: 'fr' }, products: produits })
      }
      if (url.includes('/api/tenant')) {
        return json({ id: 'boutique-a', name: 'Boutique A', currency: 'XOF', lang: 'fr', country: 'CM', vatRate: 19.25, requireCashier: false })
      }
      if (url.includes('/api/health')) return json({ status: 'ok' })
      return json([])
    }) as typeof window.fetch
  }, { photo: PHOTO_ECRAN, n: NB_PRODUITS })
}

/**
 * ⚠️ IDENTITÉ DU SERVEUR — même exigence que pour les harnais, autre chemin.
 * Sur un écran RÉEL il n'y a pas de marqueur de harnais à lire : on passe donc
 * d'abord par `/__dev/table`, qui rend le jeton injecté par la configuration. Un port
 * n'est pas une identité, et une mesure faite sur l'application de quelqu'un d'autre
 * ressemblerait trait pour trait à une mesure valide.
 */
export async function ouvrirEcran(page: Page, chemin: string, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h })
  await page.goto('/__dev/table')
  const vu = await page.locator('[data-harness-nonce]').first()
    .getAttribute('data-harness-nonce', { timeout: 15_000 })
  expect(vu, 'le serveur qui répond n’est pas celui qu’on a démarré').toBe(process.env.HARNESS_NONCE)
  await page.goto(chemin)
}
