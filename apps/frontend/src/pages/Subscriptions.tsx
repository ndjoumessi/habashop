import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, Plus, Pencil, Trash2, Pause, Play,
  ShoppingCart, User, ChevronDown, ChevronUp,
  PackageSearch, Calendar,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useConfig } from '@/stores/appStore'
import { useAuthStore, canAccess } from '@/stores/authStore'
import { useAppStore } from '@/stores/appStore'
import { subscriptionsApi } from '@/lib/api'
import { useFormatAmount } from '@/stores/appStore'
import { announce } from '@/lib/announce'
import SubscriptionModal from '@/components/subscriptions/SubscriptionModal'
import {
  DAY_LABELS, tx, subscriptionTotal, type Sub,
} from '@/components/subscriptions/subscriptionShared'
import type { CartItem } from '@/components/pos/posShared'

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
  const total = subscriptionTotal(sub.items)
  const isPaused = sub.status === 'paused'

  const statusColor = isPaused ? 'var(--warn)' : 'var(--acc2)'
  const statusBg    = isPaused
    ? 'color-mix(in srgb, var(--warn) 12%, transparent)'
    : 'color-mix(in srgb, var(--acc2) 10%, transparent)'

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: 16,
      opacity: isPaused ? 0.75 : 1,
      transition: 'opacity .2s',
    }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 'var(--r-md)', flexShrink: 0,
          background: 'color-mix(in srgb, var(--p2) 12%, var(--bg3))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <RefreshCw size={17} color="var(--p2)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 'var(--fw-semibold)', fontSize: 15, marginBottom: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{sub.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <User size={11} />{sub.customer.name}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} />{days[sub.dayOfWeek]}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            padding: '3px 9px', borderRadius: 99,
            fontSize: 11, fontWeight: 'var(--fw-semibold)',
            background: statusBg, color: statusColor,
            border: `1px solid ${statusBg}`,
          }}>
            {isPaused ? tx('paused', lang) : tx('active', lang)}
          </span>
          <button
            className="icon-btn"
            onClick={() => setExpanded(e => !e)}
            aria-label={lang === 'en' ? 'Toggle details' : lang === 'es' ? 'Ver detalles' : lang === 'it' ? 'Dettagli' : 'Afficher les détails'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Résumé produits */}
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {sub.items.map(it => (
          <span key={it.id} style={{
            fontSize: 12, padding: '2px 8px',
            background: 'var(--bg3)', borderRadius: 99,
            border: '1px solid var(--border)', color: 'var(--text2)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {it.product.emoji && <span style={{ fontSize: 13 }}>{it.product.emoji}</span>}
            {it.product.name} ×{it.quantity}
          </span>
        ))}
        {sub.items.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text4)' }}>{tx('no_items', lang)}</span>
        )}
      </div>

      {/* Total + note */}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>{tx('total', lang)}</span>
            <span style={{
              fontWeight: 'var(--fw-semibold)', fontSize: 14,
              fontFamily: 'var(--font-mono, monospace)',
            }}>{fmt(total)}</span>
          </div>
          {sub.note && <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{sub.note}</p>}
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn-primary"
          style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={onLoadCart}
          disabled={sub.items.length === 0}
        >
          <ShoppingCart size={13} /> {tx('load_cart', lang)}
        </button>
        {canManage && <>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={onEdit}
          >
            <Pencil size={12} /> {tx('edit', lang)}
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={onToggle}
          >
            {isPaused
              ? <><Play size={12} /> {tx('resume', lang)}</>
              : <><Pause size={12} /> {tx('pause', lang)}</>
            }
          </button>
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}
            onClick={onDelete}
          >
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
  const canManage = canAccess(user?.role, 'orders')
  const navigate  = useNavigate()
  const { setCart } = useAppStore()
  const fmt = useFormatAmount()

  const [subs, setSubs]       = useState<Sub[]>([])
  const [due, setDue]         = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<{ open: boolean; sub: Sub | null }>({ open: false, sub: null })

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
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{
            fontWeight: 'var(--fw-semibold)', fontSize: 22, margin: 0,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <RefreshCw size={20} color="var(--p2)" /> {tx('title', lang)}
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>
            {tx('subtitle', lang)}
          </p>
        </div>
        {canManage && (
          <button
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setModal({ open: true, sub: null })}
          >
            <Plus size={15} /> {tx('new', lang)}
          </button>
        )}
      </div>

      {/* Stats rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: tx('active', lang),    value: active.length, color: 'var(--acc2)' },
          { label: tx('paused', lang),    value: paused.length, color: 'var(--warn)' },
          { label: tx('due_today', lang), value: due.length,    color: 'var(--p2)'  },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', padding: '14px 16px',
          }}>
            <div style={{
              fontSize: 22, fontWeight: 'var(--fw-bold)',
              color: s.color, fontFamily: 'var(--font-mono, monospace)',
            }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Dus aujourd'hui */}
      {due.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{
            fontWeight: 'var(--fw-semibold)', fontSize: 15, marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <ShoppingCart size={15} color="var(--p2)" /> {tx('due_today', lang)}
            <span style={{
              fontSize: 12, background: 'var(--p2)', color: '#fff',
              borderRadius: 99, padding: '1px 8px',
              fontWeight: 'var(--fw-semibold)', marginLeft: 4,
            }}>{due.length}</span>
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
        <h2 style={{ fontWeight: 'var(--fw-semibold)', fontSize: 15, marginBottom: 12 }}>
          {tx('all', lang)}
        </h2>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => (
              <div key={i} className="skeleton" style={{ height: 96, borderRadius: 'var(--r-lg)' }} />
            ))}
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
        <SubscriptionModal
          lang={lang}
          sub={modal.sub}
          onClose={() => setModal({ open: false, sub: null })}
          onSaved={() => { setModal({ open: false, sub: null }); load() }}
        />
      )}
    </main>
  )
}
