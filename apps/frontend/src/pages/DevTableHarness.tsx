import { useEffect, useMemo, useState } from 'react'
import AdminDashboard from '@/pages/AdminDashboard'
import StockInventory from '@/components/stock/StockInventory'
import { type ProductItem } from '@/components/stock/stockShared'
import { usePagination } from '@/hooks/usePagination'
import { useConfig, useFormatAmount } from '@/stores/appStore'

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

/**
 * ─── VUE « STOCK » ───────────────────────────────────────────────────────────
 * Deuxième table mesurée, ajoutée le 2026-08-13 après un défaut trouvé À L'ŒIL et
 * qu'aucun garde ne pouvait voir : la table de la vue LISTE débordait de 80 px à
 * 1440 px — la plus large des largeurs testées — et coupait en deux le bouton
 * Supprimer. jsdom ne fait aucune mise en page ; seul un vrai moteur le montre.
 *
 * ⚠️ On rend `StockInventory`, LE composant de production, pas une copie. Ce qui est
 * simulé, ce sont ses ENTRÉES (produits, rappels) — jamais son rendu.
 *
 * ─── ⚠️ DEUX JEUX DE DONNÉES, ET ILS NE SONT PAS INTERCHANGEABLES ────────────
 * Les deux défauts se mesurent sur des données OPPOSÉES, et c'est pour ça que le
 * paramètre existe plutôt qu'un seul jeu « bien choisi » :
 *
 *   `?vue=stock`            — prix et noms RÉALISTES (l'ordre de grandeur d'une
 *                             supérette). Sert à mesurer la LARGEUR NATURELLE de la
 *                             table, question dont la réponse dépend des données :
 *                             sur des montants à neuf chiffres elle serait fausse.
 *   `?vue=stock&extremes=1` — montants à NEUF chiffres et noms très longs. Sert à
 *                             l'ENROULEMENT, qui ne se déclenche que sous contrainte.
 *                             Une démonstration calée sur des valeurs confortables ne
 *                             démontre rien — c'est la leçon du camembert à 6 catégories.
 *
 * ⚠️ La cellule Marge porte DEUX unités de lecture (le pourcentage, puis le montant
 * en dessous) : c'est ce montant qui s'enroulait, et c'est pourquoi le détecteur du
 * spec descend jusqu'aux FEUILLES au lieu de mesurer le `<td>` entier.
 */
const NOM_LONG = 'Concentré de tomate double extra qualité en boîte de 800 grammes'

function fauxProduits(n: number, extremes: boolean): ProductItem[] {
  return Array.from({ length: n }, (_, k) => {
    // ⚠️ Réaliste = l'ordre de grandeur observé en production (3 à 4 chiffres en XOF).
    const buy = extremes && k % 4 === 0 ? 987_654_321 : ((k * 137) % 9_000) + 200
    return {
      _id: `harness-p-${k + 1}`,
      sku: `PRD-${String(k + 1).padStart(4, '0')}`,
      // Un nom long tous les 5 — MAIS en mode extrême seulement. La colonne Produit
      // n'a AUCUNE largeur maximale : un nom très long l'élargit sans borne, donc il
      // rendrait tout budget de largeur naturelle ininterprétable. C'est une limite
      // RÉELLE du composant, écrite ici plutôt que masquée par un jeu de données docile.
      // ⚠️ Le nom réaliste fait ~22 caractères — la LONGUEUR observée en production
      //    (« Tomate concentrée 800g »). Un « Produit 001 » de 11 caractères rendrait
      //    la colonne élastique plus étroite qu'en vrai, donc le budget de largeur
      //    passerait au vert sur une table que l'application ferait déborder.
      name: `📦 ${extremes && k % 5 === 0 ? `${NOM_LONG} ${k + 1}` : `Produit témoin ${String(k + 1).padStart(3, '0')} 800g`}`,
      category: ['Épicerie', 'Céréales', 'Corps gras', 'Laitiers', 'Conserves', 'Hygiène'][k % 6],
      buy,
      // Une vente NULLE tous les 7 : `productMargin` rend alors `null` et la cellule
      // n'a pas de sous-ligne — le cas qui rendrait aveugle un détecteur qui exigerait
      // toujours deux unités de lecture.
      sell: k % 7 === 0 ? 0 : Math.round(buy * 1.35),
      stock: (k * 17) % 300,
      threshold: 10 + (k % 40),
      supplier: '',
      barcode: '',
      hasPromotion: k % 9 === 0,
      promotionPrice: 100,
      promotionEnd: '2099-12-31',
    }
  })
}

