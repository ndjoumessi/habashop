import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig, useFormatAmount, t, useAppStore } from '@/stores/appStore'
import { hydratePricesFromApi, dehydratePricesForApi } from '@/lib/productCurrency'
import { Search, Download, Plus, AlertTriangle, List, Gem, FolderOpen, Tag, Printer, Camera, Pencil, Package, X, Eye, Trash2, LayoutGrid, AlignJustify, ArrowLeftRight } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import StockTransfers from '@/components/stock/StockTransfers'
import ViewField from '@/components/ui/ViewField'
import toast from 'react-hot-toast'
import { exportCSV, openPDF, htmlTable, htmlKPIs, printProductLabels } from '@/utils/export'
import { productsApi, suppliersApi } from '@/lib/api'
import { confirm } from '@/lib/confirm'
import { announce } from '@/lib/announce'
import Pagination from '@/components/ui/Pagination'
import { usePagination } from '@/hooks/usePagination'

import StockInventory from '@/components/stock/StockInventory'
import StockModals from '@/components/stock/StockModals'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/skeleton'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import IconButton from '@/components/ui/IconButton'
import { type ProductItem, type StockForm, type CatForm, type LabelConfig, type Category, CATEGORIES_INIT, statusOf, stockCatLabel, stockCatDesc, isActivePromo } from '@/components/stock/stockShared'
import { normalizeBarcode, isValidBarcode, isAcceptableBarcode, barcodeMatches } from '@/lib/barcode'
import StockBackfill from '@/components/stock/StockBackfill'
import { saved } from '@/lib/saved'

