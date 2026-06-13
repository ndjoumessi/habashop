import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, Plus, Pencil, Trash2, Pause, Play,
  ShoppingCart, User, ChevronDown, ChevronUp, X, Check,
  PackageSearch,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useConfig } from '@/stores/appStore'
import { useAuthStore, canAccess } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { subscriptionsApi, customersApi, productsApi } from '@/lib/api'
import { useFormatAmount } from '@/stores/appStore'
import { announce } from '@/lib/announce'
import { useModalFocus } from '@/hooks/useModalFocus'
import type { CartItem } from '@/components/pos/posShared'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubProduct { id: string; name: string; sellPrice: number; emoji: string; stockQty: number }
interface SubItem    { id: string; productId: string; quantity: number; product: SubProduct }
interface SubCustomer{ id: string; name: string; phone?: string }
interface Sub {
  id: string; name: string; dayOfWeek: number; status: string
  note?: string; customerId: string; createdAt: string
  customer: SubCustomer
  items: SubItem[]
}

// ─── Constantes i18n ──────────────────────────────────────────────────────────
const DAY_LABELS: Record<string, string[]> = {
  fr: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
  en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  es: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  it: ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'],
}

function i(fr: string, en: string, es: string, it: string) {
  return { fr, en, es, it }
}

const T = {
  title:        i('Abonnements clients','Customer subscriptions','Suscripciones de clientes','Abbonamenti clienti'),
  subtitle:     i('Paniers hebdomadaires récurrents','Weekly recurring baskets','Cestas semanales recurrentes','Cesti settimanali ricorrenti'),
  new:          i('Nouvel abonnement','New subscription','Nueva suscripción','Nuovo abbonamento'),
  due_today:    i('Dus aujourd\'hui','Due today','Vencen hoy','In scadenza oggi'),
  all:          i('Tous les abonnements','All subscriptions','Todos los abonos','Tutti gli abbonamenti'),
  active:       i('Actif','Active','Activo','Attivo'),
  paused:       i('Pausé','Paused','Pausado','In pausa'),
  cancelled:    i('Annulé','Cancelled','Cancelado','Annullato'),
  load_cart:    i('Charger en caisse','Load to cart','Cargar al carrito','Carica al carrello'),
  edit:         i('Modifier','Edit','Editar','Modifica'),
  pause:        i('Mettre en pause','Pause','Pausar','Metti in pausa'),
  resume:       i('Reprendre','Resume','Reanudar','Riprendi'),
  delete:       i('Supprimer','Delete','Eliminar','Elimina'),
  confirm_del:  i('Supprimer cet abonnement ?','Delete this subscription?','¿Eliminar esta suscripción?','Eliminare questo abbonamento?'),
  empty:        i('Aucun abonnement actif','No active subscriptions','No hay suscripciones activas','Nessun abbonamento attivo'),
  empty_due:    i('Aucun abonnement dû aujourd\'hui','No subscriptions due today','Ninguna suscripción vence hoy','Nessun abbonamento in scadenza oggi'),
  name_label:   i('Nom du panier','Basket name','Nombre del cesto','Nome del cesto'),
  day_label:    i('Jour de livraison','Delivery day','Día de entrega','Giorno di consegna'),
  customer_label:i('Client','Customer','Cliente','Cliente'),
  note_label:   i('Note','Note','Nota','Nota'),
  products_label:i('Produits','Products','Productos','Prodotti'),
  qty_label:    i('Qté','Qty','Cant.','Qt.'),
  save:         i('Enregistrer','Save','Guardar','Salva'),
  cancel:       i('Annuler','Cancel','Cancelar','Annulla'),
  add_product:  i('Ajouter un produit','Add a product','Agregar producto','Aggiungi prodotto'),
  search_cust:  i('Rechercher un client…','Search customer…','Buscar cliente…','Cerca cliente…'),
  search_prod:  i('Rechercher un produit…','Search product…','Buscar producto…','Cerca prodotto…'),
  cart_loaded:  i('Panier chargé en caisse','Basket loaded to cart','Cesto cargado al carrito','Cesto caricato al carrello'),
  no_items:     i('Ce panier est vide','This basket is empty','Este cesto está vacío','Questo cesto è vuoto'),
  total:        i('Total estimé','Estimated total','Total estimado','Totale stimato'),
  saved:        i('Abonnement enregistré','Subscription saved','Suscripción guardada','Abbonamento salvato'),
  deleted:      i('Abonnement supprimé','Subscription deleted','Suscripción eliminada','Abbonamento eliminato'),
  err_items:    i('Ajoutez au moins un produit','Add at least one product','Agrega al menos un producto','Aggiungi almeno un prodotto'),
  err_customer: i('Sélectionnez un client','Select a customer','Selecciona un cliente','Seleziona un cliente'),
  err_name:     i('Saisissez un nom','Enter a name','Ingresa un nombre','Inserisci un nome'),
  status_upd:   i('Statut mis à jour','Status updated','Estado actualizado','Stato aggiornato'),
  go_pos:       i('Allez sur la caisse pour voir le panier','Go to POS to view the cart','Ve al POS para ver el carrito','Vai al POS per vedere il carrello'),
}

