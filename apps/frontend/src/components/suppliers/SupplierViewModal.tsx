import { useConfig, useFormatAmount, t } from '@/stores/appStore'
import IconButton from '@/components/ui/IconButton'
import { useI18n } from '@/hooks/useI18n'
import { useModalFocus } from '@/hooks/useModalFocus'
import { Factory, X, Package, FileText } from 'lucide-react'
import { STATUS_CFG, statusLabel, StarRating } from './suppliersShared'
import type { Supplier } from './suppliersShared'

interface Props {
  supplier: Supplier
  onClose: () => void
  onNewOrder: () => void
}

export default function SupplierViewModal({ supplier, onClose, onNewOrder }: Props) {
  const { lang } = useConfig()
  const fmt = useFormatAmount()
  const { i } = useI18n()
  const boxRef = useModalFocus<HTMLDivElement>()

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={supplier.name} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth: 580 }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}><Factory size={15}/> {supplier.name}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{supplier.contact} · {supplier.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${STATUS_CFG[supplier.status].cls}`}>{statusLabel(supplier.status, lang)}</span>
            <IconButton label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} icon={<X size={14} />} onClick={onClose} variant="surface" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: i('Téléphone', 'Phone', 'Teléfono', 'Telefono'),       value: supplier.phone },
            { label: 'Email',           value: supplier.email },
            { label: i('Délai livraison', 'Lead time', 'Plazo entrega', 'Tempo consegna'), value: `${supplier.leadTime} ${i('jours', 'days', 'días', 'giorni')}` },
            { label: i('Catégories', 'Categories', 'Categorías', 'Categorie'),      value: supplier.categories.join(', ') },
          ].map(f => (
            <div key={f.label} className="p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
              <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>{f.label}</div>
              <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{f.value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: 'var(--bg3)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>{i('Note', 'Rating', 'Valoración', 'Valutazione')} :</span>
          <StarRating rating={supplier.rating} />
          <span className="text-sm font-bold" style={{ color: 'var(--acc)' }}>{(Number(supplier.rating) || 0) > 0 ? `${(Number(supplier.rating) || 0).toFixed(1)}/5` : '—'}</span>
        </div>

        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>{i('Historique commandes', 'Order history', 'Historial de pedidos', 'Storico ordini')}</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">{i('Référence', 'Reference', 'Referencia', 'Riferimento')}</th><th scope="col">{i('Date', 'Date', 'Fecha', 'Data')}</th><th scope="col">{i('Montant', 'Amount', 'Importe', 'Importo')}</th><th scope="col">{t('col_status')}</th></tr></thead>
              <tbody>
                {supplier.orders.map(o => (
                  <tr key={o.ref}>
                    <td className="td-mono text-xs">{o.ref}</td>
                    <td className="td-mono text-xs">{new Date(o.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'en-US')}</td>
                    <td className="td-num text-xs" style={{ color: 'var(--acc2)' }}>{fmt(o.total)}</td>
                    <td>
                      <span className={`badge ${
                        o.status === 'REÇUE'      ? 'badge-green'  :
                        o.status === 'EN TRANSIT' ? 'badge-amber'  :
                        o.status === 'CONFIRMÉE'  ? 'badge-violet' :
                        o.status === 'ENVOYÉE'    ? 'badge-blue'   : 'badge-gray'
                      }`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
                {supplier.orders.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-4" style={{ color: 'var(--text3)' }}>{i('Aucune commande', 'No orders', 'Sin pedidos', 'Nessun ordine')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {supplier.notes && (
          <div className="p-3 rounded-xl text-xs mb-4"
            style={{ background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.2)', color: 'var(--acc)', display:'flex', gap:6, alignItems:'flex-start' }}>
            <FileText size={12} style={{ flexShrink:0, marginTop:1 }}/> {supplier.notes}
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn btn-primary flex-1 justify-center"
            style={{ display:'flex', alignItems:'center', gap:6 }}
            onClick={onNewOrder}>
            <Package size={13}/> {i('Nouvelle commande', 'New order', 'Nuevo pedido', 'Nuovo ordine')}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>{i('Fermer', 'Close', 'Cerrar', 'Chiudi')}</button>
        </div>
      </div>
    </div>
  )
}
