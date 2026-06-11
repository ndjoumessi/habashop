import { useState } from 'react'
import { RotateCcw, X, AlertTriangle, PackageCheck, Info } from 'lucide-react'
import type { Lang } from '@/stores/appStore'
import { useModalFocus } from '@/hooks/useModalFocus'

interface RefundModalProps {
  sale: any | null
  onClose: () => void
  onConfirm: (reason: string, restock: boolean) => void
  saving: boolean
  lang: Lang
  fmt: (n: number) => string
}

// Moyens « mobile money » → le remboursement n'est qu'un SUIVI côté app ;
// le mouvement d'argent réel se fait manuellement/hors-app.
const TRACKING_MODES = ['wave', 'orange', 'mtn', 'mobile']

/**
 * Modale de confirmation d'annulation/remboursement (TOTAL). Centrée (modal-backdrop
 * partagé), motif OBLIGATOIRE, case « Remettre en stock » PRÉ-COCHÉE, note Wave/Orange
 * si paiement mobile. i18n fr/en/es/it. Présentationnel : délègue l'appel à onConfirm.
 */
export default function RefundModal({ sale, onClose, onConfirm, saving, lang, fmt }: RefundModalProps) {
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(true) // pré-coché (ON par défaut)
  // Piège à focus (hook AVANT le return conditionnel — règle des hooks)
  const boxRef = useModalFocus<HTMLDivElement>(!!sale)
  if (!sale) return null

  const i = (fr: string, en: string, es: string, it: string) =>
    lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  const isTracking = TRACKING_MODES.includes(String(sale.paymentMode))
  const canConfirm = reason.trim().length > 0 && !saving

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true"
      aria-label={i('Rembourser la vente', 'Refund Sale', 'Reembolsar venta', 'Rimborsa vendita')}
      onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth: 460 }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 16, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={16} style={{ color: 'var(--danger)' }} />
            {i('Rembourser la vente', 'Refund Sale', 'Reembolsar venta', 'Rimborsa vendita')}
          </span>
          <button onClick={onClose} disabled={saving} aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', width: 32, height: 32, cursor: saving ? 'default' : 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Récap vente */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--fs-label)', color: 'var(--text3)' }}>
              {i('Vente', 'Sale', 'Venta', 'Vendita')} #{String(sale.id).slice(-6).toUpperCase()}
            </span>
            <span style={{ fontSize: 18, fontWeight: 'var(--fw-bold)', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{fmt(sale.total)}</span>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text4)', marginTop: 4 }}>
            {i('Remboursement total — la vente sera conservée mais exclue du chiffre d’affaires.',
               'Total refund — the sale is kept but excluded from revenue.',
               'Reembolso total — la venta se conserva pero se excluye de los ingresos.',
               'Rimborso totale — la vendita è conservata ma esclusa dal fatturato.')}
          </div>
        </div>

        {/* Motif (obligatoire) */}
        <label style={{ display: 'block', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text3)', marginBottom: 6 }}>
          {i('Motif', 'Reason', 'Motivo', 'Motivo')} *
        </label>
        <textarea
          className="input"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          autoFocus
          placeholder={i('Ex. produit défectueux, erreur de caisse…', 'E.g. faulty product, checkout error…', 'Ej. producto defectuoso, error de caja…', 'Es. prodotto difettoso, errore di cassa…')}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font)', fontSize: 13, marginBottom: 14 }}
        />

        {/* Remettre en stock (pré-coché) */}
        <button type="button" role="checkbox" aria-checked={restock} onClick={() => setRestock(r => !r)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer', background: restock ? 'var(--c-green-bg2)' : 'var(--bg3)', border: `1px solid ${restock ? 'var(--c-green-border)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 14 }}>
          <span style={{ width: 18, height: 18, borderRadius: 'var(--r-xs)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: restock ? 'var(--acc2)' : 'transparent', border: `1.5px solid ${restock ? 'var(--acc2)' : 'var(--text4)'}` }}>
            {restock && <PackageCheck size={12} style={{ color: '#fff' }} />}
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>
              {i('Remettre les articles en stock', 'Return items to stock', 'Devolver artículos al stock', 'Rimetti gli articoli in stock')}
            </span>
            <span style={{ display: 'block', fontSize: 'var(--fs-caption)', color: 'var(--text4)', marginTop: 1 }}>
              {i('Décochez si la marchandise est abîmée / non rendue.', 'Uncheck if goods are damaged / not returned.', 'Desmarque si la mercancía está dañada / no devuelta.', 'Deseleziona se la merce è danneggiata / non resa.')}
            </span>
          </span>
        </button>

        {/* Note Wave/Orange (suivi only) */}
        {isTracking && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--c-amber-bg)', border: '1px solid var(--c-amber-border)', borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 14 }}>
            <Info size={14} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text2)' }}>
              {i('Paiement mobile (Wave/Orange) : ce remboursement est un SUIVI dans l’app. Le remboursement réel de l’argent se fait manuellement via l’opérateur.',
                 'Mobile payment (Wave/Orange): this refund is TRACKING only in the app. The actual money refund is done manually via the operator.',
                 'Pago móvil (Wave/Orange): este reembolso es solo SEGUIMIENTO en la app. El reembolso real del dinero se hace manualmente vía el operador.',
                 'Pagamento mobile (Wave/Orange): questo rimborso è solo TRACCIAMENTO nell’app. Il rimborso reale del denaro avviene manualmente tramite l’operatore.')}
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={saving} className="btn-ghost"
            style={{ flex: 1, justifyContent: 'center', cursor: saving ? 'default' : 'pointer' }}>
            {i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
          </button>
          <button type="button" onClick={() => canConfirm && onConfirm(reason.trim(), restock)} disabled={!canConfirm}
            className="btn-danger"
            style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, opacity: canConfirm ? 1 : .55, cursor: canConfirm ? 'pointer' : 'not-allowed' }}>
            {saving
              ? <><AlertTriangle size={14} /> {i('Remboursement…', 'Refunding…', 'Reembolsando…', 'Rimborso…')}</>
              : <><RotateCcw size={14} /> {i('Confirmer le remboursement', 'Confirm refund', 'Confirmar reembolso', 'Conferma rimborso')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
