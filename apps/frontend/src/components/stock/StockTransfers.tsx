import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/hooks/useI18n'
import { stockTransfersApi, productsApi, type StockTransfer } from '@/lib/api'
import { confirm } from '@/lib/confirm'
import { announce } from '@/lib/announce'
import { ArrowLeftRight, Plus, ArrowRight, Check, X, Package, Loader2, Search } from 'lucide-react'

const MANAGER_ROLES = ['MANAGER', 'ADMIN', 'SUPER_ADMIN']

type StatusFilter = 'all' | 'pending' | 'completed' | 'cancelled'

const STATUS_META: Record<string, { bg: string; border: string; fr: string; en: string; es: string; it: string }> = {
  pending:   { bg: 'var(--c-orange-bg)', border: 'var(--c-orange-border)', fr: 'En attente', en: 'Pending',   es: 'Pendiente', it: 'In attesa' },
  completed: { bg: 'var(--c-green-bg)',  border: 'var(--c-green-border)',  fr: 'Complété',   en: 'Completed', es: 'Completado', it: 'Completato' },
  cancelled: { bg: 'var(--c-red-bg)',    border: 'var(--c-red-border)',    fr: 'Annulé',     en: 'Cancelled', es: 'Cancelado', it: 'Annullato' },
}

export default function StockTransfers() {
  const { i, lang } = useI18n()
  const { tenants, activeTenantId, user } = useAuthStore()
  const isManager = MANAGER_ROLES.includes(String(user?.role).toUpperCase())

  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [actingId, setActingId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const load = () => {
    setLoading(true)
    stockTransfersApi.list()
      .then(setTransfers)
      .catch(() => toast.error(i('Chargement impossible', 'Loading failed', 'Carga fallida', 'Caricamento fallito')))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(
    () => filter === 'all' ? transfers : transfers.filter(t => t.status === filter),
    [transfers, filter],
  )

  const statusLabel = (s: string) => {
    const m = STATUS_META[s]; return m ? m[lang as 'fr'] ?? m.fr : s
  }

  const doConfirm = async (t: StockTransfer) => {
    const ok = await confirm({
      title: i('Confirmer la réception ?', 'Confirm reception?', '¿Confirmar recepción?', 'Confermare la ricezione?'),
      message: i(`${t.quantity} × ${t.product?.name} seront ajoutés à votre stock.`, `${t.quantity} × ${t.product?.name} will be added to your stock.`, `${t.quantity} × ${t.product?.name} se añadirán a su stock.`, `${t.quantity} × ${t.product?.name} saranno aggiunti al tuo stock.`),
      danger: false,
    })
    if (!ok) return
    setActingId(t.id)
    try {
      await stockTransfersApi.confirm(t.id)
      announce(i('Transfert confirmé', 'Transfer confirmed', 'Transferencia confirmada', 'Trasferimento confermato'))
      toast.success(i('Réception confirmée', 'Reception confirmed', 'Recepción confirmada', 'Ricezione confermata'))
      load()
    } catch (e: any) {
      toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore'))
    } finally { setActingId(null) }
  }

  const doCancel = async (t: StockTransfer, isReceiver: boolean) => {
    const ok = await confirm({
      title: isReceiver ? i('Refuser le transfert ?', 'Refuse transfer?', '¿Rechazar transferencia?', 'Rifiutare il trasferimento?') : i('Annuler le transfert ?', 'Cancel transfer?', '¿Cancelar transferencia?', 'Annullare il trasferimento?'),
      message: i('Le stock sera restitué à la boutique source.', 'Stock will be returned to the source shop.', 'El stock será devuelto a la tienda de origen.', 'Lo stock sarà restituito al negozio di origine.'),
      danger: true,
    })
    if (!ok) return
    setActingId(t.id)
    try {
      await stockTransfersApi.cancel(t.id)
      announce(i('Transfert annulé', 'Transfer cancelled', 'Transferencia cancelada', 'Trasferimento annullato'))
      toast.success(i('Transfert annulé', 'Transfer cancelled', 'Transferencia cancelada', 'Trasferimento annullato'))
      load()
    } catch (e: any) {
      toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore'))
    } finally { setActingId(null) }
  }

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all',       label: i('Tous', 'All', 'Todos', 'Tutti') },
    { key: 'pending',   label: i('En attente', 'Pending', 'Pendientes', 'In attesa') },
    { key: 'completed', label: i('Complétés', 'Completed', 'Completados', 'Completati') },
    { key: 'cancelled', label: i('Annulés', 'Cancelled', 'Cancelados', 'Annullati') },
  ]

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Barre d'actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 12px', borderRadius: 'var(--r-full)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)',
                border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font)',
                background: filter === f.key ? 'var(--p)' : 'transparent',
                color: filter === f.key ? '#fff' : 'var(--text2)',
              }}>{f.label}</button>
          ))}
        </div>
        {isManager && (
          <button type="button" onClick={() => setShowModal(true)}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--p)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
            <Plus size={14} /> {i('Nouveau transfert', 'New transfer', 'Nueva transferencia', 'Nuovo trasferimento')}
          </button>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}><Loader2 size={20} style={{ animation: 'spin .6s linear infinite' }} /></div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>
          <ArrowLeftRight size={36} strokeWidth={1.5} style={{ marginBottom: 10, opacity: 0.5 }} />
          <div style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)' }}>{i('Aucun transfert', 'No transfers', 'Sin transferencias', 'Nessun trasferimento')}</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text3)' }}>
                {[i('De', 'From', 'De', 'Da'), i('Vers', 'To', 'A', 'A'), i('Produit', 'Product', 'Producto', 'Prodotto'), i('Qté', 'Qty', 'Cant.', 'Qtà'), i('Statut', 'Status', 'Estado', 'Stato'), i('Date', 'Date', 'Fecha', 'Data'), ''].map((h, idx) => (
                  <th key={idx} style={{ padding: '10px 16px', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-caption)', textTransform: 'uppercase', letterSpacing: '.4px', textAlign: idx === 3 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const isReceiver = t.toTenantId === activeTenantId
                const isSender = t.fromTenantId === activeTenantId
                const meta = STATUS_META[t.status]
                const acting = actingId === t.id
                return (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{t.fromTenant?.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                        <ArrowRight size={12} style={{ color: 'var(--text4)' }} />{t.toTenant?.name}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
                        <span>{t.product?.emoji ?? '📦'}</span>{t.product?.name}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{t.quantity}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--r-full)', fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-semibold)', background: meta?.bg, border: `1px solid ${meta?.border}`, color: 'var(--text)' }}>{statusLabel(t.status)}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{new Date(t.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {t.status === 'pending' && isManager && (
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {isReceiver && (
                            <button type="button" disabled={acting} onClick={() => doConfirm(t)} title={i('Confirmer la réception', 'Confirm reception', 'Confirmar recepción', 'Conferma ricezione')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--c-green-border)', background: 'var(--c-green-bg)', color: 'var(--text)', cursor: acting ? 'default' : 'pointer', fontFamily: 'var(--font)', fontSize: 'var(--fs-label)', fontWeight: 700 }}>
                              {acting ? <Loader2 size={12} style={{ animation: 'spin .6s linear infinite' }} /> : <Check size={12} />} {i('Confirmer', 'Confirm', 'Confirmar', 'Conferma')}
                            </button>
                          )}
                          {(isReceiver || isSender) && (
                            <button type="button" disabled={acting} onClick={() => doCancel(t, isReceiver)} title={isReceiver ? i('Refuser', 'Refuse', 'Rechazar', 'Rifiuta') : i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--c-red-border)', background: 'var(--c-red-bg)', color: 'var(--text)', cursor: acting ? 'default' : 'pointer', fontFamily: 'var(--font)', fontSize: 'var(--fs-label)', fontWeight: 700 }}>
                              <X size={12} /> {isReceiver ? i('Refuser', 'Refuse', 'Rechazar', 'Rifiuta') : i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <NewTransferModal
          tenants={tenants.filter(t => t.id !== activeTenantId)}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── Modal nouveau transfert ──────────────────────────────────────────────────
function NewTransferModal({ tenants, onClose, onCreated }: { tenants: { id: string; name: string }[]; onClose: () => void; onCreated: () => void }) {
  const { i } = useI18n()
  const [products, setProducts] = useState<any[]>([])
  const [toTenantId, setToTenantId] = useState('')
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { productsApi.list().then(setProducts).catch(() => {}) }, [])

  const matches = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => p.stockQty > 0 && (!q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))).slice(0, 8)
  }, [products, search])
  const selected = products.find(p => p.id === productId)
  const maxQty = selected?.stockQty ?? 0

  const submit = async () => {
    if (!toTenantId) { toast.error(i('Choisissez une boutique', 'Choose a shop', 'Elige una tienda', 'Scegli un negozio')); return }
    if (!productId) { toast.error(i('Choisissez un produit', 'Choose a product', 'Elige un producto', 'Scegli un prodotto')); return }
    if (quantity < 1 || quantity > maxQty) { toast.error(i(`Quantité entre 1 et ${maxQty}`, `Quantity between 1 and ${maxQty}`, `Cantidad entre 1 y ${maxQty}`, `Quantità tra 1 e ${maxQty}`)); return }
    setBusy(true)
    try {
      await stockTransfersApi.create({ toTenantId, productId, quantity, note: note.trim() || undefined })
      toast.success(i('Transfert créé', 'Transfer created', 'Transferencia creada', 'Trasferimento creato'))
      onCreated()
    } catch (e: any) {
      toast.error(e?.message ?? i('Erreur', 'Error', 'Error', 'Errore'))
    } finally { setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div role="dialog" aria-modal aria-label={i('Nouveau transfert', 'New transfer', 'Nueva transferencia', 'Nuovo trasferimento')} className="modal-box"
        style={{ width: '90%', maxWidth: 480, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <ArrowLeftRight size={16} style={{ color: 'var(--p2)' }} />
          <span style={{ flex: 1, fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>{i('Nouveau transfert', 'New transfer', 'Nueva transferencia', 'Nuovo trasferimento')}</span>
          <button onClick={onClose} aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          <div>
            <label style={lbl}>{i('Boutique destination', 'Destination shop', 'Tienda destino', 'Negozio destinazione')} *</label>
            <select className="input" value={toTenantId} onChange={e => setToTenantId(e.target.value)}>
              <option value="">{i('Choisir…', 'Choose…', 'Elegir…', 'Scegli…')}</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>{i('Produit', 'Product', 'Producto', 'Prodotto')} *</label>
            {selected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--p3)', background: 'var(--bg3)' }}>
                <span>{selected.emoji ?? '📦'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{selected.name}</div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{i('Stock', 'Stock', 'Stock', 'Stock')}: {selected.stockQty}</div>
                </div>
                <button type="button" onClick={() => { setProductId(''); setSearch('') }} aria-label={i('Effacer', 'Clear', 'Borrar', 'Cancella')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={14} /></button>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                  <input className="input" style={{ paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={i('Rechercher un produit…', 'Search a product…', 'Buscar producto…', 'Cerca prodotto…')} />
                </div>
                {search && (
                  <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                    {matches.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 'var(--fs-label)', color: 'var(--text3)', textAlign: 'center' }}>{i('Aucun produit en stock', 'No product in stock', 'Sin productos en stock', 'Nessun prodotto in stock')}</div>
                    ) : matches.map(p => (
                      <button key={p.id} type="button" onClick={() => { setProductId(p.id); setQuantity(1) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left' }}>
                        <span>{p.emoji ?? '📦'}</span>
                        <span style={{ flex: 1, fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>{p.name}</span>
                        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>{p.stockQty}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {selected && (
            <div>
              <label style={lbl}>{i('Quantité', 'Quantity', 'Cantidad', 'Quantità')} * <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(max {maxQty})</span></label>
              <input className="input" type="number" min={1} max={maxQty} value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(maxQty, Number(e.target.value))))} />
              <div style={{ marginTop: 6, fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>
                {i('Stock source', 'Source stock', 'Stock origen', 'Stock origine')}: {maxQty} → <span style={{ fontWeight: 'var(--fw-semibold)', color: quantity > 0 ? 'var(--warn)' : 'var(--text2)' }}>{maxQty - quantity}</span>
              </div>
            </div>
          )}

          <div>
            <label style={lbl}>{i('Note (optionnel)', 'Note (optional)', 'Nota (opcional)', 'Nota (opzionale)')}</label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600 }}>
            {i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
          </button>
          <button type="button" disabled={busy} onClick={submit} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 11, borderRadius: 10, border: 'none', background: 'var(--p)', color: '#fff', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font)', fontWeight: 800 }}>
            {busy ? <Loader2 size={15} style={{ animation: 'spin .6s linear infinite' }} /> : <ArrowLeftRight size={15} />}
            {i('Créer le transfert', 'Create transfer', 'Crear transferencia', 'Crea trasferimento')}
          </button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 6 }