/**
 * Rien de ceci n'est appelé par la mesure : la géométrie ne dépend pas des rappels.
 * ⚠️ `() => undefined` et non `() => {}` : le corps vide déclenche `no-empty-function`,
 * et les deux lints de ce dépôt sont des CLIQUETS — un avertissement de plus casse la CI.
 * On retire celui qu'on introduit ; on ne relève jamais le plafond pour se faire passer.
 */
const RIEN = () => undefined

function HarnaisStock({ n, extremes }: { n: number; extremes: boolean }) {
  const { stockShowSKU, lang } = useConfig()
  const fmt = useFormatAmount()
  const produits = useMemo(() => fauxProduits(n, extremes), [n, extremes])
  const [stockView, setStockView] = useState<'grid' | 'list'>('list')
  // ⚠️ La VRAIE pagination : sa taille de page (24) décide du nombre de rangées
  // rendues, donc de ce que la mesure voit. La recopier ici la ferait diverger.
  const pg = usePagination(produits, 24)
  return (
    /**
     * ⚠️ `.page-content` N'EST PAS DÉCORATIF — il est ce qui rend la mesure FIDÈLE.
     * MESURÉ le 2026-08-13, sur la production et sur ce harnais : à 390 px, la barre
     * de filtres de l'inventaire fait 447 px. Dans l'application la PAGE ne défile
     * pourtant pas, parce que `.page-content` déclare `overflow-y:auto` — ce qui fait
     * calculer `overflow-x` à `auto` par la règle CSS des axes, et absorbe le
     * débordement. Sans ce conteneur, le harnais faisait défiler la page et le spec
     * accusait un défaut qui n'existe pas dans le produit.
     * Un harnais qui omet un conteneur de l'application ne mesure pas l'application.
     */
    <div className="page-content">
      <StockInventory
        products={produits} fmt={fmt} lang={lang} stockShowSKU={stockShowSKU}
        navigate={RIEN}
        stockView={stockView} setStockView={setStockView}
        search="" setSearch={RIEN}
        cat="all" setCat={RIEN} cats={['Épicerie', 'Céréales', 'Corps gras', 'Laitiers', 'Conserves', 'Hygiène']}
        statusFilter="all" setStatusFilter={RIEN}
        promoOnly={false} setPromoOnly={RIEN} promoCount={0}
        pg={pg}
        setSelectedForLabel={RIEN} setShowLabelModal={RIEN}
        setProductEditMode={RIEN} setShowModal={RIEN}
        setForm={RIEN} setEditingSku={RIEN} setEditingId={RIEN} setModalTab={RIEN}
        onDeleteProduct={RIEN}
        selectedSkus={new Set<string>()}
        onToggleSelect={RIEN} onSelectAllVisible={RIEN} onClearSelection={RIEN}
        missingBarcodeCount={0} onOpenBackfill={RIEN}
      />
    </div>
  )
}

export default function DevTableHarness() {
  const [pret, setPret] = useState(false)
  const params = new URLSearchParams(window.location.search)
  const brut = Number(params.get('n') ?? 50)
  const n = Number.isFinite(brut) && brut > 0 ? brut : 50
  const vue = params.get('vue') === 'stock' ? 'stock' : 'ops'
  const extremes = params.get('extremes') === '1'
  useEffect(() => {
    // La console Ops passe par le réseau ; la vue Stock reçoit ses produits en props.
    if (vue !== 'ops') { setPret(true); return }
    const defaire = installerFauxReseau(n)
    setPret(true)
    return defaire
  }, [vue, n])
  if (!pret) return null
  return (
    // ⚠️ `data-harness-nonce` — l'IDENTITÉ du serveur, pas seulement sa présence. Le spec le
    // compare au jeton qu'il a injecté : un serveur tiers écoutant sur le même port rendrait
    // une page sans ce marqueur, et l'échec le DIT au lieu d'attendre un timeout de sélecteur.
    <div data-testid={HARNESS_MARKER} data-harness-nonce={import.meta.env.VITE_HARNESS_NONCE ?? ''}>
      {vue === 'stock' ? <HarnaisStock n={n} extremes={extremes} /> : <AdminDashboard />}
    </div>
  )
}