export default function Stock() {
  const { stockLowThreshold, stockShowSKU, lang } = useConfig()
  const fmt = useFormatAmount()
  const currency = useAppStore(s => s.currency)
  const navigate = useNavigate()
  void lang // for t() reactivity

  const multiShop = useAuthStore(s => s.tenants.length > 1)
  const [activeTab, setActiveTab] = useState<'inventory' | 'transfers'>('inventory')
  const [products, setProducts] = useState<ProductItem[]>([])
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [cat, setCat]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [promoOnly, setPromoOnly] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [productEditMode, setProductEditMode] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [editingSku, setEditingSku] = useState<string | null>(null)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  /**
   * ── PHOTO PRODUIT ──
   * ⚠️ La photo COURANTE ne vit dans AUCUN état : elle se DÉRIVE de `products`.
   * La stocker en parallèle créerait un second endroit où elle diverge, et il
   * faudrait la poser à chaque ouverture de fiche — or `setEditingId` est appelé
   * depuis TROIS endroits, dont deux dans `StockInventory`. Un état de plus, c'est
   * un point d'appel de plus à oublier. Écrire dans `products` rafraîchit du même
   * geste la vignette de la grille.
   *
   * Seul le fichier EN ATTENTE a besoin d'un état : en création le produit n'a pas
   * encore d'identifiant, donc rien ne peut être envoyé.
   */
  const [photoEnAttente, setPhotoEnAttente] = useState<Blob | null>(null)
  const [modalTab, setModalTab] = useState<'general'|'prix'|'avance'>('general')
  const [form, setForm] = useState<StockForm>({
    sku: '', name: '', description: '', category: 'Céréales', unit: 'unité',
    buy: 0, sell: 0, priceWholesale: 0, priceSemiWholesale: 0,
    stock: 0, threshold: stockLowThreshold, supplier: '', supplierId: '',
    barcode: '', taxRate: 18, isActive: true,
    hasPromotion: false, promotionPrice: 0, promotionEnd: '',
    image: '📦', notes: '',
    priceTiers: [] as { minQty: number; price: number; label?: string }[],
  })
  const [categories, setCategories] = useState<Category[]>(CATEGORIES_INIT)
  const [showCatModal, setShowCatModal] = useState(false)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [stockView, setStockView] = useState<'grid'|'list'>('list')
  const [labelConfig, setLabelConfig] = useState<LabelConfig>({
    size: 'medium' as 'small' | 'medium' | 'large',
    showPrice: true, showSku: true, showBarcode: true, copies: 1,
    averyPreset: 'L7160' as 'L7160' | 'L7163' | 'L7165' | 'L7651' | 'CUSTOM',
  })
  const [selectedForLabel, setSelectedForLabel] = useState<string[]>([])
  // ── Sélection inline (multi-select dans la liste/grille produits)
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set())
  // Hide modal product-list when modal was opened from inline selection
  const [labelModalFromSelection, setLabelModalFromSelection] = useState(false)
  const toggleSelect = (sku: string) => {
    setSelectedSkus(prev => {
      const next = new Set(prev)
      if (next.has(sku)) next.delete(sku); else next.add(sku)
      return next
    })
  }
  const clearSelection = () => setSelectedSkus(new Set())
  const [editCat, setEditCat] = useState<typeof CATEGORIES_INIT[0] | null>(null)
  const [catForm, setCatForm] = useState<CatForm>({ name:'', color:'#818CF8', icon:'📦', description:'' })

  // ── Rattrapage codes-barres (PR5) : produits sans code valide.
  const [showBackfill, setShowBackfill] = useState(false)
  const [backfillSaving, setBackfillSaving] = useState(false)
  const missingBarcode = products.filter(p => !isValidBarcode(normalizeBarcode(p.barcode ?? '')))
  const saveBackfill = async (entries: { sku: string; barcode: string }[], print: boolean) => {
    setBackfillSaving(true)
    const savedSkus: string[] = []
    let echecs = 0
    for (const e of entries) {
      const prod = products.find(p => p.sku === e.sku)
      if (!prod?._id) continue
      // ⚠️ PAS `saved()` ICI, et c'est un choix : il affiche un toast PAR échec —
      // sur dix produits refusés, dix toasts empilés. On AGRÈGE et on le dit une
      // fois. `saved` rapporte, la DÉCISION reste à l'appelant : ici, compter.
      try { await productsApi.update(prod._id, { barcode: e.barcode }); savedSkus.push(e.sku) }
      catch { echecs++ }
    }
    const saved = new Set(savedSkus)
    setProducts(prev => prev.map(p => {
      const e = entries.find(x => x.sku === p.sku)
      return e && saved.has(p.sku) ? { ...p, barcode: e.barcode } : p
    }))
    setBackfillSaving(false)
    setShowBackfill(false)
    // ⚠️ « 5 codes enregistrés » sur 10 tentés se lit comme un succès complet. Un
    // compte partiel MUET est la famille de la troncature d'export : le nombre est
    // exact, et pourtant il trompe. Les échecs se disent, et ils ne se disent pas en vert.
    const libelleOk = `${savedSkus.length} ${lang === 'en' ? 'barcodes saved' : lang === 'es' ? 'códigos guardados' : lang === 'it' ? 'codici salvati' : 'codes enregistrés'}`
    if (echecs > 0) {
      toast.error(`${libelleOk} — ${echecs} ${lang === 'en' ? 'failed, please retry' : lang === 'es' ? 'fallaron, reintente' : lang === 'it' ? 'non riusciti, riprovi' : 'en échec, à réessayer'}`)
    } else {
      toast.success(libelleOk)
    }
    if (print && savedSkus.length) { setSelectedForLabel(savedSkus); setLabelModalFromSelection(true); setShowLabelModal(true) }
  }

  const cats     = ['', ...Array.from(new Set(products.map(p => p.category)))]
  const ruptures = products.filter(p => p.stock <= p.threshold)
  const totalValue = products.reduce((s, p) => s + p.stock * p.sell, 0)

  const promoCount = products.filter(p => isActivePromo(p)).length
  const filtered = products.filter(p => {
    const s = statusOf(p.stock, p.threshold)
    return (
      (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) || barcodeMatches(p.barcode, search)) &&
      (!cat || p.category === cat) &&
      (!statusFilter || s.label === statusFilter) &&
      (!promoOnly || isActivePromo(p))
    )
  })
  const pg = usePagination(filtered, 24)
  useEffect(() => { pg.reset() }, [search, cat, statusFilter, promoOnly])

  const resetForm = () => {
    setForm({ sku:'', name:'', description:'', category:'Céréales', unit:'unité', buy:0, sell:0, priceWholesale:0, priceSemiWholesale:0, stock:0, threshold:stockLowThreshold, supplier:'', supplierId:'', barcode:'', taxRate:18, isActive:true, hasPromotion:false, promotionPrice:0, promotionEnd:'', image:'📦', notes:'', priceTiers:[] })
    setModalTab('general')
    setEditingSku(null)
    setEditingId(null)
    // Sinon la photo choisie pour un produit abandonné partirait sur le suivant.
    setPhotoEnAttente(null)
  }

  useEffect(() => {
    Promise.all([productsApi.list(), suppliersApi.list().catch(() => [])])
      .then(([prods, sups]) => {
        setSuppliers(sups)
        const supMap = new Map(sups.map((s: any) => [s.id, s.name]))
        // ProductItem conserve les prix EN XOF (convention DB) — la conversion vers
        // la devise d'affichage est gérée par fmt()/useFormatAmount() à l'affichage.
        // La conversion XOF → display ne se fait QUE lors du chargement dans le form
        // d'édition (cf. StockInventory.tsx Eye onClick → hydratePricesFromApi).
        setProducts(prods.map((p: any): ProductItem => ({
          _id: p.id,
          sku: p.sku || p.id.slice(-8),
          name: `${p.emoji || '📦'} ${p.name}`,
          category: p.category || 'Épicerie',
          buy: p.buyPrice ?? 0,
          sell: p.sellPrice ?? 0,
          stock: p.stockQty ?? 0,
          threshold: p.stockMin ?? 5,
          supplier: supMap.get(p.supplierId) || '',
          supplierId: p.supplierId || '',
          barcode: p.barcode || '',
          description: p.description || '',
          notes: p.notes || '',
          priceWholesale: p.wholesalePrice ?? 0,
          priceSemiWholesale: p.semiWholesalePrice ?? 0,
          priceTiers: Array.isArray(p.priceTiers) ? p.priceTiers : [],
          photo: p.image ?? null,   // `image` côté API → `photo` côté domaine (cf. ProductItem)
          hasPromotion: p.hasPromotion ?? false,
          promotionPrice: p.promotionPrice ?? 0,
          promotionEnd: p.promotionEnd ? String(p.promotionEnd).split('T')[0] : '',
        })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = () => { resetForm(); setShowModal(true) }
    window.addEventListener('habashop:new-product', handler)
    return () => window.removeEventListener('habashop:new-product', handler)
  }, [])

  const saveProduct = async () => {
    // Garde code-barres : si rempli, doit être un EAN-13/EAN-8 (UPC-A canonicalisé).
    // Brique UNIQUE isAcceptableBarcode (plus de garde « 13 chiffres » locale — accepte EAN-8/UPC-A).
    if (!isAcceptableBarcode(form.barcode)) {
      toast.error(lang === 'en' ? 'Invalid barcode (EAN-13, EAN-8 or UPC-A expected)'
                : lang === 'es' ? 'Código de barras inválido (se espera EAN-13, EAN-8 o UPC-A)'
                : lang === 'it' ? 'Codice a barre non valido (atteso EAN-13, EAN-8 o UPC-A)'
                : 'Code-barres invalide (EAN-13, EAN-8 ou UPC-A attendu)')
      return
    }
    // Canonicalisation avant envoi/stockage (UPC-A→EAN-13, espaces retirés) → même
    // forme qu'en base et que la recherche (sinon un UPC-A saisi serait stocké 12 ch.).
    const canonicalBarcode = normalizeBarcode(form.barcode)
    const supplierName = suppliers.find(s => s.id === form.supplierId)?.name || ''
    // Conversion display currency (form state) → XOF (DB) sur tous les champs prix
    const dh = dehydratePricesForApi(form, currency)
    const apiBody = {
      name: form.name,
      emoji: form.image,
      category: form.category,
      buyPrice: dh.buyPrice,
      sellPrice: dh.sellPrice,
      stockQty: form.stock,
      stockMin: form.threshold,
      unit: form.unit,
      taxRate: form.taxRate,
      isActive: form.isActive,
      hasPromotion: form.hasPromotion,
      promotionPrice: dh.promotionPrice,
      // ⚠️ promotionEnd n'était JAMAIS envoyé → la « DATE FIN PROMO » était un champ mort
      // (une promo saisie ne pouvait pas expirer). Envoyé en ISO (minuit UTC) ou null.
      promotionEnd: form.hasPromotion && form.promotionEnd ? new Date(form.promotionEnd).toISOString() : null,
      barcode: canonicalBarcode || null,
      supplierId: form.supplierId || null,
      description: form.description || '',
      notes: form.notes || '',
      wholesalePrice: dh.wholesalePrice,
      semiWholesalePrice: dh.semiWholesalePrice,
      priceTiers: dh.priceTiers,
    }
    if (editingSku) {
      if (editingId) {
        // ⚠️ On REVIENT si le serveur refuse : ni état local muté, ni toast de succès,
        // et la modale RESTE OUVERTE (le `setShowModal(false)` est en fin de fonction)
        // pour que la saisie ne soit pas perdue. `saved` a déjà dit POURQUOI.
        const ok = await saved(
          productsApi.update(editingId, apiBody),
          lang === 'en' ? 'the product' : lang === 'es' ? 'el producto' : lang === 'it' ? 'il prodotto' : 'le produit',
        )
        if (!ok) return
      }
      // Local state ProductItem est en XOF (cohérence DB) — on stocke les valeurs déhydratées
      setProducts(prev => prev.map(p =>
        p.sku === editingSku ? {
          ...p,
          name: form.image + ' ' + form.name, category: form.category,
          buy: dh.buyPrice, sell: dh.sellPrice,
          priceWholesale: dh.wholesalePrice ?? 0,
          priceSemiWholesale: dh.semiWholesalePrice ?? 0,
          priceTiers: dh.priceTiers ?? [],
          stock: form.stock, threshold: form.threshold,
          supplier: supplierName, supplierId: form.supplierId,
          barcode: canonicalBarcode, description: form.description, notes: form.notes,
          hasPromotion: form.hasPromotion,
          promotionPrice: dh.promotionPrice ?? 0,
          promotionEnd: form.hasPromotion ? form.promotionEnd : '',
        } : p
      ))
      toast.success(`${form.name} mis à jour !`)
      announce(`${form.name} ${lang === 'en' ? 'updated' : lang === 'es' ? 'actualizado' : lang === 'it' ? 'aggiornato' : 'mis à jour'}`)
    } else {
      let apiId: string | undefined
      let createdSku = form.sku
      // ⚠️ Un refus (code-barres dupliqué en 409, quota, validation) affichait
      // « Produit ajouté ! » et poussait la ligne dans l'état local : le produit
      // semblait exister et disparaissait au prochain rechargement.
      const ok = await saved(
        productsApi.create(apiBody).then(created => { apiId = created.id; createdSku = created.sku || createdSku }),
        lang === 'en' ? 'the product' : lang === 'es' ? 'el producto' : lang === 'it' ? 'il prodotto' : 'le produit',
      )
      if (!ok) return
      /**
       * ⚠️ L'ENVOI DE LA PHOTO NE PEUT PAS AVOIR LIEU AVANT : la route est
       * `POST /api/products/:id/image` et l'identifiant n'existe qu'ici.
       *
       * ⚠️ ÉCHEC PARTIEL ASSUMÉ ET DIT. Le produit peut être créé et la photo
       * refusée (format, quota, stockage non configuré). `saved()` affiche déjà le
       * message DU SERVEUR ; le message de succès ci-dessous ne doit donc pas
       * affirmer le contraire — sinon c'est le toast de succès sur un enregistrement
       * qui n'a pas eu lieu, exactement le défaut que `saved()` existe pour fermer.
       */
      let photoUrl: string | null = null
      if (apiId && photoEnAttente) {
        await saved(
          productsApi.uploadImage(apiId, photoEnAttente).then(r => { photoUrl = r.image }),
          lang === 'en' ? 'the product photo' : lang === 'es' ? 'la foto del producto' : lang === 'it' ? 'la foto del prodotto' : 'la photo du produit',
        )
      }
      setProducts(prev => [...prev, {
        _id: apiId,
        sku: createdSku,
        photo: photoUrl,
        name: form.image + ' ' + form.name,
        category: form.category,
        buy: dh.buyPrice, sell: dh.sellPrice,
        priceWholesale: dh.wholesalePrice ?? 0,
        priceSemiWholesale: dh.semiWholesalePrice ?? 0,
        priceTiers: dh.priceTiers ?? [],
        stock: form.stock, threshold: form.threshold,
        supplier: supplierName, supplierId: form.supplierId,
        barcode: canonicalBarcode,
        description: form.description, notes: form.notes,
        hasPromotion: form.hasPromotion,
        promotionPrice: dh.promotionPrice ?? 0,
        promotionEnd: form.hasPromotion ? form.promotionEnd : '',
      }])
      toast.success(
        photoEnAttente && !photoUrl
          ? (lang === 'en' ? 'Product added — photo could not be uploaded.' : lang === 'es' ? 'Producto agregado — no se pudo enviar la foto.' : lang === 'it' ? 'Prodotto aggiunto — foto non inviata.' : "Produit ajouté — la photo n'a pas pu être envoyée.")
          : 'Produit ajouté !',
      )
      announce(lang === 'en' ? 'Product added' : lang === 'es' ? 'Producto agregado' : lang === 'it' ? 'Prodotto aggiunto' : 'Produit ajouté')
    }
    setShowModal(false)
    resetForm()
  }

  // Suppression produit — soft delete côté backend (deletedAt), restaurable par admin.
  // Confirmation obligatoire car le produit a possiblement un historique de ventes.
  const handleDeleteProduct = async (p: ProductItem) => {
    const ok = await confirm({
      title: lang === 'en' ? 'Delete product?'
           : lang === 'es' ? '¿Eliminar producto?'
           : lang === 'it' ? 'Eliminare il prodotto?'
           : 'Supprimer le produit ?',
      message: lang === 'en' ? `Permanently delete "${p.name}"? The product will be archived and will no longer appear in stock.`
             : lang === 'es' ? `¿Eliminar definitivamente "${p.name}"? El producto se archivará y ya no aparecerá en el stock.`
             : lang === 'it' ? `Eliminare definitivamente "${p.name}"? Il prodotto verrà archiviato e non apparirà più nello stock.`
             : `Supprimer définitivement « ${p.name} » ? Le produit sera archivé et n'apparaîtra plus dans le stock.`,
      confirmLabel: lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : lang === 'it' ? 'Elimina' : 'Supprimer',
      cancelLabel:  lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla'  : 'Annuler',
      danger: true,
    })
    if (!ok) return
    if (p._id) {
      try {
        await productsApi.delete(p._id)
      } catch {
        toast.error(lang === 'en' ? 'Delete failed — please retry'
                  : lang === 'es' ? 'Error al eliminar — reintenta'
                  : lang === 'it' ? 'Eliminazione fallita — riprova'
                  : 'Échec de la suppression — réessayer')
        return
      }
    }
    setProducts(prev => prev.filter(x => x.sku !== p.sku))
    toast.success(lang === 'en' ? `"${p.name}" deleted`
                : lang === 'es' ? `"${p.name}" eliminado`
                : lang === 'it' ? `"${p.name}" eliminato`
                : `« ${p.name} » supprimé`)
    announce(lang === 'en' ? 'Product deleted' : lang === 'es' ? 'Producto eliminado' : lang === 'it' ? 'Prodotto eliminato' : 'Produit supprimé')
  }

  return (
    <div className="space-y-5 animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav_stock')}</h1>
          <p className="page-subtitle">{products.length} {lang === 'en' ? 'items in catalog' : lang === 'es' ? 'artículos en catálogo' : lang === 'it' ? 'articoli in catalogo' : 'articles en catalogue'}</p>
        </div>
        <button className="topbar-btn" onClick={() => { setEditingSku(null); setEditingId(null); setProductEditMode(true); setShowModal(true) }}>
          <Plus size={14} /> {lang === 'en' ? 'New product' : lang === 'es' ? 'Nuevo producto' : lang === 'it' ? 'Nuovo prodotto' : 'Nouveau produit'}
        </button>
      </div>

      {/* Onglets (Inventaire / Transferts) — Transferts visible uniquement si multi-boutiques */}
      {multiShop && (
        <div role="tablist" aria-label={t('nav_stock')} style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
          {([
            { key: 'inventory'  as const, icon: <List size={15} />,           label: lang === 'en' ? 'Inventory' : lang === 'es' ? 'Inventario' : lang === 'it' ? 'Inventario' : 'Inventaire' },
            { key: 'transfers'  as const, icon: <ArrowLeftRight size={15} />, label: lang === 'en' ? 'Transfers' : lang === 'es' ? 'Transferencias' : lang === 'it' ? 'Trasferimenti' : 'Transferts' },
          ]).map(tab => (
            <button key={tab.key} role="tab" aria-selected={activeTab === tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', border: 'none', background: 'none',
                cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)',
                color: activeTab === tab.key ? 'var(--p2)' : 'var(--text3)',
                borderBottom: `2px solid ${activeTab === tab.key ? 'var(--p)' : 'transparent'}`, marginBottom: -1,
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      )}

      {multiShop && activeTab === 'transfers' && <StockTransfers />}

      {(!multiShop || activeTab === 'inventory') && (<>
      {/* Alert rupture */}
      {ruptures.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: 'var(--danger)' }}>
              {ruptures.length} {lang === 'en' ? `item${ruptures.length > 1 ? 's' : ''} out of stock or low` : lang === 'es' ? `artículo${ruptures.length > 1 ? 's' : ''} sin stock o bajo` : lang === 'it' ? `articol${ruptures.length > 1 ? 'i' : 'o'} esaurit${ruptures.length > 1 ? 'i' : 'o'} o in esaurimento` : `article${ruptures.length > 1 ? 's' : ''} en rupture ou stock faible`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
              {ruptures.map(p => p.name).join(' · ')}
            </p>
          </div>
          <button className="btn btn-sm"
            style={{ background: 'var(--c-purple-bg)', color: 'var(--p3)', border: '1px solid var(--c-purple-border)' }}
            onClick={() => toast(lang === 'en' ? 'Bulk purchase order created' : lang === 'es' ? 'Pedido agrupado creado' : lang === 'it' ? 'Ordine raggruppato creato' : 'Bon de commande groupé créé')}>
            {lang === 'en' ? 'Order' : lang === 'es' ? 'Pedir' : lang === 'it' ? 'Ordina' : 'Commander'}
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          // `hex` = HEX LITTÉRAL obligatoire : il est concaténé avec une alpha (`${k.hex}28`,
          // `${k.hex}18`…) pour teinter bord/dégradé/halo. Un `var(--x)` s'y casse en silence
          // (`var(--p)28` = couleur invalide → border-style:none, dégradé absent — invisible à
          // tsc et aux tests). NE PAS re-tokeniser. `color` reste un token (usage direct, valide).
          { label: t('stock_total'),      value: products.length.toString(),         color: 'var(--p2)',    hex: '#6C47FF', icon: <List          size={18} /> },
          { label: t('stock_value'),      value: fmt(totalValue),                    color: 'var(--acc2)', hex: '#22C77A', icon: <Gem           size={18} /> },
          { label: t('stock_ruptures'),   value: ruptures.length.toString(),         color: 'var(--danger)',hex: '#FF5C72', icon: <AlertTriangle size={18} /> },
          { label: t('stock_categories'), value: String(new Set(products.map(p => p.category)).size), color: 'var(--acc)', hex: '#FFB020', icon: <FolderOpen size={18} /> },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{
            background: `linear-gradient(135deg,${k.hex}18,${k.hex}06)`,
            border: `1px solid ${k.hex}28`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle,${k.hex}25 0%,transparent 70%)`, pointerEvents:'none' }} />
            <div className="kpi-icon-w" style={{ color: k.color, background: `${k.hex}20` }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Panel inventaire */}
      {loading ? (
        /* Chargement initial : skeletons (la table était vide-muette pendant le fetch) */
        <div className="panel" style={{ padding: 16 }}>
          <Skeleton height={42} count={8} radius={10} />
        </div>
      ) : products.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<Package size={40} strokeWidth={1.5} style={{ color: 'var(--text3)' }} />}
            title={lang === 'en' ? 'No products in stock' : lang === 'es' ? 'Sin productos en stock' : lang === 'it' ? 'Nessun prodotto in stock' : 'Aucun produit en stock'}
            message={lang === 'en' ? 'Add your first products to start managing your inventory.' : lang === 'es' ? 'Agregue sus primeros productos para empezar a gestionar su inventario.' : lang === 'it' ? 'Aggiungi i tuoi primi prodotti per iniziare a gestire l\'inventario.' : 'Ajoutez vos premiers produits pour commencer à gérer votre inventaire.'}
            action={{ label: lang === 'en' ? '+ Add a product' : lang === 'es' ? '+ Agregar un producto' : lang === 'it' ? '+ Aggiungi un prodotto' : '+ Ajouter un produit', onClick: () => { resetForm(); setShowModal(true) } }}
          />
        </div>
      ) : (
      <StockInventory
        products={products}
        fmt={fmt} lang={lang} stockShowSKU={stockShowSKU}
        navigate={navigate}
        stockView={stockView} setStockView={setStockView}
        search={search} setSearch={setSearch}
        cat={cat} setCat={setCat} cats={cats}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        promoOnly={promoOnly} setPromoOnly={setPromoOnly} promoCount={promoCount}
        pg={pg}
        setSelectedForLabel={setSelectedForLabel} setShowLabelModal={setShowLabelModal}
        setProductEditMode={setProductEditMode} setShowModal={setShowModal}
        setForm={setForm} setEditingSku={setEditingSku} setEditingId={setEditingId}
        setModalTab={setModalTab}
        onDeleteProduct={handleDeleteProduct}
        selectedSkus={selectedSkus}
        onToggleSelect={toggleSelect}
        onSelectAllVisible={() => setSelectedSkus(new Set([...selectedSkus, ...pg.paginated.map((p: ProductItem) => p.sku)]))}
        onClearSelection={clearSelection}
        missingBarcodeCount={missingBarcode.length}
        onOpenBackfill={() => setShowBackfill(true)}
      />
      )}

      {showBackfill && (
        <StockBackfill
          products={missingBarcode}
          lang={lang}
          onClose={() => setShowBackfill(false)}
          onSave={saveBackfill}
          saving={backfillSaving}
        />
      )}

      {/* ── ACTION BAR : visible quand >= 1 produit sélectionné ── */}
      {selectedSkus.size > 0 && (
        <div role="toolbar"
          aria-label={lang === 'en' ? 'Selection actions' : lang === 'es' ? 'Acciones de selección' : lang === 'it' ? 'Azioni di selezione' : 'Actions de sélection'}
          style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 100, display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 18px', borderRadius: 12,
            background: 'var(--card2, var(--card))', border: '1.5px solid var(--p)',
            boxShadow: '0 12px 32px rgba(0,0,0,.35)',
            fontFamily: 'var(--font)',
            animation: 'habashop-slide-up .18s ease-out',
            maxWidth: 'calc(100% - 40px)',
          }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
            {selectedSkus.size} {lang === 'en' ? `product${selectedSkus.size > 1 ? 's' : ''} selected` : lang === 'es' ? `producto${selectedSkus.size > 1 ? 's' : ''} seleccionado${selectedSkus.size > 1 ? 's' : ''}` : lang === 'it' ? `prodott${selectedSkus.size > 1 ? 'i' : 'o'} selezionat${selectedSkus.size > 1 ? 'i' : 'o'}` : `produit${selectedSkus.size > 1 ? 's' : ''} sélectionné${selectedSkus.size > 1 ? 's' : ''}`}
          </span>
          <button
            onClick={() => {
              setSelectedForLabel(Array.from(selectedSkus))
              setLabelModalFromSelection(true)
              setShowLabelModal(true)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: 'linear-gradient(135deg, var(--p), var(--p2))',
              border: 'none', color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(91,78,232,.4)',
            }}>
            <Printer size={14} /> {lang === 'en' ? 'Print labels' : lang === 'es' ? 'Imprimir etiquetas' : lang === 'it' ? 'Stampa etichette' : 'Imprimer les étiquettes'}
          </button>
          <button
            onClick={clearSelection}
            style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'transparent', border: 'none',
              color: 'var(--text3)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-regular)',
              cursor: 'pointer', fontFamily: 'inherit',
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
            {lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}
          </button>
          <style>{`@keyframes habashop-slide-up { from { transform: translate(-50%, 20px); opacity: 0 } to { transform: translate(-50%, 0); opacity: 1 } }`}</style>
        </div>
      )}

      {/* ── Panel Catégories ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Tag size={14} /> {lang === 'en' ? 'Manage categories' : lang === 'es' ? 'Gestionar categorías' : lang === 'it' ? 'Gestisci categorie' : 'Gestion des catégories'}</span>
          <button className="topbar-btn" onClick={() => { setEditCat(null); setCatForm({ name:'', color:'#818CF8', icon:'📦', description:'' }); setShowCatModal(true) }}>
            + {lang === 'en' ? 'New category' : lang === 'es' ? 'Nueva categoría' : lang === 'it' ? 'Nuova categoria' : 'Nouvelle catégorie'}
          </button>
        </div>
        <ResponsiveGrid min={220}>
          {[...categories].sort((a, b) => b.productsCount - a.productsCount).map(cat => (
            <div key={cat.id} style={{
              background:'var(--bg3)', border:'1px solid var(--border)',
              borderRadius:12, padding:16, borderLeft:`4px solid ${cat.color}`,
              display:'flex', flexDirection:'column', gap:8, transition:'all .2s',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = `0 6px 20px ${cat.color}33` }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = 'none' }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:`${cat.color}22`, border:`1px solid ${cat.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'var(--fs-lg)' }}>{cat.icon}</div>
                  <div>
                    <div style={{ fontSize:'var(--fs-body)', fontWeight:'var(--fw-semibold)', color:'var(--text)' }}>{stockCatLabel(cat.name, lang)}</div>
                    <div style={{ fontSize:'var(--fs-caption)', color:'var(--text3)' }}>{cat.productsCount} {lang === 'en' ? 'products' : lang === 'es' ? 'productos' : lang === 'it' ? 'prodotti' : 'produits'}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <IconButton
                    label={lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'}
                    icon={<Pencil size={14} />}
                    onClick={() => { setEditCat(cat); setCatForm({ name:cat.name, color:cat.color, icon:cat.icon, description:cat.description }); setShowCatModal(true) }}
                  />
                  <IconButton
                    label={lang === 'en' ? 'Delete' : lang === 'es' ? 'Eliminar' : lang === 'it' ? 'Elimina' : 'Supprimer'}
                    icon={<Trash2 size={14} />}
                    danger
                    onClick={() => {
                      if (cat.productsCount > 0) { toast.error(lang === 'en' ? 'Category not empty!' : lang === 'es' ? '¡Categoría no vacía!' : lang === 'it' ? 'Categoria non vuota!' : 'Catégorie non vide !'); return }
                      setCategories(prev => prev.filter(c => c.id !== cat.id))
                      toast.success(lang === 'en' ? 'Category deleted' : lang === 'es' ? 'Categoría eliminada' : lang === 'it' ? 'Categoria eliminata' : 'Catégorie supprimée')
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize:'var(--fs-label)', color:'var(--text2)' }}>{stockCatDesc(cat.description, lang)}</div>
              <div style={{ height:4, background:'var(--bg4)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, width:`${Math.min(100,(cat.productsCount/10)*100)}%`, background:cat.color, transition:'width .3s' }} />
              </div>
            </div>
          ))}
        </ResponsiveGrid>
      </div>
      </>)}
      <StockModals
        showModal={showModal} setShowModal={setShowModal}
        resetForm={resetForm}
        editingSku={editingSku}
        editingId={editingId}
        photo={editingId ? (products.find(p => p._id === editingId)?.photo ?? null) : null}
        setPhoto={url => setProducts(prev => prev.map(p => p._id === editingId ? { ...p, photo: url } : p))}
        setPhotoEnAttente={setPhotoEnAttente}
        form={form} setForm={setForm}
        productEditMode={productEditMode} setProductEditMode={setProductEditMode}
        modalTab={modalTab} setModalTab={setModalTab}
        categories={categories} setCategories={setCategories}
        showScanner={showScanner} setShowScanner={setShowScanner}
        fmt={fmt} products={products} saveProduct={saveProduct}
        showCatModal={showCatModal} setShowCatModal={setShowCatModal}
        editCat={editCat} catForm={catForm} setCatForm={setCatForm}
        showLabelModal={showLabelModal} setShowLabelModal={(b: boolean) => { setShowLabelModal(b); if (!b) setLabelModalFromSelection(false) }}
        lang={lang} labelConfig={labelConfig} setLabelConfig={setLabelConfig}
        selectedForLabel={selectedForLabel} setSelectedForLabel={setSelectedForLabel}
        suppliers={suppliers}
        hideProductSelection={labelModalFromSelection}
        onOpenBackfill={() => { setShowLabelModal(false); setShowBackfill(true) }}
      />
    </div>
  )
}