function tx(key: keyof typeof T, lang: string): string {
  const entry = T[key] as Record<string,string>
  return entry[lang] ?? entry.fr
}

// ─── Modal Abonnement ─────────────────────────────────────────────────────────
interface ModalProps {
  lang: string; sub?: Sub | null
  onClose: () => void
  onSaved: () => void
}

function SubModal({ lang, sub, onClose, onSaved }: ModalProps) {
  const boxRef = useModalFocus<HTMLDivElement>()
  const [name, setName]     = useState(sub?.name ?? '')
  const [dow, setDow]       = useState<number>(sub?.dayOfWeek ?? 1)
  const [note, setNote]     = useState(sub?.note ?? '')
  const [saving, setSaving] = useState(false)

  // customer search
  const [custSearch, setCustSearch] = useState(sub?.customer?.name ?? '')
  const [custResults, setCustResults] = useState<SubCustomer[]>([])
  const [customer, setCustomer]       = useState<SubCustomer | null>(sub?.customer ?? null)
  const [showCust, setShowCust]       = useState(false)

  // product search
  const [prodSearch, setProdSearch]   = useState('')
  const [prodResults, setProdResults] = useState<SubProduct[]>([])
  const [showProd, setShowProd]       = useState(false)
  const [items, setItems]             = useState<{ productId: string; quantity: number; product: SubProduct }[]>(
    sub?.items.map(it => ({ productId: it.productId, quantity: it.quantity, product: it.product })) ?? []
  )

  useEffect(() => {
    if (custSearch.length < 2) { setCustResults([]); return }
    const t = setTimeout(() => {
      customersApi.search(custSearch)
        .then((r: any[]) => setCustResults(r.slice(0, 6)))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch])

  useEffect(() => {
    if (prodSearch.length < 2) { setProdResults([]); return }
    const t = setTimeout(() => {
      productsApi.list()
        .then((r: any[]) => {
          const q = prodSearch.toLowerCase()
          setProdResults(r.filter((p: any) => p.name.toLowerCase().includes(q) && !p.deletedAt).slice(0, 8))
        })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [prodSearch])

  const addProduct = (p: SubProduct) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === p.id)
      if (idx >= 0) return prev.map((i, ix) => ix === idx ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { productId: p.id, quantity: 1, product: p }]
    })
    setProdSearch(''); setProdResults([]); setShowProd(false)
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty < 1) { setItems(prev => prev.filter(i => i.productId !== productId)); return }
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
  }

  const save = async () => {
    if (!name.trim()) { toast.error(tx('err_name', lang)); return }
    if (!customer) { toast.error(tx('err_customer', lang)); return }
    if (items.length === 0) { toast.error(tx('err_items', lang)); return }
    setSaving(true)
    try {
      const payload = { name: name.trim(), dayOfWeek: dow, customerId: customer.id, note: note.trim() || null, items: items.map(i => ({ productId: i.productId, quantity: i.quantity })) }
      if (sub) await subscriptionsApi.update(sub.id, payload)
      else     await subscriptionsApi.create(payload)
      toast.success(tx('saved', lang)); announce(tx('saved', lang))
      onSaved()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }

  const days = DAY_LABELS[lang] ?? DAY_LABELS.fr

  return (
    <div className="modal-backdrop" role="dialog" aria-modal aria-label={sub ? tx('edit', lang) : tx('new', lang)} onClick={onClose}>
      <div className="modal-box" ref={boxRef} style={{ maxWidth: 540, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 'var(--fw-semibold)', fontSize: 17, margin: 0 }}>{sub ? tx('edit', lang) : tx('new', lang)}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={tx('cancel', lang)}><X size={18} /></button>
        </div>

        {/* Nom */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">{tx('name_label', lang)}</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder={tx('name_label', lang)} />
        </div>

        {/* Client */}
        <div className="form-group" style={{ marginBottom: 14, position: 'relative' }}>
          <label className="form-label">{tx('customer_label', lang)}</label>
          {customer ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
              <User size={14} color="var(--p2)" />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 'var(--fw-semibold)' }}>{customer.name}</span>
              <button className="icon-btn" onClick={() => { setCustomer(null); setCustSearch('') }} aria-label="Changer"><X size={14} /></button>
            </div>
          ) : (
            <>
              <input className="form-input" value={custSearch} onChange={e => { setCustSearch(e.target.value); setShowCust(true) }} placeholder={tx('search_cust', lang)} onFocus={() => setShowCust(true)} />
              {showCust && custResults.length > 0 && (
                <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-md)', marginTop: 2 }}>
                  {custResults.map(c => (
                    <button key={c.id} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}
                      onMouseDown={() => { setCustomer(c); setCustSearch(''); setShowCust(false) }}>
                      {c.name}{c.phone ? ` · ${c.phone}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Jour */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">{tx('day_label', lang)}</label>
          <select className="form-select" value={dow} onChange={e => setDow(Number(e.target.value))}>
            {days.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>

        {/* Produits */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">{tx('products_label', lang)}</label>
          {items.length > 0 && (
            <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map(it => (
                <div key={it.productId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 16 }}>{it.product.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 'var(--fw-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product.name}</span>
                  <input type="number" min={1} value={it.quantity} onChange={e => updateQty(it.productId, Number(e.target.value))}
                    style={{ width: 52, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '2px 4px', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
                  <button className="icon-btn" onClick={() => updateQty(it.productId, 0)} aria-label="Retirer"><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <input className="form-input" value={prodSearch} onChange={e => { setProdSearch(e.target.value); setShowProd(true) }} placeholder={tx('search_prod', lang)} onFocus={() => setShowProd(true)} />
            {showProd && prodResults.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-md)', marginTop: 2 }}>
                {prodResults.map(p => (
                  <button key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}
                    onMouseDown={() => addProduct(p)}>
                    <span style={{ fontSize: 15 }}>{p.emoji}</span>
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>{p.stockQty} en stock</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Note */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">{tx('note_label', lang)}</label>
          <textarea className="form-input" rows={2} value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>{tx('cancel', lang)}</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? '…' : <><Check size={14} /> {tx('save', lang)}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Carte abonnement ─────────────────────────────────────────────────────────
interface CardProps {
  sub: Sub; lang: string; canManage: boolean
  fmt: (v: number) => string
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onLoadCart: () => void
}

function SubCard({ sub, lang, canManage, fmt, onEdit, onToggle, onDelete, onLoadCart }: CardProps) {
  const [expanded, setExpanded] = useState(false)
  const days = DAY_LABELS[lang] ?? DAY_LABELS.fr
  const total = sub.items.reduce((s, it) => s + it.product.sellPrice * it.quantity, 0)
  const isPaused = sub.status === 'paused'

  const statusColor = isPaused ? 'var(--warn)' : 'var(--acc2)'
  const statusBg    = isPaused ? 'rgba(255,184,0,.12)' : 'rgba(0,208,132,.1)'

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 16, opacity: isPaused ? 0.75 : 1 }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <RefreshCw size={17} color="var(--p2)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 15, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} />{sub.customer.name}</span>
            <span>{days[sub.dayOfWeek]}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 'var(--fw-semibold)', background: statusBg, color: statusColor }}>
            {isPaused ? tx('paused', lang) : tx('active', lang)}
          </span>
          <button className="icon-btn" onClick={() => setExpanded(e => !e)} aria-label="Détails">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Résumé produits */}
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sub.items.map(it => (
          <span key={it.id} style={{ fontSize: 12, padding: '2px 8px', background: 'var(--bg3)', borderRadius: 99, border: '1px solid var(--border)', color: 'var(--text2)' }}>
            {it.product.emoji} {it.product.name} ×{it.quantity}
          </span>
        ))}
        {sub.items.length === 0 && <span style={{ fontSize: 12, color: 'var(--text4)' }}>{tx('no_items', lang)}</span>}
      </div>

      {/* Total + note */}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>{tx('total', lang)}</span>
            <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 14, fontFamily: 'var(--font-mono, monospace)' }}>{fmt(total)}</span>
          </div>
          {sub.note && <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{sub.note}</p>}
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={onLoadCart} disabled={sub.items.length === 0}>
          <ShoppingCart size={13} /> {tx('load_cart', lang)}
        </button>
        {canManage && <>
          <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }} onClick={onEdit}>
            <Pencil size={12} /> {tx('edit', lang)}
          </button>
          <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }} onClick={onToggle}>
            {isPaused ? <><Play size={12} /> {tx('resume', lang)}</> : <><Pause size={12} /> {tx('pause', lang)}</>}
          </button>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }} onClick={onDelete}>
            <Trash2 size={12} /> {tx('delete', lang)}
          </button>
        </>}
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function Subscriptions() {
  const { lang } = useConfig()
  const { user } = useAuthStore()
  const canManage = canAccess(user?.role, 'orders') // MANAGER+ seulement pour créer/éditer
  const navigate  = useNavigate()
  const { setCart } = useAppStore()
  const fmt = useFormatAmount()

  const [subs, setSubs]     = useState<Sub[]>([])
  const [due, setDue]       = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState<{ open: boolean; sub: Sub | null }>({ open: false, sub: null })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([subscriptionsApi.list(), subscriptionsApi.due()])
      .then(([all, d]) => { setSubs(all as Sub[]); setDue(d as Sub[]) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const loadToCart = (sub: Sub) => {
    if (sub.items.length === 0) return
    const cartItems: CartItem[] = sub.items.map(it => ({
      id: it.product.id,
      name: it.product.name,
      price: it.product.sellPrice,
      qty: it.quantity,
      emoji: it.product.emoji,
    }))
    setCart(cartItems)
    toast.success(tx('cart_loaded', lang))
    announce(tx('cart_loaded', lang))
    toast(tx('go_pos', lang), { duration: 3000 })
    navigate('/app/pos')
  }

  const toggleStatus = async (sub: Sub) => {
    const newStatus = sub.status === 'active' ? 'paused' : 'active'
    try {
      await subscriptionsApi.update(sub.id, { status: newStatus })
      toast.success(tx('status_upd', lang)); announce(tx('status_upd', lang))
      load()
    } catch { toast.error('Erreur') }
  }

  const deleteSub = async (sub: Sub) => {
    if (!confirm(tx('confirm_del', lang))) return
    try {
      await subscriptionsApi.delete(sub.id)
      toast.success(tx('deleted', lang)); announce(tx('deleted', lang))
      load()
    } catch { toast.error('Erreur') }
  }

  const active  = subs.filter(s => s.status === 'active')
  const paused  = subs.filter(s => s.status === 'paused')
  const allView = [...active, ...paused]

  return (
    <main id="main-content" style={{ padding: 'var(--sp-6)', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontWeight: 'var(--fw-semibold)', fontSize: 22, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={20} color="var(--p2)" /> {tx('title', lang)}
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>{tx('subtitle', lang)}</p>
        </div>
        {canManage && (
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setModal({ open: true, sub: null })}>
            <Plus size={15} /> {tx('new', lang)}
          </button>
        )}
      </div>

      {/* Stats rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: tx('active', lang),   value: active.length,  color: 'var(--acc2)' },
          { label: tx('paused', lang),   value: paused.length,  color: 'var(--warn)' },
          { label: tx('due_today', lang), value: due.length,    color: 'var(--p2)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 'var(--fw-bold)', color: s.color, fontFamily: 'var(--font-mono, monospace)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Dus aujourd'hui */}
      {due.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontWeight: 'var(--fw-semibold)', fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShoppingCart size={15} color="var(--p2)" /> {tx('due_today', lang)}
            <span style={{ fontSize: 12, background: 'var(--p2)', color: '#fff', borderRadius: 99, padding: '1px 8px', fontWeight: 'var(--fw-semibold)', marginLeft: 4 }}>{due.length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {due.map(sub => (
              <SubCard key={sub.id} sub={sub} lang={lang} canManage={canManage} fmt={fmt}
                onEdit={() => setModal({ open: true, sub })}
                onToggle={() => toggleStatus(sub)}
                onDelete={() => deleteSub(sub)}
                onLoadCart={() => loadToCart(sub)} />
            ))}
          </div>
        </section>
      )}

      {/* Tous */}
      <section>
        <h2 style={{ fontWeight: 'var(--fw-semibold)', fontSize: 15, marginBottom: 12 }}>{tx('all', lang)}</h2>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 'var(--r-lg)' }} />)}
          </div>
        ) : allView.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text4)' }}>
            <PackageSearch size={36} style={{ marginBottom: 10 }} />
            <p style={{ margin: 0 }}>{tx('empty', lang)}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allView.map(sub => (
              <SubCard key={sub.id} sub={sub} lang={lang} canManage={canManage} fmt={fmt}
                onEdit={() => setModal({ open: true, sub })}
                onToggle={() => toggleStatus(sub)}
                onDelete={() => deleteSub(sub)}
                onLoadCart={() => loadToCart(sub)} />
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      {modal.open && (
        <SubModal lang={lang} sub={modal.sub}
          onClose={() => setModal({ open: false, sub: null })}
          onSaved={() => { setModal({ open: false, sub: null }); load() }} />
      )}
    </main>
  )
}
