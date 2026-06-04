import { Package, X, FileText, Send, Inbox, XCircle, Printer } from 'lucide-react'
import IconButton from '@/components/ui/IconButton'
import toast from 'react-hot-toast'
import { useConfig, useFormatAmount } from '@/stores/appStore'
import { useI18n } from '@/hooks/useI18n'
import { type Order, type OrderStatus, STATUS_CONFIG, orderStatusLabel } from './ordersShared'

interface Props {
  order: Order
  onClose: () => void
  changeStatus: (id: string, status: OrderStatus) => void
  printOrderPDF: (order: Order) => void
}

export default function OrderDetailModal({ order, onClose, changeStatus, printOrderPDF }: Props) {
  const { lang } = useConfig()
  const { i } = useI18n()
  const fmt = useFormatAmount()
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 580 }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
              <Package size={16}/> {order.ref}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
              {order.supplier} · {new Date(order.date).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT'))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${STATUS_CONFIG[order.status].cls} flex items-center gap-1`}>
              {STATUS_CONFIG[order.status].icon} {orderStatusLabel(order.status, lang)}
            </span>
            <IconButton label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} icon={<X size={14} />} onClick={onClose} variant="surface" />
          </div>
        </div>

        {/* Infos */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: i('Fournisseur', 'Supplier', 'Proveedor', 'Fornitore'), value: order.supplier },
            { label: i('Livraison prévue', 'Expected delivery', 'Entrega prevista', 'Consegna prevista'), value: new Date(order.expectedAt).toLocaleDateString(i('fr-FR', 'en-US', 'es-ES', 'it-IT')) },
            { label: i('Montant total', 'Total amount', 'Importe total', 'Importo totale'), value: fmt(order.total) },
            { label: i('Nb articles', 'Items count', 'Nº artículos', 'N° articoli'), value: `${order.items.length} ${order.items.length > 1 ? i('lignes', 'lines', 'líneas', 'righe') : i('ligne', 'line', 'línea', 'riga')}` },
          ].map(f => (
            <div key={f.label} className="p-3 rounded-xl" style={{ background: 'var(--bg3)' }}>
              <div className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--text3)' }}>{f.label}</div>
              <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{f.value}</div>
            </div>
          ))}
        </div>

        {/* Lignes */}
        <div className="table-wrap mb-4">
          <table>
            <thead>
              <tr><th scope="col">{i('Produit', 'Product', 'Producto', 'Prodotto')}</th><th scope="col">{i('Qté', 'Qty', 'Cant.', 'Qtà')}</th><th scope="col">{i('Unité', 'Unit', 'Unidad', 'Unità')}</th><th scope="col">{i('PU', 'UP', 'PU', 'PU')}</th><th scope="col">{i('Total', 'Total', 'Total', 'Totale')}</th></tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={i}>
                  <td className="td-bold text-xs">{item.product}</td>
                  <td className="td-num text-xs">{item.qty}</td>
                  <td className="text-xs" style={{ color: 'var(--text2)' }}>{item.unit === 'unité' ? (lang === 'en' ? 'unit' : lang === 'es' ? 'unidad' : lang === 'it' ? 'unità' : 'unité') : item.unit}</td>
                  <td className="td-num text-xs">{fmt(item.unitPrice)}</td>
                  <td className="td-num text-xs" style={{ color: 'var(--acc2)' }}>{fmt(item.qty * item.unitPrice)}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--bg3)' }}>
                <td colSpan={4} className="text-xs font-bold text-right px-4 py-2">{i('TOTAL', 'TOTAL', 'TOTAL', 'TOTALE')}</td>
                <td className="td-num font-black" style={{ color: 'var(--p2)' }}>{fmt(order.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {order.notes && (
          <div className="p-3 rounded-xl text-xs mb-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--acc)', display:'flex', gap:6, alignItems:'flex-start' }}>
            <FileText size={12} style={{ flexShrink:0, marginTop:1 }}/> {order.notes}
          </div>
        )}

        {/* Actions progression */}
        <div className="flex gap-2">
          {order.status === 'BROUILLON' && (
            <button className="btn btn-primary flex-1 justify-center"
              style={{ display:'flex', alignItems:'center', gap:6 }}
              onClick={() => changeStatus(order.id, 'ENVOYÉE')}>
              <Send size={14}/> {i('Envoyer au fournisseur', 'Send to supplier', 'Enviar al proveedor', 'Invia al fornitore')}
            </button>
          )}
          {order.status === 'EN TRANSIT' && (
            <button className="btn btn-primary flex-1 justify-center"
              style={{ background: 'linear-gradient(135deg,var(--acc2),#059669)', display:'flex', alignItems:'center', gap:6 }}
              onClick={() => changeStatus(order.id, 'REÇUE')}>
              <Inbox size={14}/> {i('Confirmer la réception', 'Confirm receipt', 'Confirmar recepción', 'Conferma ricezione')}
            </button>
          )}
          {!['ANNULÉE','REÇUE'].includes(order.status) && (
            <button className="btn btn-ghost"
              style={{ display:'flex', alignItems:'center', gap:6 }}
              onClick={() => { changeStatus(order.id, 'ANNULÉE'); onClose() }}>
              <XCircle size={14}/> {i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
            </button>
          )}
          <button className="btn btn-ghost" style={{ display:'flex', alignItems:'center', gap:6 }} onClick={() => { printOrderPDF(order); toast.success(i('📄 PDF ouvert !', '📄 PDF opened!', '📄 ¡PDF abierto!', '📄 PDF aperto!')) }}><Printer size={14}/> PDF</button>
        </div>
      </div>
    </div>
  )
}
