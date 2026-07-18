import { lazy, Suspense, useState, useMemo, useEffect, useRef, type CSSProperties } from 'react'
import { X, Eye, Pencil, Camera, Tag, Printer, Wand2, Search, Copy, Check, Trash2, AlertTriangle } from 'lucide-react'
import JsBarcode from 'jsbarcode'
import toast from 'react-hot-toast'
import { t, useAppStore, formatInCurrency } from '@/stores/appStore'
import { printProductLabels } from '@/utils/export'
import { printThermalLabels } from '@/utils/thermalLabel'
import ViewField from '@/components/ui/ViewField'
import ResponsiveGrid from '@/components/ui/ResponsiveGrid'
import { type ProductItem, stockCatLabel } from '@/components/stock/stockShared'
import { lookupProductByEan } from '@/lib/productLookup'
import { useModalFocus } from '@/hooks/useModalFocus'
import { normalizeBarcode, isValidBarcode, barcodeFormat, generateEAN13, quietZonePx } from '@/lib/barcode'
// Chargé à la demande (114 kB gz / @zxing) — uniquement à l'ouverture du scanner
const BarcodeScanner = lazy(() => import('@/components/ui/BarcodeScanner'))

interface StockModalsProps {
  showModal: boolean; setShowModal: (b: boolean) => void
  resetForm: () => void
  editingSku: string | null
  form: any; setForm: (v: any) => void
  productEditMode: boolean; setProductEditMode: (b: boolean) => void
  modalTab: 'general' | 'prix' | 'avance'; setModalTab: (v: any) => void
  categories: any[]; setCategories: (v: any) => void
  showScanner: boolean; setShowScanner: (b: boolean) => void
  fmt: (n: number) => string
  products: ProductItem[]
  saveProduct: () => void
  showCatModal: boolean; setShowCatModal: (b: boolean) => void
  editCat: any
  catForm: any; setCatForm: (v: any) => void
  showLabelModal: boolean; setShowLabelModal: (b: boolean) => void
  lang: string
  labelConfig: any; setLabelConfig: (v: any) => void
  selectedForLabel: string[]; setSelectedForLabel: (v: any) => void
  suppliers: { id: string; name: string }[]
  hideProductSelection?: boolean
  onOpenBackfill?: () => void
}

// Vignette code-barres = UNE seule surface blanche « étiquette » (barres sombres
// obligatoires pour la lisibilité scanner), cliquable pour copier le code.
// ⚠️ QUIET ZONES : les marges horizontales du SVG (marginLeft/Right) portent le
// silence latéral EAN-13 (≥10 modules = 10×1.8 ≈ 18 px) — BAKÉES dans le SVG donc
// jamais rognées par le CSS. NE PAS RÉDUIRE. Le blanc vertical est décoratif → resserré.
// Surface blanche intentionnelle (comme le code lui-même) → couleurs internes FIXES
// (gris neutres), pas de token thème qui serait illisible sur blanc en mode sombre.
export function BarcodeVignette({ value, lang }: { value: string; lang: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [copied, setCopied] = useState(false)
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const canonical = normalizeBarcode(value)            // UPC-A → EAN-13
  const format = barcodeFormat(canonical)              // 'EAN13' | 'EAN8' | null
  useEffect(() => {
    if (svgRef.current && format) {
      try {
        JsBarcode(svgRef.current, canonical, {
          format,
          width: 1.8,
          height: 46,
          displayValue: true,      // chiffres (groupement EAN-13 standard) sous les barres
          font: 'monospace',       // chasse fixe (proche OCR-B)
          fontOptions: 'bold',
          fontSize: 13,
          textMargin: 3,
          marginTop: 2, marginBottom: 0,   // blanc vertical resserré (décoratif)
          marginLeft: quietZonePx(1.8), marginRight: quietZonePx(1.8), // ⚠️ QUIET ZONES 11 modules (source unique) — NE PAS RÉDUIRE
          background: '#FFFFFF',
          lineColor: '#000000',
        })
      } catch {}
    }
  }, [canonical, format])
  if (!format) return null
  const copy = () => {
    navigator.clipboard.writeText(canonical)
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600) })
      .catch(() => {})
  }
  return (
    <button type="button" onClick={copy}
      aria-label={`${i('Copier le code-barres', 'Copy the barcode', 'Copiar el código de barras', 'Copia il codice a barre')} ${canonical}`}
      style={{
        position: 'relative', display: 'block', width: '100%', minHeight: 44, cursor: 'pointer',
        background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--sh-sm)',
        padding: '8px 14px 6px', fontFamily: 'var(--font)', transition: 'box-shadow .15s',
      }}>
      {/* Badge format détecté (surface blanche → gris fixe discret) */}
      <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 10, fontWeight: 'var(--fw-semibold)', letterSpacing: '.4px', color: '#9CA3AF' }}>
        {format === 'EAN8' ? 'EAN-8' : 'EAN-13'}
      </span>
      <svg ref={svgRef} style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }} />
      {/* Affordance copie — chiffres NON répétés (déjà sous les barres) */}
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 2, fontSize: 11, fontWeight: 'var(--fw-semibold)', color: copied ? '#059669' : '#6B7280' }}>
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? i('Copié', 'Copied', 'Copiado', 'Copiato') : i('Copier', 'Copy', 'Copiar', 'Copia')}
      </span>
    </button>
  )
}

