import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import POSProductGrid from '@/components/pos/POSProductGrid'
import NewOrderModal from '@/components/orders/NewOrderModal'
import SubscriptionModal from '@/components/subscriptions/SubscriptionModal'
import ProductPhotoField from '@/components/stock/ProductPhotoField'
import StockTransfers from '@/components/stock/StockTransfers'
import Subscriptions from '@/pages/Subscriptions'
import PublicCatalog from '@/pages/PublicCatalog'
import { useAuthStore } from '@/stores/authStore'
import { DEFAULT_MARKET } from '@/lib/defaultMarket'

/**
 * HARNAIS DES SURFACES RÉELLES — DÉVELOPPEMENT UNIQUEMENT.
 *
 * ─── POURQUOI, ET CE QU'IL AJOUTE ────────────────────────────────────────────
 * `?vue=photo` mesure `ProductThumb` SEUL : il prouve que le composant se dessine
 * carré. Il ne dit RIEN de ce que ses appelants en font — et le défaut du 2026-08-12
 * était précisément chez un appelant (`style={{ width: '100%' }}` dans la grille POS),
 * pas dans le composant. Deux règles de source couvrent aujourd'hui les deux formes
 * connues (largeur dans `style`, taille relative dans `size`) ; ce harnais couvre le
 * RÉSULTAT, quelle que soit la forme — y compris celles qu'on n'a pas imaginées.
 *
 * ⚠️ ON MONTE LES COMPOSANTS DE PRODUCTION, jamais des copies. Ce qui est fabriqué,
 * ce sont leurs ENTRÉES : props, réponses réseau, état du store. La frontière est
 * exactement celle du harnais de la console Ops.
 *
 * ⚠️ ET C'EST LÀ SA LIMITE, écrite plutôt que masquée : des props fabriquées ne sont
 * pas les props de la vraie page. Un défaut qui ne surviendrait qu'avec la mise en
 * page RÉELLE d'un parent que le harnais ne monte pas (une modale ouverte dans son
 * écran, un conteneur de page particulier) resterait invisible. Ce harnais mesure les
 * SURFACES, pas les ÉCRANS.
 */
export const SURFACES_MARKER = '__habashop_dev_surfaces_harness__'

/** Image RÉELLE sans réseau : trois bandes, 3:1 — le rognage y est observable. */
export const PHOTO_TEST =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100">'
    + '<rect x="0" y="0" width="100" height="100" fill="#e11d48"/>'
    + '<rect x="100" y="0" width="100" height="100" fill="#0ea5e9"/>'
    + '<rect x="200" y="0" width="100" height="100" fill="#22c55e"/></svg>')

const produit = (k: number) => ({
  id: `s-${k}`, _id: `s-${k}`, productId: `s-${k}`,
  sku: `PRD-${k}`, name: `Produit témoin ${k} 800g`,
  // ⚠️ Une photo sur DEUX seulement : les deux branches de `ProductThumb` doivent être
  // exercées. Un jeu où tout porte une photo laisserait le repli émoji non mesuré —
  // or c'est LUI qui masquait le défaut (un émoji est du texte centré, il se moque de
  // la largeur de sa boîte).
  image: k % 2 === 0 ? PHOTO_TEST : null,
  emoji: '🌾', category: 'Épicerie',
  price: 1200, sellPrice: 1200, buyPrice: 800, buy: 800, sell: 1200,
  stock: 40, threshold: 10, qty: 1, quantity: 1, unitPrice: 1200,
  product: null as unknown as Record<string, unknown>,
})

const PRODUITS = Array.from({ length: 6 }, (_, k) => produit(k + 1))
/** Les lignes d'abonnement/transfert portent le produit imbriqué. */
const AVEC_PRODUIT = PRODUITS.map(p => ({ ...p, product: p }))

/** Réponses réseau des surfaces qui chargent leurs données. */
function installerReseau() {
  const vrai = window.fetch.bind(window)
  window.fetch = (async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url)
    const json = (data: unknown) =>
      new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/api/stock/transfers')) {
      return json(AVEC_PRODUIT.map((p, k) => ({
        id: `t-${k}`, productId: p.id, product: p, quantity: 3, status: 'pending',
        fromTenantId: 'boutique-a', toTenantId: 'boutique-b',
        createdAt: new Date(2026, 7, 1).toISOString(),
      })))
    }
    if (url.includes('/api/subscriptions')) {
      return json([{
        id: 'ab-1', name: 'Abonnement témoin',
        // ⚠️ `customer` IMBRIQUÉ, pas `customerName` : `SubCard` lit `sub.customer.name`
        // et lève sur l'objet absent. Une fixture approximative ne rend pas une surface
        // approximative — elle la rend MUETTE, et c'est le compte par surface qui le dit.
        customerId: 'c-1', customer: { id: 'c-1', name: 'Cliente témoin' },
        dayOfWeek: 1, status: 'active', items: AVEC_PRODUIT,
        createdAt: new Date(2026, 7, 1).toISOString(),
      }])
    }
    if (url.includes('/api/public/catalog')) {
      return json({
        // ⚠️ La devise vient de la SOURCE UNIQUE, même dans une fixture. L'écrire en
        // dur ici en ferait un septième défaut de marché — et `defaultMarket.test.ts`
        // l'a signalé au commit même. Un harnais n'est pas exempté d'une règle qui
        // vise la FORME : c'est justement là qu'un littéral se réinstalle sans bruit.
        tenant: { name: 'Boutique témoin', slug: 'temoin', currency: DEFAULT_MARKET.currency, lang: 'fr' },
        products: PRODUITS,
      })
    }
    if (url.includes('/api/products')) return json(PRODUITS)
    return vrai(entree as RequestInfo, init)
  }) as typeof window.fetch
  return () => { window.fetch = vrai }
}

