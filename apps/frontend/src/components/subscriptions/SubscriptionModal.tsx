import { useState, useEffect } from 'react'
import {
  RefreshCw, User, X, Check, Minus, Plus, Calendar, Package,
  FileText, Tag, ShoppingCart, Search, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { subscriptionsApi, customersApi, productsApi } from '@/lib/api'
import { useAppStore, useFormatAmount, formatDate } from '@/stores/appStore'
import { announce } from '@/lib/announce'
import { useModalFocus } from '@/hooks/useModalFocus'
import { DateField } from '@/components/ui/DatePicker'
import {
  DAY_SHORT, DAY_LABELS, tx, totalAmountColor, missingSubscriptionFields, missingLabel,
  subscriptionTotal, firstDeliveryFrom, toDateInput,
  type Sub, type SubCustomer, type SubProduct, type DraftItem,
} from './subscriptionShared'
import ProductThumb from '@/components/ui/ProductThumb'

interface Props {
  lang: string
  sub?: Sub | null
  onClose: () => void
  onSaved: () => void
}

/** Libellé de section — petit, discret : la hiérarchie se joue ailleurs. */
function SLabel({ icon, label, required, badge, muted }: {
  icon?: JSX.Element; label: string; required?: boolean; badge?: number; muted?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
      {icon}
      <span style={{
        fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: muted ? 'var(--text4)' : 'var(--text3)', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      {required && <span aria-hidden style={{ color: 'var(--p2)', fontSize: 'var(--fs-sm)', lineHeight: 1 }}>*</span>}
      {badge !== undefined && badge > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 'var(--fw-semibold)',
          padding: '1px 6px', borderRadius: 'var(--r-full, 99px)',
          background: 'var(--p2)', color: '#fff',
        }}>{badge}</span>
      )}
    </div>
  )
}