export default function StockModals({ showModal, setShowModal, resetForm, editingSku, form, setForm, productEditMode, setProductEditMode, modalTab, setModalTab, categories, setCategories, showScanner, setShowScanner, fmt, products, saveProduct, showCatModal, setShowCatModal, editCat, catForm, setCatForm, showLabelModal, setShowLabelModal, lang, labelConfig, setLabelConfig, selectedForLabel, setSelectedForLabel, suppliers, hideProductSelection, onOpenBackfill }: StockModalsProps) {
  const [supSearch, setSupSearch] = useState('')
  const [supOpen, setSupOpen] = useState(false)
  // Pièges à focus des 3 modales (focus initial + Tab bouclé + restauration)
  const productBoxRef = useModalFocus<HTMLDivElement>(showModal)
  const catBoxRef     = useModalFocus<HTMLDivElement>(showCatModal)
  const labelBoxRef   = useModalFocus<HTMLDivElement>(showLabelModal)
  const filteredSuppliers = useMemo(() => {
    const q = supSearch.trim().toLowerCase()
    return q ? suppliers.filter(s => s.name.toLowerCase().includes(q)) : suppliers
  }, [suppliers, supSearch])
  const selectedSupplierName = suppliers.find(s => s.id === form.supplierId)?.name || ''
  // Valide si canonicalisé (UPC-A→EAN-13) c'est un EAN-13 ou EAN-8 conforme.
  const barcodeInvalid = !!form.barcode && !isValidBarcode(normalizeBarcode(form.barcode))
  const tenant = useAppStore(s => s.tenant)
  const currency = useAppStore(s => s.currency)
  // Format direct sans conversion (form state = devise d'affichage, pas XOF)
  const fmtForm = (n: number) => formatInCurrency(n, currency)
  const emptyLabel = lang === 'en' ? 'Not specified' : lang === 'es' ? 'No especificado' : lang === 'it' ? 'Non specificato' : 'Non renseigné'
  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  // Code-barres manquant (vide) OU non valide → bandeau warning « scanner l'emballage ».
  // Disparaît dès qu'un code valide (EAN-13/EAN-8, UPC-A canonicalisé) est renseigné.
  const eanMissing = !isValidBarcode(normalizeBarcode(form.barcode ?? ''))
  // `onActivate` fourni (mode visualisation) → l'alerte devient un BOUTON : un clic
  // bascule en édition ET ouvre le scanner (le hint ne suggère plus un geste
  // indisponible sur l'écran). Sans onActivate (mode édition) → simple bandeau, le
  // bouton Scanner étant déjà à côté.
  const renderEanWarning = (onActivate?: () => void) => {
    if (!eanMissing) return null
    const baseStyle: CSSProperties = { marginTop:8, display:'flex', alignItems:'center', gap:8, background:'color-mix(in srgb, var(--warn) 10%, transparent)', border:'1px solid color-mix(in srgb, var(--warn) 30%, transparent)', borderRadius:6, padding:'8px 10px', fontSize:12, color:'var(--warn)' }
    const label = i("Aucun code-barres — scannez l'emballage pour l'ajouter", 'No barcode — scan the packaging to add it', 'Sin código de barras — escanea el envase para añadirlo', 'Nessun codice a barre — scansiona la confezione per aggiungerlo')
    if (!onActivate) {
      return (
        <div style={baseStyle}>
          <AlertTriangle size={15} style={{ color:'var(--warn)', flexShrink:0 }} />
          <span>{label}</span>
        </div>
      )
    }
    return (
      <button type="button" onClick={onActivate}
        aria-label={i("Ajouter un code-barres en scannant l'emballage", 'Add a barcode by scanning the packaging', 'Añadir un código escaneando el envase', 'Aggiungi un codice scansionando la confezione')}
        style={{ ...baseStyle, width:'100%', cursor:'pointer', fontFamily:'var(--font)', textAlign:'left' }}>
        <AlertTriangle size={15} style={{ color:'var(--warn)', flexShrink:0 }} />
        <span style={{ flex:1 }}>{label}</span>
        <Camera size={15} style={{ color:'var(--warn)', flexShrink:0 }} />
      </button>
    )
  }

  // ── Auto-remplissage Open Food Facts (frontend, sans clé) ──────────────────
  const UNIT_OPTIONS = ['unité', 'kg', 'g', 'litre', 'ml', 'carton', 'sac', 'boîte', 'palette', 'douzaine']
  const [offLooking, setOffLooking] = useState(false)
  const [offFilled, setOffFilled] = useState<string[]>([]) // champs pré-remplis (badge)
  const lastEanLookedUp = useRef('')
  // Pré-remplit (jamais de sauvegarde auto ; tout reste éditable). Seulement en AJOUT
  // (pas en édition d'un produit existant, pour ne pas écraser des données saisies).
  async function runOffLookup(rawEan: string) {
    if (editingSku) return
    // Canonicalise (UPC-A→EAN-13) puis déclenche pour tout code valide EAN-13/EAN-8
    // (avant : garde « 13 chiffres » locale → l'auto-remplissage ratait EAN-8/UPC-A).
    const ean = normalizeBarcode(rawEan)
    if (!isValidBarcode(ean) || ean === lastEanLookedUp.current) return
    lastEanLookedUp.current = ean
    setOffLooking(true)
    try {
      const r = await lookupProductByEan(ean)
      if (r.found) {
        const data = r.data
        const filled: string[] = []
        setForm((f: any) => {
          const next = { ...f }
          if (data.name) {
            // Pas de champ "marque" dédié → on l'accole au nom si absent.
            let nm = data.name
            if (data.brand && !nm.toLowerCase().includes(data.brand.toLowerCase())) nm = `${nm} ${data.brand}`
            next.name = nm; filled.push('name')
          }
          // Catégorie/unité = <select> à options fixes → on n'applique que si ça matche une option.
          if (data.category) {
            const match = categories.find((c: any) => String(c.name).toLowerCase() === data.category!.toLowerCase())
            if (match) { next.category = match.name; filled.push('category') }
          }
          if (data.unit && UNIT_OPTIONS.includes(data.unit)) { next.unit = data.unit; filled.push('unit') }
          return next
        })
        setOffFilled(filled)
        toast.success(i('Produit trouvé — champs pré-remplis', 'Product found — fields pre-filled', 'Producto encontrado — campos rellenados', 'Prodotto trovato — campi precompilati'))
      } else {
        if (r.reason === 'network') toast.error(i('Impossible de contacter la base produits', 'Could not reach the product database', 'No se pudo contactar la base de productos', 'Impossibile contattare il database prodotti'))
        else toast(i('Produit introuvable dans la base, saisie manuelle', 'Product not found in the database, manual entry', 'Producto no encontrado, entrada manual', 'Prodotto non trovato, inserimento manuale'))
        setOffFilled([])
      }
    } finally {
      setOffLooking(false)
    }
  }
  return (
    <>
      {/* ── Modal produit enrichi ── */}
      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true"
          aria-label={editingSku ? (form.name || editingSku) : i('Nouveau produit', 'New product', 'Nuevo producto', 'Nuovo prodotto')}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div ref={productBoxRef} className="modal-box" style={{ maxWidth:560, maxHeight:'90vh', display:'flex', flexDirection:'column', padding:0, overflow:'hidden' }}>
            {/* Fixed header */}
            <div className="flex items-center justify-between" style={{ padding:'20px 24px 0', flexShrink:0 }}>
              <h3 className="text-base font-bold" style={{ color:'var(--text)' }}>
                {editingSku ? (form.name || editingSku) : i('Nouveau produit', 'New product', 'Nuevo producto', 'Nuovo prodotto')}
              </h3>
              <button aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} className="btn btn-ghost btn-sm" onClick={() => { setShowModal(false); resetForm() }}><X size={14} /></button>
            </div>

            {/* Mode banner (edit only, not for new products) */}
            {editingSku && (
              <div style={{ padding:'0 24px', flexShrink:0, marginTop:12 }}>
                {!productEditMode
                  ? <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:'rgba(0,184,255,.07)', border:'1px solid rgba(0,184,255,.18)', borderRadius:10 }}>
                      <Eye size={13} />
                      <span style={{ fontSize:12, color:'var(--acc3)', fontWeight:'var(--fw-regular)' }}>{lang === 'en' ? 'View mode — click Edit to make changes' : lang === 'es' ? 'Modo visualización — haz clic en Editar para modificar' : lang === 'it' ? 'Modalità visualizzazione — clicca su Modifica per modificare' : 'Mode visualisation — cliquez sur Modifier pour éditer'}</span>
                    </div>
                  : <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.22)', borderRadius:10 }}>
                      <Pencil size={13} />
                      <span style={{ fontSize:12, color:'var(--warn)', fontWeight:'var(--fw-regular)' }}>{lang === 'en' ? 'Edit mode — unsaved changes' : lang === 'es' ? 'Modo edición — cambios sin guardar' : lang === 'it' ? 'Modalità modifica — modifiche non salvate' : 'Mode édition — modifications non sauvegardées'}</span>
                    </div>
                }
              </div>
            )}

            {/* Fixed tabs */}
            <div style={{ padding:'16px 24px 0', flexShrink:0 }}>
              <div style={{ display:'flex', gap:4, background:'var(--bg3)', borderRadius:10, padding:4 }}>
                {([
                  { id:'general', label: i('Général', 'General', 'General', 'Generale') },
                  { id:'prix',    label: i('Prix & Stock', 'Price & Stock', 'Precio & Stock', 'Prezzo & Stock') },
                  { id:'avance',  label: i('Avancé', 'Advanced', 'Avanzado', 'Avanzato') },
                ] as { id:'general'|'prix'|'avance'; label:string }[]).map(tb => (
                  <button key={tb.id} onClick={() => setModalTab(tb.id)} aria-pressed={modalTab === tb.id} style={{
                    flex:1, padding:'8px 12px', borderRadius:8, fontSize:12, fontWeight:'var(--fw-semibold)',
                    cursor:'pointer', fontFamily:'var(--font)', border:'none', transition:'all .15s',
                    background: modalTab === tb.id ? 'var(--p)' : 'transparent',
                    color: modalTab === tb.id ? '#fff' : 'var(--text2)',
                    boxShadow: modalTab === tb.id ? 'var(--sh-xs)' : 'none',
                  }}>{tb.label}</button>
                ))}
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 24px 0' }}>

            {/* ── Onglet Général ── */}
            {modalTab === 'general' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* ── IMAGE ── */}
                {productEditMode && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>IMAGE</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:8 }}>
                      {['🌾','🫙','🍚','🧼','🥛','🍅','🫒','☕','🐟','🧃','🍬','🧴','🫧','📦'].map(em => (
                        <button key={em} type="button" aria-label={`${i("Choisir l'image", 'Choose image', 'Elegir imagen', 'Scegli immagine')} ${em}`} aria-pressed={form.image === em} onClick={() => setForm(f => ({...f, image:em}))} style={{
                          width:40, height:40, borderRadius:10, fontSize:20,
                          background: form.image === em ? 'rgba(91,78,232,.2)' : 'var(--bg3)',
                          border:`1.5px solid ${form.image === em ? 'var(--p2)' : 'var(--border)'}`,
                          cursor:'pointer', transition:'all .15s',
                        }}>{em}</button>
                      ))}
                    </div>
                    <input className="input text-sm" placeholder={lang === 'en' ? 'Or type a custom emoji...' : lang === 'es' ? 'O escribe un emoji personalizado...' : lang === 'it' ? 'O digita un emoji personalizzato...' : 'Ou tapez un emoji personnalisé...'}
                      value={form.image} onChange={e => setForm(f => ({...f, image:e.target.value}))}
                      style={{ fontSize:18, width:220 }} />
                  </div>
                )}

                {/* ── NOM PRODUIT — pleine largeur ── */}
                <ViewField label={lang === 'en' ? 'Product name *' : lang === 'es' ? 'Nombre del producto *' : lang === 'it' ? 'Nome prodotto *' : 'Nom du produit *'} value={`${form.image} ${form.name}`} editing={productEditMode} emptyLabel={emptyLabel}>
                  <input className="input" placeholder={lang === 'en' ? 'Ex: Fragrant rice 5kg' : lang === 'es' ? 'Ej: Arroz aromático 5kg' : lang === 'it' ? 'Es: Riso profumato 5kg' : 'Ex: Riz parfumé 5kg'}
                    value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))}
                    style={{ width:'100%', fontSize:15, fontWeight:'var(--fw-regular)' }}
                    autoFocus />
                </ViewField>

                {/* ── SKU + Catégorie ── */}
                <div className="grid grid-cols-2 gap-3">
                  <ViewField label="SKU" value={form.sku||'—'} editing={productEditMode} emptyLabel={emptyLabel}>
                    <input
                      className="input text-sm"
                      readOnly
                      value={form.sku}
                      placeholder={lang === 'en' ? 'Auto-generated' : lang === 'es' ? 'Auto-generado' : lang === 'it' ? 'Auto-generato' : 'Auto-généré'}
                      style={{ cursor: 'default', opacity: 0.6 }}
                      title={lang === 'en' ? 'SKU is generated automatically on save' : lang === 'es' ? 'El SKU se genera automáticamente al guardar' : lang === 'it' ? 'Lo SKU viene generato automaticamente al salvataggio' : 'Le SKU est généré automatiquement à l\'enregistrement'}
                    />
                  </ViewField>
                  <ViewField label={lang === 'en' ? 'Category' : lang === 'es' ? 'Categoría' : lang === 'it' ? 'Categoria' : 'Catégorie'} value={stockCatLabel(form.category, lang)} editing={productEditMode} emptyLabel={emptyLabel}>
                    <select className="input text-sm" value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))}>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {stockCatLabel(c.name, lang)}</option>)}
                    </select>
                  </ViewField>
                </div>

                {/* ── Unité + Fournisseur ── */}
                <div className="grid grid-cols-2 gap-3">
                  <ViewField label={i('Unité', 'Unit', 'Unidad', 'Unità')} value={form.unit} editing={productEditMode} emptyLabel={emptyLabel}>
                    <select className="input text-sm" value={form.unit} onChange={e => setForm(f => ({...f, unit:e.target.value}))}>
                      {['unité','kg','g','litre','ml','carton','sac','boîte','palette','douzaine'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </ViewField>
                  <ViewField label={i('Fournisseur', 'Supplier', 'Proveedor', 'Fornitore')} value={selectedSupplierName || '—'} editing={productEditMode} emptyLabel={emptyLabel}>
                    <div style={{ position:'relative' }}>
                      <div style={{ position:'relative' }}>
                        <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }} />
                        <input
                          className="input text-sm"
                          style={{ paddingLeft:30, width:'100%' }}
                          placeholder={selectedSupplierName || (lang === 'en' ? 'Search a supplier...' : lang === 'es' ? 'Buscar un proveedor...' : lang === 'it' ? 'Cerca un fornitore...' : 'Rechercher un fournisseur...')}
                          aria-expanded={supOpen}
                          aria-haspopup="listbox"
                          aria-label={lang === 'en' ? 'Search a supplier' : lang === 'es' ? 'Buscar un proveedor' : lang === 'it' ? 'Cerca un fornitore' : 'Rechercher un fournisseur'}
                          value={supOpen ? supSearch : selectedSupplierName}
                          onFocus={() => { setSupOpen(true); setSupSearch('') }}
                          onBlur={() => setTimeout(() => setSupOpen(false), 150)}
                          onChange={e => { setSupSearch(e.target.value); setSupOpen(true) }}
                        />
                      </div>
                      {supOpen && (
                        <div role="listbox" style={{
                          position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:10,
                          background:'var(--card)', border:'1px solid var(--border)', borderRadius:8,
                          maxHeight:200, overflowY:'auto', boxShadow:'var(--sh-md)',
                        }}>
                          <button type="button" role="option" aria-selected={!form.supplierId} onMouseDown={() => { setForm(f => ({...f, supplierId:'', supplier:''})); setSupOpen(false) }} style={{
                            width:'100%', textAlign:'left', padding:'8px 12px', background:'transparent', border:'none',
                            borderBottom:'1px solid var(--border)', cursor:'pointer', fontSize:12, color:'var(--text3)', fontStyle:'italic',
                          }}>
                            {lang === 'en' ? 'No supplier' : lang === 'es' ? 'Sin proveedor' : lang === 'it' ? 'Nessun fornitore' : 'Aucun fournisseur'}
                          </button>
                          {filteredSuppliers.length === 0 ? (
                            <div style={{ padding:'10px 12px', fontSize:12, color:'var(--text3)' }}>
                              {lang === 'en' ? 'No supplier found' : lang === 'es' ? 'No se encontró ningún proveedor' : lang === 'it' ? 'Nessun fornitore trovato' : 'Aucun fournisseur trouvé'}
                            </div>
                          ) : (
                            filteredSuppliers.map(s => (
                              <button key={s.id} type="button" role="option" aria-selected={form.supplierId === s.id}
                                onMouseDown={() => { setForm(f => ({...f, supplierId:s.id, supplier:s.name})); setSupOpen(false) }}
                                style={{
                                  width:'100%', textAlign:'left', padding:'8px 12px', background: form.supplierId === s.id ? 'rgba(91,78,232,.1)' : 'transparent',
                                  border:'none', cursor:'pointer', fontSize:13, color:'var(--text)',
                                  borderBottom:'1px solid var(--border)',
                                }}>
                                {s.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </ViewField>
                </div>

                {/* ── Code-barres + scanner ── */}
                {productEditMode ? (
                  <ViewField label={i('CODE-BARRES', 'BARCODE', 'CÓDIGO DE BARRAS', 'CODICE A BARRE')} value={form.barcode||''} editing={true}>
                    {/* Scan = geste PRINCIPAL (bouton primaire mis en avant) ; la saisie
                        manuelle reste possible ; « Générer » est un second recours discret. */}
                    <div style={{ display:'flex', gap:8 }}>
                      <input className="input text-sm" style={{ flex:1, borderColor: barcodeInvalid ? 'var(--danger)' : undefined }} placeholder={i('EAN-13 / EAN-8 / UPC-A…', 'EAN-13 / EAN-8 / UPC-A…', 'EAN-13 / EAN-8 / UPC-A…', 'EAN-13 / EAN-8 / UPC-A…')} value={form.barcode} onChange={e => { const v = e.target.value; setForm(f => ({...f, barcode:v})); runOffLookup(v) }} />
                      <button type="button" onClick={() => setShowScanner(true)}
                        title={i('Scanner un code-barres', 'Scan a barcode', 'Escanear un código de barras', 'Scansiona un codice a barre')}
                        style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 16px', minHeight:40, whiteSpace:'nowrap',
                          background:'var(--p2)', color:'#fff', border:'none', borderRadius:8, cursor:'pointer',
                          fontSize:13, fontWeight:'var(--fw-semibold)', fontFamily:'var(--font)', transition:'all .15s' }}>
                        <Camera size={17} /> {i('Scanner', 'Scan', 'Escanear', 'Scansiona')}
                      </button>
                    </div>
                    {/* Aperçu vignette dès qu'un code valide est saisi/scanné (« ET édition »). */}
                    {isValidBarcode(normalizeBarcode(form.barcode)) && (
                      <div style={{ marginTop:10 }}><BarcodeVignette value={form.barcode} lang={lang} /></div>
                    )}
                    {/* Warning code-barres manquant/invalide (bordure rouge + blocage au save conservés).
                        En édition, le bouton Scanner est déjà à côté → bandeau non cliquable. */}
                    {renderEanWarning()}
                    {/* Second recours : générer un code interne si pas de code fabricant à scanner. */}
                    <button type="button"
                      onClick={() => {
                        if (form.barcode && !window.confirm(lang === 'en' ? 'Replace the existing barcode?' : lang === 'es' ? '¿Reemplazar el código de barras existente?' : lang === 'it' ? 'Sostituire il codice a barre esistente?' : 'Remplacer le code-barres existant ?')) return
                        setForm(f => ({ ...f, barcode: generateEAN13() }))
                      }}
                      style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:6, background:'transparent', border:'none', padding:0, color:'var(--text3)', fontSize:12, fontFamily:'var(--font)', cursor:'pointer' }}>
                      <Wand2 size={13} /> {i('Pas de code fabricant ? Générer un code interne', 'No manufacturer code? Generate an internal one', 'Sin código del fabricante? Generar un código interno', 'Nessun codice produttore? Genera un codice interno')}
                    </button>
                    {/* État du lookup Open Food Facts (ajout seulement) */}
                    {!editingSku && offLooking && (
                      <div style={{ marginTop:6, fontSize:11, color:'var(--text3)', display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:11, height:11, border:'2px solid var(--border)', borderTopColor:'var(--p2)', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' }} />
                        {i('Recherche du produit…', 'Looking up product…', 'Buscando producto…', 'Ricerca prodotto…')}
                      </div>
                    )}
                    {!editingSku && !offLooking && offFilled.length > 0 && (
                      <div style={{ marginTop:6, fontSize:11, color:'var(--acc2)', fontWeight:'var(--fw-regular)', display:'flex', alignItems:'center', gap:5 }}>
                        <Wand2 size={12} /> {i('Pré-rempli via Open Food Facts — modifiable', 'Pre-filled via Open Food Facts — editable', 'Rellenado vía Open Food Facts — editable', 'Precompilato via Open Food Facts — modificabile')}
                      </div>
                    )}
                  </ViewField>
                ) : (
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:'var(--fw-bold)', textTransform:'uppercase', letterSpacing:'.6px', color:'var(--text3)', marginBottom:5 }}>{i('CODE-BARRES', 'BARCODE', 'CÓDIGO DE BARRAS', 'CODICE A BARRE')}</label>
                    {form.barcode && isValidBarcode(normalizeBarcode(form.barcode)) ? (
                      <BarcodeVignette value={form.barcode} lang={lang} />
                    ) : (
                      <div style={{ padding:'9px 13px', background:'transparent', border:'1px solid var(--border)', borderRadius:10, fontSize:13, minHeight:40, display:'flex', alignItems:'center' }}>
                        <span style={{ color:'var(--text4)', fontStyle:'italic', fontSize:12 }}>{emptyLabel}</span>
                      </div>
                    )}
                    {/* Warning EAN manquant — ACTIONNABLE en visualisation : clic → édition + scanner
                        (un geste au lieu de trois ; pas de scan accessible autrement ici). */}
                    {renderEanWarning(() => { setProductEditMode(true); setShowScanner(true) })}
                  </div>
                )}
                <ViewField label={i('DESCRIPTION', 'DESCRIPTION', 'DESCRIPCIÓN', 'DESCRIZIONE')} value={form.description||''} editing={productEditMode} emptyLabel={emptyLabel} multiline>
                  <textarea className="input text-sm" rows={2} placeholder={i('Description courte...', 'Short description...', 'Descripción corta...', 'Descrizione breve...')}
                    value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} />
                </ViewField>
                <ViewField label={i('NOTES INTERNES', 'INTERNAL NOTES', 'NOTAS INTERNAS', 'NOTE INTERNE')} value={form.notes||''} editing={productEditMode} emptyLabel={emptyLabel} multiline>
                  <textarea className="input text-sm" rows={2} placeholder={i('Remarques...', 'Remarks...', 'Observaciones...', 'Note...')}
                    value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} />
                </ViewField>
              </div>
            )}

            {/* ── Onglet Prix & Stock ── */}
            {modalTab === 'prix' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="grid grid-cols-2 gap-3">
                  <ViewField label={i('Prix achat HT *', 'Purchase price excl. tax *', 'Precio de compra sin impuestos *', "Prezzo d'acquisto IVA escl. *")} value={fmt(form.buy)} editing={productEditMode} emptyLabel={emptyLabel}>
                    <input className="input text-sm" type="number" value={form.buy || ''} onChange={e => setForm(f => ({...f, buy:+e.target.value}))} />
                  </ViewField>
                  <ViewField label={i('Prix vente TTC *', 'Selling price incl. tax *', 'Precio de venta con impuestos *', 'Prezzo di vendita IVA incl. *')} value={fmtForm(form.sell)} editing={productEditMode} emptyLabel={emptyLabel}>
                    <input className="input text-sm" type="number" value={form.sell || ''} onChange={e => setForm(f => ({...f, sell:+e.target.value}))} />
                  </ViewField>
                  <ViewField label={i('Prix grossiste', 'Wholesale price', 'Precio mayorista', "Prezzo all'ingrosso")} value={form.priceWholesale ? fmtForm(form.priceWholesale) : '—'} editing={productEditMode} emptyLabel={emptyLabel}>
                    <input className="input text-sm" type="number" value={form.priceWholesale || ''} onChange={e => setForm(f => ({...f, priceWholesale:+e.target.value}))} />
                  </ViewField>
                  <ViewField label={i('Prix demi-grossiste', 'Semi-wholesale price', 'Precio semi-mayorista', "Prezzo semi-ingrosso")} value={form.priceSemiWholesale ? fmtForm(form.priceSemiWholesale) : '—'} editing={productEditMode} emptyLabel={emptyLabel}>
                    <input className="input text-sm" type="number" value={form.priceSemiWholesale || ''} onChange={e => setForm(f => ({...f, priceSemiWholesale:+e.target.value}))} />
                  </ViewField>
                </div>
                {/* Marge calculée */}
                {form.buy > 0 && form.sell > 0 && (
                  <div style={{ padding:'10px 14px', background:'rgba(14,196,126,.08)', border:'1px solid rgba(14,196,126,.2)', borderRadius:10, fontSize:13 }}>
                    {i('Marge', 'Margin', 'Margen', 'Margine')} : <strong style={{ color:'var(--acc2)' }}>{((form.sell - form.buy) / form.buy * 100).toFixed(1)} %</strong>
                    <span style={{ color:'var(--text3)', marginLeft:12 }}>({fmtForm(form.sell - form.buy)} / {i('unité', 'unit', 'unidad', 'unità')})</span>
                  </div>
                )}

                {/* ── Tarification par palier ── */}
                <div style={{
                  padding: '14px', borderRadius: 10,
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
                        {i('Tarification par palier', 'Tiered pricing', 'Precios por escala', 'Prezzi a scaglioni')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {i(
                          'Définissez des prix automatiques selon la quantité achetée',
                          'Set automatic prices based on quantity purchased',
                          'Defina precios automáticos según la cantidad comprada',
                          'Imposta prezzi automatici in base alla quantità acquistata',
                        )}
                      </div>
                    </div>
                    {productEditMode && (
                      <button type="button" className="mini-btn"
                        onClick={() => {
                          const last = form.priceTiers?.[form.priceTiers.length - 1]
                          const nextMin = last ? last.minQty + 10 : 10
                          const nextPrice = last ? Math.max(0, Math.round(last.price * 0.95)) : form.sell || 0
                          setForm(f => ({ ...f, priceTiers: [...(f.priceTiers ?? []), { minQty: nextMin, price: nextPrice, label: '' }] }))
                        }}>
                        + {i('Ajouter un palier', 'Add tier', 'Añadir escala', 'Aggiungi scaglione')}
                      </button>
                    )}
                  </div>

                  {form.priceTiers && form.priceTiers.length > 0 ? (
                    <>
                      <div style={{ display:'grid', gridTemplateColumns: productEditMode ? '110px 140px 1fr 32px' : '110px 140px 1fr', gap: 8, fontSize: 11, fontWeight: 'var(--fw-semibold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4, padding: '0 4px' }}>
                        <span>{i('Quantité min', 'Min quantity', 'Cantidad mín', 'Quantità min')}</span>
                        <span>{i('Prix unitaire', 'Unit price', 'Precio unitario', 'Prezzo unitario')}</span>
                        <span>{i('Étiquette', 'Label', 'Etiqueta', 'Etichetta')} ({i('optionnelle', 'optional', 'opcional', 'opzionale')})</span>
                        {productEditMode && <span></span>}
                      </div>
                      {form.priceTiers.map((tier, idx) => {
                        const dup = form.priceTiers!.filter(t => t.minQty === tier.minQty).length > 1
                        const prev = idx > 0 ? form.priceTiers![idx - 1] : null
                        const orderWarn = prev && tier.minQty <= prev.minQty
                        return (
                          <div key={idx} style={{ display:'grid', gridTemplateColumns: productEditMode ? '110px 140px 1fr 32px' : '110px 140px 1fr', gap: 8, padding: '4px', alignItems:'center', borderRadius: 6, background: dup || orderWarn ? 'rgba(255,59,92,.08)' : 'transparent' }}>
                            {productEditMode ? (
                              <input className="input text-sm" type="number" min={1} step={1}
                                value={tier.minQty || ''}
                                onChange={e => {
                                  const v = parseInt(e.target.value, 10) || 0
                                  setForm(f => ({ ...f, priceTiers: f.priceTiers!.map((t, i2) => i2 === idx ? { ...t, minQty: v } : t) }))
                                }} />
                            ) : <span style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:'var(--fw-semibold)', color:'var(--text)' }}>{tier.minQty}+</span>}
                            {productEditMode ? (
                              <input className="input text-sm" type="number" min={0}
                                value={tier.price || ''}
                                onChange={e => {
                                  const v = parseFloat(e.target.value) || 0
                                  setForm(f => ({ ...f, priceTiers: f.priceTiers!.map((t, i2) => i2 === idx ? { ...t, price: v } : t) }))
                                }} />
                            ) : <span style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--acc2)' }}>{fmtForm(tier.price)}</span>}
                            {productEditMode ? (
                              <input className="input text-sm" type="text"
                                placeholder={i('ex: demi-gros', 'e.g.: semi-wholesale', 'ej.: semi-mayorista', 'es.: semi-ingrosso')}
                                value={tier.label ?? ''}
                                onChange={e => {
                                  const v = e.target.value
                                  setForm(f => ({ ...f, priceTiers: f.priceTiers!.map((t, i2) => i2 === idx ? { ...t, label: v } : t) }))
                                }} />
                            ) : <span style={{ fontSize:12, color:'var(--text2)' }}>{tier.label || '—'}</span>}
                            {productEditMode && (
                              <button type="button" className="mini-btn"
                                aria-label={i('Supprimer le palier', 'Delete tier', 'Eliminar escala', 'Elimina scaglione')}
                                onClick={() => setForm(f => ({ ...f, priceTiers: f.priceTiers!.filter((_, i2) => i2 !== idx) }))}
                                style={{ color:'var(--danger)', padding: '4px 6px' }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {/* Preview lecture */}
                      <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(0,184,255,.08)', border:'1px solid rgba(0,184,255,.18)', fontSize: 11, color: 'var(--text2)', fontFamily:'var(--mono)' }}>
                        {[...form.priceTiers].sort((a,b) => a.minQty - b.minQty).reduce((acc, t, idx, arr) => {
                          const next = arr[idx + 1]
                          const range = next ? `${t.minQty}-${next.minQty - 1}` : `${t.minQty}+`
                          return acc + (acc ? ' · ' : '') + `${range} → ${fmtForm(t.price)}`
                        }, `1-${form.priceTiers[0].minQty - 1} → ${fmtForm(form.sell || 0)} · `)}
                      </div>
                      {/* Warnings validation */}
                      {(() => {
                        const seen = new Set<number>()
                        const dup = form.priceTiers.some(t => { if (seen.has(t.minQty)) return true; seen.add(t.minQty); return false })
                        const sorted = [...form.priceTiers].sort((a,b) => a.minQty - b.minQty)
                        const priceUp = sorted.some((t, i) => i > 0 && t.price > sorted[i-1].price)
                        return (
                          <>
                            {dup && <div style={{ marginTop:6, fontSize:11, color:'var(--danger)' }}>⚠️ {i('Quantité min en double — corrigez avant d\'enregistrer', 'Duplicate min quantity — fix before saving', 'Cantidad mín duplicada — corrija antes de guardar', 'Quantità min duplicata — correggi prima di salvare')}</div>}
                            {priceUp && !dup && <div style={{ marginTop:6, fontSize:11, color:'var(--warn)' }}>ℹ️ {i('Prix qui augmentent avec la quantité — vérifiez si voulu', 'Prices increase with quantity — verify if intended', 'Precios que aumentan con la cantidad — verifique si es intencional', 'Prezzi che aumentano con la quantità — verifica se voluto')}</div>}
                          </>
                        )
                      })()}
                    </>
                  ) : (
                    <div style={{ padding: '12px', borderRadius: 6, background: 'var(--bg4)', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                      {i('Aucun palier défini. Le prix de vente s\'applique pour toutes les quantités.', 'No tiers defined. Selling price applies to all quantities.', 'Sin escalas. El precio de venta se aplica a todas las cantidades.', 'Nessuno scaglione definito. Il prezzo di vendita si applica a tutte le quantità.')}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ViewField label={i('Stock initial *', 'Initial stock *', 'Stock inicial *', 'Stock iniziale *')} value={String(form.stock)} editing={productEditMode} emptyLabel={emptyLabel}>
                    <input className="input text-sm" type="number" value={form.stock || ''} onChange={e => setForm(f => ({...f, stock:+e.target.value}))} />
                  </ViewField>
                  <ViewField label={i('Seuil alerte *', 'Alert threshold *', 'Umbral de alerta *', 'Soglia di allerta *')} value={String(form.threshold)} editing={productEditMode} emptyLabel={emptyLabel}>
                    <input className="input text-sm" type="number" value={form.threshold || ''} onChange={e => setForm(f => ({...f, threshold:+e.target.value}))} />
                  </ViewField>
                  <ViewField label={i('Taux TVA', 'VAT rate', 'Tasa de IVA', 'Aliquota IVA')} value={`${form.taxRate} %`} editing={productEditMode} emptyLabel={emptyLabel}>
                    <select className="input text-sm" value={form.taxRate} onChange={e => setForm(f => ({...f, taxRate:+e.target.value}))}>
                      {[0,5,10,18,20].map(r => <option key={r} value={r}>{r} %</option>)}
                    </select>
                  </ViewField>
                </div>
                {/* Toggle promotion */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:'var(--fw-regular)', color:'var(--text)' }}>{i('Produit en promotion', 'Product on promotion', 'Producto en promoción', 'Prodotto in promozione')}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{i('Affiche un badge PROMO au POS', 'Shows a PROMO badge at POS', 'Muestra una insignia PROMO en POS', 'Mostra un badge PROMO al POS')}</div>
                  </div>
                  <button role="switch" aria-checked={form.hasPromotion}
                    aria-label={i('Produit en promotion', 'Product on promotion', 'Producto en promoción', 'Prodotto in promozione')}
                    onClick={() => setForm(f => ({...f, hasPromotion:!f.hasPromotion}))} style={{
                    width:48, height:26, borderRadius:99, position:'relative',
                    background: form.hasPromotion ? 'var(--p2)' : 'var(--bg4)', border:'none', cursor:'pointer',
                  }}>
                    <div style={{ position:'absolute', top:3, left: form.hasPromotion ? 25 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 2px 4px rgba(0,0,0,.2)' }} />
                  </button>
                </div>
                {form.hasPromotion && (
                  <ResponsiveGrid min={160} gap={12}>
                    <ViewField label={i('PRIX PROMOTION', 'PROMO PRICE', 'PRECIO PROMO', 'PREZZO PROMO')} value={form.promotionPrice ? fmt(form.promotionPrice) : ''} editing={productEditMode} emptyLabel={emptyLabel}>
                      <input className="input text-sm" type="number" value={form.promotionPrice || ''} onChange={e => setForm(f => ({...f, promotionPrice:+e.target.value}))} />
                    </ViewField>
                    <ViewField label={i('DATE FIN PROMO', 'PROMO END DATE', 'FECHA FIN PROMO', 'DATA FINE PROMO')} value={form.promotionEnd||''} editing={productEditMode} emptyLabel={emptyLabel}>
                      <input className="input text-sm" type="date" value={form.promotionEnd} onChange={e => setForm(f => ({...f, promotionEnd:e.target.value}))} />
                    </ViewField>
                  </ResponsiveGrid>
                )}
              </div>
            )}

            {/* ── Onglet Avancé ── */}
            {modalTab === 'avance' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { label: i('Produit actif', 'Active product', 'Producto activo', 'Prodotto attivo'),
                    sub:   i('Visible dans les listes', 'Visible in lists', 'Visible en las listas', 'Visibile negli elenchi'),
                    key:'isActive' as const },
                ].map(tog => (
                  <div key={tog.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:'var(--fw-regular)', color:'var(--text)' }}>{tog.label}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{tog.sub}</div>
                    </div>
                    <button role="switch" aria-checked={!!form[tog.key]} aria-label={tog.label}
                      onClick={() => productEditMode && setForm(f => ({...f, [tog.key]:!f[tog.key]}))} style={{
                      width:48, height:26, borderRadius:99, position:'relative',
                      background: form[tog.key] ? 'var(--p2)' : 'var(--bg4)', border:'none', cursor: productEditMode ? 'pointer' : 'default',
                    }}>
                      <div style={{ position:'absolute', top:3, left: form[tog.key] ? 25 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .2s', boxShadow:'0 2px 4px rgba(0,0,0,.2)' }} />
                    </button>
                  </div>
                ))}
                <ViewField label={lang === 'en' ? 'INTERNAL REFERENCE' : lang === 'es' ? 'REFERENCIA INTERNA' : lang === 'it' ? 'RIFERIMENTO INTERNO' : 'RÉFÉRENCE INTERNE'} value="" editing={productEditMode} emptyLabel={emptyLabel}>
                  <input className="input text-sm" placeholder={lang === 'en' ? 'Optional reference...' : lang === 'es' ? 'Referencia opcional...' : lang === 'it' ? 'Riferimento opzionale...' : 'Référence optionnelle...'} />
                </ViewField>
                <ResponsiveGrid min={160} gap={12}>
                  <ViewField label={i('POIDS (g)', 'WEIGHT (g)', 'PESO (g)', 'PESO (g)')} value="" editing={productEditMode} emptyLabel={emptyLabel}>
                    <input className="input text-sm" type="number" placeholder={i('Ex: 500', 'Ex: 500', 'Ej: 500', 'Es: 500')} />
                  </ViewField>
                  <ViewField label={i('DIMENSIONS', 'DIMENSIONS', 'DIMENSIONES', 'DIMENSIONI')} value="" editing={productEditMode} emptyLabel={emptyLabel}>
                    <input className="input text-sm" placeholder={i('L × l × h cm', 'L × W × H cm', 'L × A × H cm', 'L × P × A cm')} />
                  </ViewField>
                </ResponsiveGrid>
              </div>
            )}

            </div>{/* end scrollable body */}

            {/* Fixed footer */}
            <div className="flex gap-2.5" style={{ padding:'16px 24px 20px', flexShrink:0, borderTop:'1px solid var(--border)' }}>
              {editingSku && !productEditMode ? (
                <>
                  <button className="btn btn-primary flex-1 justify-center gap-1.5" style={{ display:'flex', alignItems:'center', minHeight:44 }} onClick={() => setProductEditMode(true)}><Pencil size={13} /> {lang === 'en' ? 'Edit' : lang === 'es' ? 'Editar' : lang === 'it' ? 'Modifica' : 'Modifier'}</button>
                  <button className="btn btn-ghost" style={{ minHeight:44 }} onClick={() => { setShowModal(false); resetForm() }}>{lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'}</button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary flex-1 justify-center" style={{ minHeight:44 }} onClick={saveProduct} disabled={barcodeInvalid}>
                    {editingSku
                      ? i('Enregistrer les modifications', 'Save changes', 'Guardar cambios', 'Salva modifiche')
                      : i('Ajouter le produit', 'Add product', 'Agregar producto', 'Aggiungi prodotto')}
                  </button>
                  {editingSku ? (
                    <button className="btn btn-ghost" style={{ minHeight:44 }} onClick={() => {
                      const p = products.find(p => p.sku === editingSku)
                      if (p) setForm(f => ({ ...f, sku:p.sku, name:p.name.replace(/^\S+\s/,''), category:p.category, buy:p.buy, sell:p.sell, stock:p.stock, threshold:p.threshold, supplier:p.supplier, supplierId:p.supplierId??'', image:p.name.match(/^\S+/)?.[0]??'📦', barcode:p.barcode??'', description:p.description??'', notes:p.notes??'' }))
                      setProductEditMode(false)
                    }}>{t('btn_cancel')}</button>
                  ) : (
                    <button className="btn btn-ghost" style={{ minHeight:44 }} onClick={() => { setShowModal(false); resetForm() }}>{t('btn_cancel')}</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Scanner code-barres ── */}
      {showScanner && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onScan={raw => {
              // Canonicalise (UPC-A→EAN-13, espaces) → même forme qu'en base.
              const barcode = normalizeBarcode(raw)
              setForm(f => ({ ...f, barcode }))
              setShowScanner(false)
              // En AJOUT : auto-remplissage Open Food Facts (qui toaste le résultat).
              // En ÉDITION : on confirme juste le code scanné (pas d'écrasement de champs).
              if (!editingSku) runOffLookup(barcode)
              else toast.success(`${i('Code-barres', 'Barcode', 'Código de barras', 'Codice a barre')} : ${barcode}`)
            }}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      )}

      {/* ── Modal Catégorie ── */}
      {showCatModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true"
          aria-label={editCat
            ? i('Modifier la catégorie', 'Edit category', 'Editar categoría', 'Modifica categoria')
            : i('Nouvelle catégorie', 'New category', 'Nueva categoría', 'Nuova categoria')}
          onClick={e => e.target === e.currentTarget && setShowCatModal(false)}>
          <div ref={catBoxRef} className="modal-box" style={{ maxWidth:440 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:'var(--fw-bold)', color:'var(--text)' }}>
                {editCat
                  ? i('Modifier la catégorie', 'Edit category', 'Editar categoría', 'Modifica categoria')
                  : i('Nouvelle catégorie', 'New category', 'Nueva categoría', 'Nuova categoria')}
              </h3>
              <button aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} className="mini-btn" onClick={() => setShowCatModal(false)}><X size={14} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>{lang === 'en' ? 'Category name' : lang === 'es' ? 'Nombre de la categoría' : lang === 'it' ? 'Nome categoria' : 'Nom de la catégorie'}</label>
                <input aria-label={lang === 'en' ? 'Category name' : lang === 'es' ? 'Nombre de la categoría' : lang === 'it' ? 'Nome categoria' : 'Nom de la catégorie'} className="input" value={catForm.name} onChange={e => setCatForm(f => ({...f, name:e.target.value}))} placeholder={lang === 'en' ? 'Ex: Cereals' : lang === 'es' ? 'Ej: Cereales' : lang === 'it' ? 'Es: Cereali' : 'Ex: Céréales'} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>{lang === 'en' ? 'Icon (emoji)' : lang === 'es' ? 'Icono (emoji)' : lang === 'it' ? 'Icona (emoji)' : 'Icône (emoji)'}</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                  {['🌾','🫙','🍚','🧼','🥛','🍅','🫒','☕','🐟','🧃','🍬','🧴','🥤','🍫','🌽','🫚'].map(emoji => (
                    <button key={emoji} aria-label={`${i("Choisir l'icône", 'Choose icon', 'Elegir icono', "Scegli l'icona")} ${emoji}`} aria-pressed={catForm.icon === emoji} onClick={() => setCatForm(f => ({...f, icon:emoji}))} style={{
                      width:36, height:36, borderRadius:8, fontSize:18, cursor:'pointer',
                      background: catForm.icon === emoji ? 'rgba(91,78,232,.2)' : 'var(--bg3)',
                      border:`1.5px solid ${catForm.icon === emoji ? 'var(--p2)' : 'var(--border)'}`,
                    }}>{emoji}</button>
                  ))}
                </div>
                <input className="input" value={catForm.icon} onChange={e => setCatForm(f => ({...f, icon:e.target.value}))} placeholder={i('Ou tapez un emoji...', 'Or type an emoji...', 'O escribe un emoji...', 'O digita un emoji...')} style={{ fontSize:20 }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>{i('Couleur', 'Color', 'Color', 'Colore')}</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                  {['#818CF8','#F59E0B','#34D399','#F472B6','#60A5FA','#A78BFA','#EF4444','#14B8A6','#F97316','#84CC16'].map(color => (
                    <button key={color} aria-label={`${i('Choisir la couleur', 'Choose color', 'Elegir color', 'Scegli il colore')} ${color}`} aria-pressed={catForm.color === color} onClick={() => setCatForm(f => ({...f, color}))} style={{
                      width:28, height:28, borderRadius:'50%', background:color, border:'none', cursor:'pointer',
                      boxShadow: catForm.color === color ? `0 0 0 3px white, 0 0 0 5px ${color}` : 'none', transition:'box-shadow .15s',
                    }} />
                  ))}
                </div>
                <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({...f, color:e.target.value}))}
                  style={{ width:'100%', height:36, borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', background:'none' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color:'var(--text3)' }}>{i('Description', 'Description', 'Descripción', 'Descrizione')}</label>
                <textarea aria-label={i('Description', 'Description', 'Descripción', 'Descrizione')} className="input" rows={2} value={catForm.description} onChange={e => setCatForm(f => ({...f, description:e.target.value}))} placeholder={i('Description courte...', 'Short description...', 'Descripción corta...', 'Descrizione breve...')} />
              </div>
              {/* Preview */}
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--border)', borderLeft:`4px solid ${catForm.color}` }}>
                <div style={{ width:36, height:36, borderRadius:10, background:`${catForm.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{catForm.icon}</div>
                <div>
                  <div style={{ fontWeight:'var(--fw-semibold)', color:'var(--text)' }}>{catForm.name || i('Nom catégorie', 'Category name', 'Nombre categoría', 'Nome categoria')}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{catForm.description || i('Description...', 'Description...', 'Descripción...', 'Descrizione...')}</div>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button className="topbar-btn" style={{ flex:1, justifyContent:'center' }} onClick={() => {
                if (!catForm.name) { toast.error(i('Nom requis', 'Name required', 'Nombre requerido', 'Nome richiesto')); return }
                if (editCat) {
                  setCategories(prev => prev.map(c => c.id === editCat.id ? {...c, ...catForm} : c))
                  toast.success(`${i('Catégorie', 'Category', 'Categoría', 'Categoria')} "${catForm.name}" ${i('modifiée', 'updated', 'actualizada', 'aggiornata')}`)
                } else {
                  setCategories(prev => [...prev, { id:Date.now(), ...catForm, productsCount:0 }])
                  toast.success(`${i('Catégorie', 'Category', 'Categoría', 'Categoria')} "${catForm.name}" ${i('créée', 'created', 'creada', 'creata')}`)
                }
                setShowCatModal(false)
              }}>{editCat ? i('Modifier', 'Edit', 'Editar', 'Modifica') : i('Créer', 'Create', 'Crear', 'Crea')}</button>
              <button className="mini-btn" style={{ padding:'10px 16px' }} onClick={() => setShowCatModal(false)}>{lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Étiquettes ══ */}
      {showLabelModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true"
          aria-label={lang === 'en' ? 'Print labels' : lang === 'es' ? 'Imprimir etiquetas' : lang === 'it' ? 'Stampa etichette' : 'Imprimer des étiquettes'}
          onClick={e => e.target === e.currentTarget && setShowLabelModal(false)}>
          <div ref={labelBoxRef} className="modal-box" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 'var(--fw-bold)', color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                <Tag size={14} /> {lang === 'en' ? 'Print labels' : lang === 'es' ? 'Imprimir etiquetas' : lang === 'it' ? 'Stampa etichette' : 'Imprimer des étiquettes'}
              </h3>
              <button className="mini-btn" aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} onClick={() => setShowLabelModal(false)}><X size={14} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Format de planche Avery */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
                  {i('Format de planche', 'Sheet format', 'Formato de hoja', 'Formato foglio')}
                </label>
                <select
                  className="input"
                  value={labelConfig.averyPreset ?? 'L7160'}
                  onChange={e => setLabelConfig(f => ({ ...f, averyPreset: e.target.value }))}
                  style={{ fontSize: 13 }}
                >
                  <option value="L7160">Avery L7160 — 63.5×38.1mm — 21/page</option>
                  <option value="L7163">Avery L7163 — 99.1×38.1mm — 14/page</option>
                  <option value="L7165">Avery L7165 — 99.1×67.7mm — 8/page</option>
                  <option value="L7651">Avery L7651 — 38.1×21.2mm — 65/page</option>
                  <option value="CUSTOM">{i('Personnalisé (sans grille A4)', 'Custom (no A4 grid)', 'Personalizado (sin cuadrícula A4)', 'Personalizzato (senza griglia A4)')}</option>
                  <option value="THERMAL_40x30">{i('Thermique 40×30 mm (PDF, à l\'unité)', 'Thermal 40×30 mm (PDF, per unit)', 'Térmica 40×30 mm (PDF, por unidad)', 'Termica 40×30 mm (PDF, per unità)')}</option>
                </select>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, lineHeight: 1.4 }}>
                  {labelConfig.averyPreset === 'THERMAL_40x30'
                    ? i(
                      'PDF au format exact 40×30 mm (une étiquette par page) — imprimez à « taille réelle » sur votre imprimante thermique.',
                      'Exact 40×30 mm PDF (one label per page) — print at "actual size" on your thermal printer.',
                      'PDF de tamaño exacto 40×30 mm (una etiqueta por página) — imprima a «tamaño real» en su impresora térmica.',
                      'PDF in formato esatto 40×30 mm (un\'etichetta per pagina) — stampa a «dimensione reale» sulla tua stampante termica.',
                    )
                    : i(
                      'Insérez une planche d\'étiquettes Avery correspondante dans votre imprimante avant l\'impression.',
                      'Insert a matching Avery label sheet into your printer before printing.',
                      'Inserte una hoja de etiquetas Avery correspondiente en su impresora antes de imprimir.',
                      'Inserisci un foglio di etichette Avery corrispondente nella stampante prima di stampare.',
                    )}
                </div>
              </div>

              {/* Taille (utilisé seulement en mode CUSTOM) */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
                  {lang === 'en' ? 'Label size' : lang === 'es' ? 'Tamaño de etiquetas' : lang === 'it' ? 'Dimensione etichette' : 'Taille des étiquettes'}
                  {(labelConfig.averyPreset ?? 'L7160') !== 'CUSTOM' && <span style={{ marginLeft: 6, color: 'var(--text4)', fontWeight: 400, textTransform: 'none' }}>({i('utilisée en mode personnalisé', 'used in custom mode', 'usado en modo personalizado', 'usato in modalità personalizzata')})</span>}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { id: 'small',  label: i('Petite',  'Small',  'Pequeña', 'Piccola') + '\n150×80px'   },
                    { id: 'medium', label: i('Moyenne', 'Medium', 'Mediana', 'Media')   + '\n200×100px' },
                    { id: 'large',  label: i('Grande',  'Large',  'Grande',  'Grande')  + '\n280×140px' },
                  ].map(size => (
                    <button key={size.id} type="button"
                      onClick={() => setLabelConfig(f => ({ ...f, size: size.id as any }))}
                      style={{
                        padding: '12px 8px', borderRadius: 10,
                        background: labelConfig.size === size.id ? 'rgba(91,78,232,.15)' : 'var(--bg3)',
                        border: `1.5px solid ${labelConfig.size === size.id ? 'var(--p2)' : 'var(--border)'}`,
                        cursor: 'pointer', fontFamily: 'var(--font)',
                        fontSize: 12, fontWeight: 'var(--fw-regular)',
                        color: labelConfig.size === size.id ? 'var(--p2)' : 'var(--text2)',
                        whiteSpace: 'pre-line', transition: 'all .15s',
                      }}>
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
                  {lang === 'en' ? 'Information to display' : lang === 'es' ? 'Información a mostrar' : lang === 'it' ? 'Informazioni da mostrare' : 'Informations à afficher'}
                </label>
                {[
                  { key: 'showPrice',   label: lang === 'en' ? 'Selling price' : lang === 'es' ? 'Precio de venta' : lang === 'it' ? 'Prezzo di vendita' : 'Prix de vente' },
                  { key: 'showSku',     label: 'SKU / ' + i('Référence', 'Reference', 'Referencia', 'Riferimento') },
                  { key: 'showBarcode', label: lang === 'en' ? 'Barcode' : lang === 'es' ? 'Código de barras' : lang === 'it' ? 'Codice a barre' : 'Code-barres' },
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <input type="checkbox"
                      checked={(labelConfig as any)[opt.key]}
                      onChange={e => setLabelConfig(f => ({ ...f, [opt.key]: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: 'var(--p)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* Copies */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 6 }}>
                  {lang === 'en' ? 'Copies per product' : lang === 'es' ? 'Copias por producto' : lang === 'it' ? 'Copie per prodotto' : 'Copies par produit'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" className="mini-btn"
                    onClick={() => setLabelConfig(f => ({ ...f, copies: Math.max(1, f.copies - 1) }))}
                    style={{ width: 36, height: 36, justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 20, fontWeight: 'var(--fw-semibold)', color: 'var(--text)', fontFamily: 'var(--mono)', minWidth: 40, textAlign: 'center' }}>
                    {labelConfig.copies}
                  </span>
                  <button type="button" className="mini-btn"
                    onClick={() => setLabelConfig(f => ({ ...f, copies: Math.min(10, f.copies + 1) }))}
                    style={{ width: 36, height: 36, justifyContent: 'center' }}>+</button>
                </div>
              </div>

              {/* Sélection produits — masquée si ouvert depuis sélection inline (les produits sont déjà choisis) */}
              {hideProductSelection ? (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(91,78,232,.08)', border: '1px solid rgba(91,78,232,.2)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: 'var(--text2)',
                }}>
                  <Tag size={14} style={{ color: 'var(--p2)' }} />
                  <span>
                    <strong>{selectedForLabel.length}</strong>{' '}
                    {i('produit(s) sélectionné(s)', 'product(s) selected', 'producto(s) seleccionado(s)', 'prodotto(i) selezionato(i)')}
                    {' → '}
                    <strong>{selectedForLabel.length * labelConfig.copies}</strong>{' '}
                    {i('étiquette(s)', 'label(s)', 'etiqueta(s)', 'etichetta/e')}
                  </span>
                </div>
              ) : (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
                  {lang === 'en' ? 'Products to label' : lang === 'es' ? 'Productos a etiquetar' : lang === 'it' ? 'Prodotti da etichettare' : 'Produits à étiqueter'}
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button type="button" className="mini-btn" onClick={() => setSelectedForLabel(products.map(p => p.sku))}>
                    {lang === 'en' ? 'All' : lang === 'es' ? 'Todo' : lang === 'it' ? 'Tutto' : 'Tout'}
                  </button>
                  <button type="button" className="mini-btn" onClick={() => setSelectedForLabel([])}>
                    {lang === 'en' ? 'None' : lang === 'es' ? 'Ninguno' : lang === 'it' ? 'Nessuno' : 'Aucun'}
                  </button>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
                  {products.map(p => (
                    <label key={p.sku} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                      <input type="checkbox"
                        checked={selectedForLabel.includes(p.sku)}
                        onChange={e => {
                          if (e.target.checked) setSelectedForLabel(prev => [...prev, p.sku])
                          else setSelectedForLabel(prev => prev.filter(s => s !== p.sku))
                        }}
                        style={{ accentColor: 'var(--p)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 16 }}>{p.name.split(' ')[0]}</span>
                      <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{p.name.split(' ').slice(1).join(' ')}</span>
                      <span style={{ fontSize: 11, color: 'var(--p2)', fontFamily: 'var(--mono)' }}>{fmt(p.sell)}</span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {selectedForLabel.length} {lang === 'en' ? 'selected' : lang === 'es' ? 'seleccionado(s)' : lang === 'it' ? 'selezionato/i' : 'sélectionné(s)'}
                  {' → '}{selectedForLabel.length * labelConfig.copies} {lang === 'en' ? 'label(s)' : lang === 'es' ? 'etiqueta(s)' : lang === 'it' ? 'etichetta/e' : 'étiquette(s)'}
                </div>
              </div>
              )}
            </div>

            {/* Steer actionnable : des produits sélectionnés sans code EAN valide
                n'auront pas de code-barres imprimé (plus de CODE128-sur-SKU) →
                proposer d'aller les compléter (génération / scan). */}
            {(() => {
              if (!labelConfig.showBarcode || !onOpenBackfill) return null
              const missing = products.filter(p => selectedForLabel.includes(p.sku) && !isValidBarcode(normalizeBarcode(p.barcode ?? ''))).length
              if (missing === 0) return null
              return (
                <button type="button" onClick={onOpenBackfill}
                  style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font)',
                    background: 'color-mix(in srgb, var(--warn) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--warn)' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>
                    {i(
                      `${missing} produit(s) sans code-barres ne l'afficheront pas — compléter les codes manquants`,
                      `${missing} product(s) without a barcode won't show one — complete the missing codes`,
                      `${missing} producto(s) sin código no lo mostrarán — completar los códigos faltantes`,
                      `${missing} prodotto(i) senza codice non lo mostreranno — completa i codici mancanti`,
                    )}
                  </span>
                  <Wand2 size={15} style={{ flexShrink: 0 }} />
                </button>
              )
            })()}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="topbar-btn" style={{ flex: 1, justifyContent: 'center' }}
                disabled={selectedForLabel.length === 0}
                onClick={() => {
                  const selectedProducts = products
                    .filter(p => selectedForLabel.includes(p.sku))
                    .map(p => ({
                      name: p.name.split(' ').slice(1).join(' ') || p.name,
                      sku: p.sku,
                      price: p.sell,
                      barcode: p.barcode, // 🔴 était omis → l'EAN-13 persisté n'était jamais imprimé
                      emoji: p.name.split(' ')[0],
                    }))
                  const cfg = { ...labelConfig, shopName: tenant?.name ?? 'HabaShop', lang }
                  // Thermique 40×30 = PDF taille exacte (à l'unité) ; sinon planche A4 (en masse).
                  if (labelConfig.averyPreset === 'THERMAL_40x30') {
                    void printThermalLabels(selectedProducts, fmt, cfg)
                  } else {
                    printProductLabels(selectedProducts, fmt, cfg)
                  }
                  setShowLabelModal(false)
                }}>
                <Printer size={13} /> {lang === 'en' ? 'Print' : lang === 'es' ? 'Imprimir' : lang === 'it' ? 'Stampa' : 'Imprimer'}
              </button>
              <button className="mini-btn" style={{ padding: '10px 16px' }} onClick={() => setShowLabelModal(false)}>
                {lang === 'en' ? 'Cancel' : lang === 'es' ? 'Cancelar' : lang === 'it' ? 'Annulla' : 'Annuler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