const RIEN = () => undefined

/** Encadre chaque surface d'un marqueur : le spec compte les vignettes PAR surface. */
function Surface({ nom, children }: { nom: string; children: React.ReactNode }) {
  return (
    <section data-surface={nom} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
      <h2 style={{ fontSize: 12, color: 'var(--text3)' }}>{nom}</h2>
      {children}
    </section>
  )
}

export default function DevSurfacesHarness() {
  const [pret, setPret] = useState(false)
  useEffect(() => {
    const defaire = installerReseau()
    // Les surfaces authentifiées lisent le store, pas le réseau.
    useAuthStore.setState({
      user: { id: 'u-1', name: 'Témoin', email: 't@habashop.test', role: 'SUPER_ADMIN', isPlatformAdmin: false } as never,
      tenants: [{ id: 'boutique-a', name: 'Boutique A' }, { id: 'boutique-b', name: 'Boutique B' }] as never,
      activeTenantId: 'boutique-a',
    })
    setPret(true)
    return defaire
  }, [])
  if (!pret) return null

  return (
    <div data-testid={SURFACES_MARKER} className="page-content">
      <Surface nom="pos-grid">
        <POSProductGrid
          posTab="pos" lang="fr" activeCat="" setActiveCat={RIEN}
          clientType="retail" setClientType={RIEN}
          fmt={(n: number) => `${n} FCFA`} amountLabel={(n: number) => String(n)} curSuffix="FCFA"
          filtered={PRODUITS as never} cart={[]} addItem={RIEN} getPrice={() => 1200}
          posShowStockOnTile loadingHistory={false} salesHistory={[]}
          canAuditPrices={false} divergenceOnly={false} onToggleDivergence={RIEN}
          canRefund={false} onRefundClick={RIEN}
          isMobile={false} mobileView="grid"
          totalProducts={PRODUITS.length} loadingProducts={false} navigate={RIEN}
        />
      </Surface>

      <Surface nom="new-order-modal">
        <NewOrderModal
          onClose={RIEN} orderType="supplier" setOrderType={RIEN}
          newOrderForm={{ items: AVEC_PRODUIT } as never} setNewOrderForm={RIEN}
          selectedClient={null} setSelectedClient={RIEN}
          clientSuggestions={[]} setClientSuggestions={RIEN}
          showClientDropdown={false} setShowClientDropdown={RIEN}
          customers={[]} suppliersList={[]} selectedSupplierId="" setSelectedSupplierId={RIEN}
          availableProducts={PRODUITS as never} productSearch="" setProductSearch={RIEN}
          handleCreateOrder={RIEN}
        />
      </Surface>

      <Surface nom="subscription-modal">
        <SubscriptionModal lang="fr" sub={{ id: 'ab-1', items: AVEC_PRODUIT } as never} onClose={RIEN} onSaved={RIEN} />
      </Surface>

      <Surface nom="product-photo-field">
        <ProductPhotoField productId="s-2" image={PHOTO_TEST} emoji="🌾" lang="fr" onImage={RIEN} onEnAttente={RIEN} />
      </Surface>

      <Surface nom="stock-transfers">
        <StockTransfers />
      </Surface>

      <Surface nom="subscriptions-page">
        <Subscriptions />
      </Surface>

      <Surface nom="public-catalog">
        {/*
          ⚠️ `PublicCatalog` lit son `slug` dans l'URL et rend « introuvable » sans lui —
          donc aucune vignette, donc une surface muette. On ne peut PAS lui donner un
          routeur à soi : un `<Router>` imbriqué dans celui de l'application lève
          (mesuré — c'est ce qui a fait échouer le harnais entier au premier essai, en
          se présentant comme « le marqueur d'identité n'est jamais apparu »).
          Un `<Routes>` s'imbrique, lui : le chemin courant `/__dev/table` fournit le
          segment « table » comme slug, et le réseau stubbé répond quel que soit le nom.
        */}
        <Routes><Route path=":slug" element={<PublicCatalog />} /></Routes>
      </Surface>
    </div>
  )
}