export default function SubscriptionModal({ lang, sub, onClose, onSaved }: Props) {
  const boxRef = useModalFocus<HTMLDivElement>()
  const fmt = useFormatAmount()
  const theme = useAppStore(s => s.theme)
  const amountColor = totalAmountColor(theme)

  const [name, setName]   = useState(sub?.name ?? '')
  // AUCUNE présélection : un jour préchoisi en douce est un faux « prêt ».
  const [dow, setDow]     = useState<number | null>(sub?.dayOfWeek ?? null)
  const [startDate, setStartDate] = useState(toDateInput(sub?.startDate))
  const [note, setNote]   = useState(sub?.note ?? '')
  const [saving, setSaving] = useState(false)

  const [custSearch, setCustSearch]   = useState('')
  const [custResults, setCustResults] = useState<SubCustomer[]>([])
  const [customer, setCustomer]       = useState<SubCustomer | null>(sub?.customer ?? null)
  const [showCust, setShowCust]       = useState(false)

  const [prodSearch, setProdSearch]   = useState('')
  const [prodResults, setProdResults] = useState<SubProduct[]>([])
  const [showProd, setShowProd]       = useState(false)
  const [items, setItems]             = useState<DraftItem[]>(
    sub?.items.map(it => ({ productId: it.productId, quantity: it.quantity, product: it.product })) ?? []
  )

  useEffect(() => {
    if (custSearch.length < 2) { setCustResults([]); return }
    const t = setTimeout(() => {
      customersApi.search(custSearch)
        // Frontière : l'API rend `phone: string | null`, le domaine `SubCustomer` veut
        // `string | undefined`. La traversée est explicite plutôt que masquée par un cast.
        .then(r => setCustResults(r.slice(0, 6).map(c => ({ ...c, phone: c.phone ?? undefined }))))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch])

  useEffect(() => {
    if (prodSearch.length < 2) { setProdResults([]); return }
    const t = setTimeout(() => {
      productsApi.list()
        .then((r: (SubProduct & { deletedAt?: string | null })[]) => {
          const q = prodSearch.toLowerCase()
          setProdResults(r.filter(p => p.name.toLowerCase().includes(q) && !p.deletedAt).slice(0, 8))
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

  const total   = subscriptionTotal(items)
  const missing = missingSubscriptionFields({
    hasCustomer: !!customer, name, itemCount: items.length, dayOfWeek: dow,
  })
  const canSave = missing.length === 0 && !saving

  const shortDays = DAY_SHORT[lang] ?? DAY_SHORT.fr
  const longDays  = DAY_LABELS[lang] ?? DAY_LABELS.fr
  const firstDelivery = firstDeliveryFrom(startDate, dow, new Date())

  const save = async () => {
    if (missing.length > 0 || dow === null || !customer) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        dayOfWeek: dow,
        startDate: startDate || null,
        customerId: customer.id,
        note: note.trim() || null,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      }
      if (sub) await subscriptionsApi.update(sub.id, payload)
      else     await subscriptionsApi.create(payload)
      toast.success(tx('saved', lang)); announce(tx('saved', lang))
      onSaved()
    } catch {
      toast.error(tx('err_save', lang))
    } finally { setSaving(false) }
  }

  return (
    <>
      <style>{`
        @keyframes subModalIn {
          from { opacity: 0; transform: scale(0.97) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) { .sub-modal-animated { animation-duration: 0.01ms !important; } }
        .sub-stepper-btn:hover:not(:disabled) { background: var(--bg3) }
        .sub-remove-btn:hover  { color: var(--danger) }
        .sub-dd-item:hover     { background: var(--bg3) }
        .sub-day-pill:hover:not([aria-pressed="true"]) { border-color: var(--p); color: var(--p) }
        .sub-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px }
        @media (max-width: 640px) { .sub-grid2 { grid-template-columns: 1fr } }

        /* Ligne de panier : une seule rangée en large. */
        .sub-line { display: flex; align-items: center; gap: 10px; padding: 9px 2px }
        .sub-line-nm { flex: 1; min-width: 0 }
        .sub-line-break { display: none }
        .sub-total { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px }
        .sub-total-v { font-size: 29px; white-space: nowrap }

        /* Étroit : le nom prend sa rangée, les contrôles passent dessous — sinon
           le stepper écrase le nom et le sous-total chevauche (mesuré à 390 px). */
        @media (max-width: 560px) {
          .sub-line { flex-wrap: wrap; row-gap: 8px }
          .sub-line-break { display: block; flex-basis: 100%; height: 0 }
          .sub-line-qty { margin-left: 42px }
          .sub-line-sub { flex: 1; text-align: right }
          .sub-total { flex-direction: column; align-items: flex-start; gap: 4px }
          .sub-total-v { font-size: 26px }
        }
      `}</style>

      <div
        className="modal-backdrop"
        role="dialog"
        aria-modal
        aria-label={sub ? tx('edit', lang) : tx('new', lang)}
        onClick={onClose}
      >
        <div
          className="modal-box sub-modal sub-modal-animated"
          ref={boxRef}
          style={{
            maxWidth: 600, width: '100%', padding: 0,
            display: 'flex', flexDirection: 'column',
            maxHeight: 'min(92vh, 760px)', overflow: 'hidden',
            animation: 'subModalIn 200ms ease-out both',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ height: 3, background: 'var(--grad-p)', flexShrink: 0 }} />

          {/* ── En-tête ── */}
          <div style={{
            padding: '15px 18px 13px', flexShrink: 0,
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 13,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 'var(--r-md)', flexShrink: 0,
              background: 'var(--grad-p)', boxShadow: 'var(--sh-p)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RefreshCw size={20} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-md)', color: 'var(--text)', lineHeight: 1.25 }}>
                {sub ? tx('edit', lang) : tx('new', lang)}
              </div>
              <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)', marginTop: 2 }}>{tx('modal_sub', lang)}</div>
            </div>
            <button className="icon-btn" onClick={onClose} aria-label={tx('cancel', lang)} style={{ flexShrink: 0, width: 32, height: 32 }}>
              <X size={16} />
            </button>
          </div>

          {/* ── Corps défilant ── */}
          <div className="sub-body" style={{ flex: 1, overflowY: 'auto', padding: 18 }}>

            {/* Identité — bandeau compact 2 colonnes */}
            <div className="sub-grid2">
              <div style={{ position: 'relative' }}>
                <SLabel icon={<User size={13} color="var(--p2)" />} label={tx('customer_label', lang)} required />
                {customer ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '8px 11px', minHeight: 42,
                    background: 'color-mix(in srgb, var(--p2) 7%, var(--bg2))',
                    borderRadius: 'var(--r-md)',
                    border: '1.5px solid color-mix(in srgb, var(--p2) 28%, transparent)',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--grad-p)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <User size={14} color="#fff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13.5, fontWeight: 'var(--fw-semibold)', color: 'var(--text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{customer.name}</div>
                      {customer.phone && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{customer.phone}</div>}
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => { setCustomer(null); setCustSearch('') }}
                      aria-label={tx('change_cust', lang)}
                      style={{ color: 'var(--text3)', flexShrink: 0 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      id="sub-customer"
                      className="input"
                      aria-label={tx('search_cust', lang)}
                      value={custSearch}
                      onChange={e => { setCustSearch(e.target.value); setShowCust(true) }}
                      placeholder={tx('search_cust', lang)}
                      onFocus={() => setShowCust(true)}
                      autoFocus
                      style={{ width: '100%', minHeight: 42 }}
                    />
                    {showCust && custResults.length > 0 && (
                      <div role="listbox" aria-label={tx('customer_label', lang)} style={{
                        position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0,
                        background: 'var(--bg2)', border: '1px solid var(--border)',
                        borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-lg)', overflow: 'hidden',
                      }}>
                        {custResults.map(c => (
                          <button
                            key={c.id} role="option" aria-selected={false} className="sub-dd-item"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                              padding: '10px 12px', minHeight: 44, background: 'none', border: 'none',
                              cursor: 'pointer', color: 'var(--text)', transition: 'background .12s',
                            }}
                            onMouseDown={() => { setCustomer(c); setCustSearch(''); setShowCust(false) }}
                          >
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                              background: 'color-mix(in srgb, var(--p2) 13%, var(--bg3))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <User size={13} color="var(--p2)" />
                            </div>
                            <div>
                              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>{c.name}</div>
                              {c.phone && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{c.phone}</div>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <SLabel icon={<Tag size={13} color="var(--p2)" />} label={tx('name_label', lang)} required />
                <input
                  id="sub-name"
                  className="input"
                  aria-label={tx('name_label', lang)}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={tx('name_ph', lang)}
                  style={{ width: '100%', minHeight: 42 }}
                />
              </div>
            </div>

            {/* ── PANIER — seul bloc en relief ── */}
            <section
              aria-label={tx('cart_label', lang)}
              style={{
                background: 'var(--card)', border: '1.5px solid var(--border2)',
                borderRadius: 'var(--r-lg)', padding: 14, margin: '16px 0',
              }}
            >
              <SLabel
                icon={<ShoppingCart size={14} color="var(--p2)" />}
                label={tx('cart_label', lang)}
                required
                badge={items.length}
              />

              <div style={{ position: 'relative', marginBottom: 11 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    id="sub-product-search"
                    className="input"
                    aria-label={tx('cart_search', lang)}
                    value={prodSearch}
                    onChange={e => { setProdSearch(e.target.value); setShowProd(true) }}
                    placeholder={tx('cart_search', lang)}
                    onFocus={() => setShowProd(true)}
                    style={{ paddingLeft: 34, width: '100%', minHeight: 42, background: 'var(--bg3)' }}
                  />
                  <Search size={15} style={{
                    position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text4)', pointerEvents: 'none',
                  }} />
                </div>
                {showProd && prodResults.length > 0 && (
                  <div role="listbox" aria-label={tx('products_label', lang)} style={{
                    position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-lg)', overflow: 'hidden',
                  }}>
                    {prodResults.map(p => (
                      <button
                        key={p.id} role="option" aria-selected={false} className="sub-dd-item"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                          padding: '10px 12px', minHeight: 44, background: 'none', border: 'none',
                          cursor: 'pointer', color: 'var(--text)', transition: 'background .12s',
                        }}
                        onMouseDown={() => addProduct(p)}
                      >
                        <ProductThumb
                          p={p} size={28} radius="var(--r-sm)" fontSize="var(--fs-title)"
                          style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
                          fallback={<Package size={13} color="var(--text4)" />}
                        />
                        <span style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>{p.name}</span>
                        <span style={{ fontSize: 'var(--fs-label)', flexShrink: 0, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                          {fmt(p.sellPrice)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {items.length === 0 ? (
                <div style={{
                  border: '1.5px dashed var(--border2)', borderRadius: 'var(--r-md)',
                  padding: '22px 14px', textAlign: 'center', color: 'var(--text4)',
                }}>
                  <ShoppingCart size={26} aria-hidden />
                  <div style={{ fontSize: 13.5, color: 'var(--text2)', fontWeight: 'var(--fw-semibold)', margin: '8px 0 3px' }}>
                    {tx('cart_empty', lang)}
                  </div>
                  <p style={{ fontSize: 'var(--fs-label)', margin: 0 }}>{tx('cart_empty_s', lang)}</p>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {items.map((it, idx) => (
                    <li
                      key={it.productId}
                      className="sub-line"
                      style={{ borderBottom: idx === items.length - 1 ? 'none' : '1px solid var(--border)' }}
                    >
                      {/* L'emoji est du contenu marchand, pas une icône d'UI. */}
                      <ProductThumb
                        p={it.product} size={32} radius="var(--r-sm)" fontSize="var(--fs-md)"
                        style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}
                        fallback={<Package size={14} color="var(--text4)" />}
                      />

                      <div className="sub-line-nm">
                        <div style={{
                          fontSize: 13.5, fontWeight: 'var(--fw-semibold)', color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{it.product.name}</div>
                        {/* Mono comme le sous-total : les deux montants d'une même ligne
                            doivent s'aligner à l'œil, séparateur de milliers compris. */}
                        <div style={{ fontSize: 11.5, color: 'var(--text4)', marginTop: 1, fontFamily: 'var(--mono)' }}>
                          {fmt(it.product.sellPrice)} {tx('per_unit', lang)}
                        </div>
                      </div>

                      {/* Point de rupture : invisible en large, force la 2e rangée en étroit. */}
                      <span className="sub-line-break" aria-hidden />

                      <div className="sub-line-qty" style={{
                        display: 'flex', alignItems: 'center', flexShrink: 0,
                        border: '1px solid var(--border2)', borderRadius: 'var(--r-sm)',
                        overflow: 'hidden', background: 'var(--bg)',
                      }}>
                        <button
                          type="button" className="sub-stepper-btn"
                          onClick={() => updateQty(it.productId, it.quantity - 1)}
                          aria-label={`${tx('dec_qty', lang)} — ${it.product.name}`}
                          style={{
                            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                            transition: 'background .12s',
                          }}
                        >
                          <Minus size={12} />
                        </button>
                        <span
                          aria-label={`${tx('qty_label', lang)} — ${it.product.name}`}
                          style={{
                            minWidth: 30, textAlign: 'center', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)',
                            color: 'var(--text)', userSelect: 'none', fontFamily: 'var(--mono)',
                          }}
                        >{it.quantity}</span>
                        <button
                          type="button" className="sub-stepper-btn"
                          onClick={() => updateQty(it.productId, it.quantity + 1)}
                          aria-label={`${tx('inc_qty', lang)} — ${it.product.name}`}
                          style={{
                            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                            transition: 'background .12s',
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <span
                        className="sub-line-sub"
                        aria-label={`${tx('line_sub', lang)} — ${it.product.name}`}
                        style={{
                          minWidth: 82, textAlign: 'right', flexShrink: 0,
                          fontSize: 13.5, fontWeight: 'var(--fw-semibold)',
                          color: 'var(--text)', fontFamily: 'var(--mono)',
                        }}
                      >{fmt(it.product.sellPrice * it.quantity)}</span>

                      <button
                        type="button" className="icon-btn sub-remove-btn"
                        onClick={() => updateQty(it.productId, 0)}
                        aria-label={`${tx('remove_prod', lang)} — ${it.product.name}`}
                        style={{ color: 'var(--text4)', flexShrink: 0, transition: 'color .15s' }}
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Récurrence ── */}
            <SLabel icon={<Calendar size={13} color="var(--p2)" />} label={tx('recurrence', lang)} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', fontSize: 'var(--fs-sm)', color: 'var(--text2)',
            }}>
              <RefreshCw size={15} color="var(--p2)" style={{ flexShrink: 0 }} />
              <span>
                <strong style={{ color: 'var(--text)', fontWeight: 'var(--fw-semibold)' }}>{tx('weekly', lang)}</strong>
                {' — '}{tx('weekly_expl', lang)}
              </span>
            </div>

            <div style={{ marginTop: 13 }}>
              <SLabel label={tx('day_label', lang)} required />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {shortDays.map((d, idx) => {
                  const on = dow === idx
                  return (
                    <button
                      key={idx}
                      type="button"
                      className="sub-day-pill"
                      onClick={() => setDow(idx)}
                      aria-pressed={on}
                      aria-label={longDays[idx]}
                      style={{
                        minWidth: 50, height: 34, padding: '0 12px', borderRadius: 'var(--r-full, 99px)',
                        fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)',
                        border: `1.5px ${dow === null ? 'dashed' : 'solid'} ${on ? 'var(--p)' : dow === null ? 'color-mix(in srgb, var(--warn) 45%, transparent)' : 'var(--border2)'}`,
                        background: on ? 'var(--p)' : 'var(--bg3)',
                        color: on ? '#fff' : 'var(--text2)',
                        cursor: 'pointer',
                        transition: 'border-color .15s var(--ease), background .15s var(--ease), color .15s var(--ease)',
                        boxShadow: on ? '0 2px 8px color-mix(in srgb, var(--p) 35%, transparent)' : 'none',
                      }}
                    >{d}</button>
                  )
                })}
              </div>
              {dow === null && (
                <div style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertCircle size={12} aria-hidden /> {tx('no_day', lang)}
                </div>
              )}
            </div>

            <div style={{ marginTop: 13 }}>
              <SLabel label={`${tx('start_date', lang)} ${tx('optional', lang)}`} />
              <DateField
                id="sub-start-date"
                ariaLabel={tx('start_date', lang)}
                value={startDate}
                onChange={setStartDate}
                style={{ width: '100%', maxWidth: 220, minHeight: 42 }}
              />
              {firstDelivery && (
                <div style={{ fontSize: 11.5, color: 'var(--text4)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Check size={12} color="var(--acc2)" aria-hidden />
                  {tx('first_deliv', lang)}{' '}
                  {formatDate(firstDelivery, lang, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                  {' · '}{tx('then_every', lang)} {longDays[dow ?? 0].toLowerCase()}
                </div>
              )}
            </div>

            {/* ── Note — reléguée ── */}
            <div style={{ marginTop: 18, paddingTop: 15, borderTop: '1px solid var(--border)' }}>
              <SLabel
                icon={<FileText size={12} color="var(--text4)" />}
                label={`${tx('note_label', lang)} ${tx('optional', lang)}`}
                muted
              />
              <textarea
                id="sub-note"
                className="input"
                aria-label={tx('note_label', lang)}
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={tx('note_ph', lang)}
                style={{ resize: 'vertical', fontFamily: 'var(--font)', minHeight: 56, width: '100%', color: 'var(--text2)' }}
              />
            </div>
          </div>

          {/* ── Pied épinglé : total + ce qui manque + actions ── */}
          <div style={{
            flexShrink: 0, borderTop: '1px solid var(--border2)',
            background: 'var(--bg)', padding: '13px 18px 15px',
          }}>
            <div className="sub-total" style={{
              padding: '11px 13px', borderRadius: 'var(--r-md)', marginBottom: 11,
              background: items.length > 0 ? 'color-mix(in srgb, var(--acc) 8%, var(--bg2))' : 'var(--bg3)',
              border: `1px solid ${items.length > 0 ? 'color-mix(in srgb, var(--acc) 22%, transparent)' : 'var(--border)'}`,
            }}>
              <div>
                <div style={{
                  fontSize: 'var(--fs-caption)', letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text3)',
                }}>{tx('total_deliv', lang)}</div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text4)', marginTop: 3 }}>{tx('at_day_price', lang)}</div>
              </div>
              <div
                aria-live="polite"
                className="sub-total-v"
                style={{
                  fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)',
                  letterSpacing: '-.5px', lineHeight: 1,
                  // Panier vide : un tiret, jamais « 0 F » — un zéro affirme un montant.
                  color: items.length > 0 ? amountColor : 'var(--text4)',
                }}
              >
                {items.length > 0 ? fmt(total) : '—'}
              </div>
            </div>

            {missing.length > 0 && (
              <div
                role="status"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 11,
                  fontSize: 'var(--fs-label)', color: 'var(--warn)', lineHeight: 1.45,
                }}
              >
                <AlertCircle size={14} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{missingLabel(missing, lang)}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={onClose}>{tx('cancel', lang)}</button>
              <button
                className="btn-primary"
                onClick={() => save()}
                // ⚠️ Éteint pendant l'ENVOI seulement. Il l'était aussi tant que des champs
                // manquaient — alors que la liste des manques est déjà affichée juste
                // au-dessus (l. 610) : le bouton n'ajoutait qu'un refus muet.
                disabled={saving}
                // Pas d'`opacity` inline : `.btn-primary:disabled` (opacity .4 + not-allowed)
                // est déjà la règle maison — une valeur en ligne la surchargerait et rendrait
                // le bouton éteint PLUS vif que partout ailleurs.
                style={{ minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {saving
                  ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <><Check size={14} />{tx('save', lang)}</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
