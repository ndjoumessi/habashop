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
      // ── Jeux de données par DOMAINE ────────────────────────────────────
      // ⚠️ Sans eux, chaque écran rendrait son état VIDE : il serait « complet » et
      // ne mesurerait RIEN. C'est le faux vert le plus facile à obtenir ici, et
      // l'assertion de couverture par écran est ce qui l'empêche.
      if (url.includes('/api/customers')) {
        return json(Array.from({ length: 12 }, (_, k) => ({
          id: `c-${k + 1}`, name: `Cliente témoin ${k + 1}`, phone: `+2376${String(10000000 + k)}`,
          email: null, address: 'Quartier témoin', points: k * 37, totalSpent: k * 12500,
          visits: k + 1, createdAt: new Date(2026, 6, 1 + k).toISOString(), lastVisit: new Date(2026, 7, 1).toISOString(),
        })))
      }
      if (url.includes('/api/suppliers')) {
        return json(Array.from({ length: 8 }, (_, k) => ({
          id: `f-${k + 1}`, name: `Fournisseur témoin ${k + 1}`, contact: 'Contact',
          phone: `+2376${String(20000000 + k)}`, email: null, address: 'Zone témoin',
          categories: 'Épicerie,Céréales', leadTime: 3 + k, rating: null, isActive: true,
        })))
      }
      if (url.includes('/api/orders')) {
        return json(Array.from({ length: 9 }, (_, k) => ({
          id: `o-${k + 1}`, reference: `CMD-${1000 + k}`, supplierId: 'f-1',
          supplier: { id: 'f-1', name: 'Fournisseur témoin 1', categories: 'Épicerie', leadTime: 3 },
          status: ['pending', 'confirmed', 'received'][k % 3], total: (k + 1) * 45000,
          items: [{ productId: 'p-1', productName: 'Produit témoin 001 800g', quantity: 4, unitPrice: 1200 }],
          createdAt: new Date(2026, 7, 1 + k).toISOString(), expectedAt: null,
        })))
      }
      if (url.includes('/api/employees')) {
        return json(Array.from({ length: 7 }, (_, k) => ({
          id: `e-${k + 1}`, name: `Employé témoin ${k + 1}`, role: 'Vendeur', type: 'CDI',
          salary: 90000 + k * 5000, phone: `+2376${String(30000000 + k)}`, email: null,
          hiredAt: new Date(2025, k, 1).toISOString(), isActive: true, perf: null,
          startAt: new Date(2025, k, 1).toISOString(), endAt: null, photo: null,
        })))
      }
      if (url.includes('/api/expenses')) {
        return json(Array.from({ length: 10 }, (_, k) => ({
          id: `d-${k + 1}`, label: `Dépense témoin ${k + 1}`, category: 'Loyer',
          amount: (k + 1) * 15000, date: new Date(2026, 7, 1 + k).toISOString(),
          supplier: null, notes: null, recurring: false,
        })))
      }
      if (url.includes('/api/goals')) {
        return json(Array.from({ length: 4 }, (_, k) => ({
          id: `g-${k + 1}`, label: `Objectif témoin ${k + 1}`, target: 500000 * (k + 1),
          current: 200000 * (k + 1), period: 'month', kind: 'revenue',
          createdAt: new Date(2026, 7, 1).toISOString(),
        })))
      }
      if (url.includes('/api/sales')) {
        return json(Array.from({ length: 15 }, (_, k) => ({
          id: `v-${k + 1}`, total: (k + 1) * 3200, payMode: ['cash', 'wave', 'card', 'orange', 'mtn'][k % 5],
          items: [{ productId: 'p-1', productName: 'Produit témoin 001 800g', quantity: 2, unitPrice: 1200 }],
          createdAt: new Date(2026, 7, 10, 8 + (k % 10)).toISOString(), status: 'completed',
          customerId: null, discount: 0, priceDivergence: false,
        })))
      }
      if (url.includes('/api/dashboard/stats')) {
        return json({
          todaySales: 148000, todayCount: 12, monthSales: 3200000, monthCount: 260,
          lowStock: 3, totalProducts: n, totalCustomers: 12,
          salesByDay: Array.from({ length: 7 }, (_, k) => ({ day: `J-${6 - k}`, total: 100000 + k * 12000 })),
          topProducts: [{ name: 'Produit témoin 001 800g', qty: 42, total: 50400 }],
        })
      }
      if (url.includes('/api/tenant/users')) {
        return json(Array.from({ length: 5 }, (_, k) => ({
          id: `u-${k + 1}`, name: `Utilisateur témoin ${k + 1}`, email: `u${k + 1}@habashop.test`,
          role: ['ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'HR'][k], isActive: true,
          twoFA: false, lastLoginAt: null,
        })))
      }
      if (url.includes('/api/audit-logs')) {
        // ⚠️ CETTE FIXTURE RENDAIT UN TABLEAU NU — l'ANCIEN contrat de la route, qui
        // renvoie désormais `{ items, total, limite, stats }`. Le balayage restait
        // VERT : l'écran affichait ses KPI et ses filtres sans une seule ligne, et le
        // seuil de contenu était atteint quand même. Une fixture périmée décrit un
        // monde qui n'existe plus, et elle le fait sans bruit.
        //
        // ⚠️ 100 lignes pour un total de 1342 : c'est LE cas que la production ne peut
        // pas montrer — le tenant de démonstration compte dix événements, donc la
        // troncature n'y apparaît jamais. C'est exactement la configuration qui avait
        // masqué le défaut d'origine.
        return json({
          items: Array.from({ length: 100 }, (_, k) => ({
            id: `al-${k + 1}`, tenantId: 'boutique-a', userId: 'u-1',
            module: k % 3 === 0 ? 'SETTINGS' : k % 3 === 1 ? 'POS' : 'STOCK',
            action: 'TENANT_LOCALE_CHANGE',
            description: JSON.stringify({ currency: { avant: 'XOF', apres: 'XAF' } }),
            severity: k % 25 === 0 ? 'danger' : 'info',
            ip: '127.0.0.1',
            createdAt: new Date(2026, 7, 12, 9, 0, k).toISOString(),
            user: { name: 'Témoin' },
          })),
          total: 1342,
          limite: 100,
          // ⚠️ LA LISTE des modules, pas leur compte — la route l'envoie depuis le
          // 2026-08-14, et l'écran en dérive À LA FOIS ses options de filtre et son
          // KPI « Modules concernés ».
          // ⚠️ Volontairement PLUS LARGE que ce que les 100 lignes portent, et avec
          // deux codes (`orders`, `suppliers`) qui tombent sur la MÊME catégorie
          // d'écran : une dérivation depuis les lignes reçues, ou un comptage des
          // codes stockés sans dédoublonnage, rendrait un nombre différent.
          modulesPresents: ['SETTINGS', 'POS', 'STOCK', 'orders', 'suppliers', 'payroll'],
          // ⚠️ Compteurs VOLONTAIREMENT incohérents avec les 100 lignes envoyées :
          // s'ils coïncidaient, une dérivation depuis les lignes passerait pour exacte.
          stats: { aujourdhui: 37, alertes: 12 },
        })
      }
      // ⚠️ Le panneau « Sécurité de mon compte » interroge une AUTRE route (échelle
      // utilisateur, hors boutique). Sans cette réponse il rendrait son état d'ÉCHEC,
      // et le balayage de densité mesurerait une géométrie que la production n'a pas.
      if (url.includes('/api/account/security-activity')) {
        return json([
          { id: 'sec-1', action: 'PASSWORD_CHANGE', description: 'Mot de passe modifié',
            ip: '127.0.0.1', severity: 'info', createdAt: new Date(2026, 7, 11, 8, 30).toISOString() },
        ])
      }
      if (url.includes('/api/billing/status')) {
        return json({ plan: 'business', status: 'active', trialEnds: null, quota: { ai: 0, ocr: 0 } })
      }
      if (url.includes('/api/payments/today-stats')) {
        // ⚠️ Les TROIS clés : `Integrations` somme `txStats.mtn.count + …` sans garde
        // de forme. Une réponse partielle y faisait crasher l'écran ENTIER — trouvé
        // par ce balayage, et durci côté page dans la foulée.
        const p = (c: number, a: number) => ({ count: c, amountXof: a })
        return json({ mtn: p(3, 45000), campay: p(1, 12000), paydunya: p(0, 0) })
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
