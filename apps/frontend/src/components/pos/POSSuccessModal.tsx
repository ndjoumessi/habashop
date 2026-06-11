import { CheckCircle2, Printer, Plus, X } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'

interface Props {
  show: boolean
  lang: string
  total: number
  monnaie: number          // monnaie à rendre (XOF) — affichée si > 0
  showChange: boolean      // vrai si paiement espèces simple (montant reçu saisi)
  fmt: (n: number) => string
  onPrint: () => void
  onNewSale: () => void
}

/**
 * Modale de SUCCÈS après une vente encaissée. Propose d'imprimer le reçu (le panier
 * est encore intact) puis de démarrer une nouvelle vente (reset). Remplace l'ancien
 * comportement où tout disparaissait sans proposer l'impression.
 */
export default function POSSuccessModal({ show, lang, total, monnaie, showChange, fmt, onPrint, onNewSale }: Props) {
  // Hook AVANT le return conditionnel (règle des hooks)
  const boxRef = useModalFocus<HTMLDivElement>(show)
  if (!show) return null
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true"
      aria-label={lang === 'en' ? 'Sale completed' : lang === 'es' ? 'Venta cobrada' : lang === 'it' ? 'Vendita incassata' : 'Vente encaissée'}
      onClick={e => e.target === e.currentTarget && onNewSale()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth: 380, textAlign: 'center', position: 'relative' }}>
        {/* Fermeture explicite (fallback si l'utilisateur ne veut ni imprimer ni enchaîner) */}
        <button type="button" aria-label={lang === 'en' ? 'Close' : lang === 'es' ? 'Cerrar' : lang === 'it' ? 'Chiudi' : 'Fermer'} onClick={onNewSale}
          style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text3)', cursor: 'pointer' }}>
          <X size={15} />
        </button>
        {/* Cercle ✓ : pop à l'apparition + anneau pulsé (box-shadow seul, aucun transform résiduel) */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--c-green-bg)', border: '1px solid var(--c-green-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px auto 16px',
          animation: 'popIn .3s ease both, posRingPulse 1.8s ease-out .3s infinite',
        }}>
          <CheckCircle2 size={38} style={{ color: 'var(--acc2)' }} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 'var(--fw-bold)', color: 'var(--text)', marginBottom: 6 }}>
          {lang === 'en' ? 'Sale completed!' : lang === 'es' ? '¡Venta cobrada!' : lang === 'it' ? 'Vendita incassata!' : 'Vente encaissée !'}
        </div>
        <div style={{ fontSize: 32, fontWeight: 'var(--fw-bold)', color: 'var(--acc2)', fontFamily: 'var(--mono)', letterSpacing: '-1px', marginBottom: showChange && monnaie > 0 ? 12 : 20 }}>
          {fmt(total)}
        </div>
        {showChange && monnaie > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', marginBottom: 18,
            background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: 'var(--text2)' }}>
              {lang === 'en' ? 'Change' : lang === 'es' ? 'Cambio' : lang === 'it' ? 'Resto' : 'Monnaie à rendre'}
            </span>
            <span style={{ fontSize: 20, fontWeight: 'var(--fw-bold)', fontFamily: 'var(--mono)', color: 'var(--text)' }}>{fmt(monnaie)}</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onPrint}
            style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--r-md)',
              fontSize: 14, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)', cursor: 'pointer' }}>
            <Printer size={16} /> {lang === 'en' ? 'Print receipt' : lang === 'es' ? 'Imprimir recibo' : lang === 'it' ? 'Stampa scontrino' : 'Imprimer le reçu'}
          </button>
          <button type="button" onClick={onNewSale}
            style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'linear-gradient(135deg, var(--p), var(--p2))', border: 'none', color: '#fff', borderRadius: 'var(--r-md)',
              fontSize: 14, fontWeight: 'var(--fw-bold)', fontFamily: 'var(--font)', cursor: 'pointer' }}>
            <Plus size={16} /> {lang === 'en' ? 'New sale' : lang === 'es' ? 'Nueva venta' : lang === 'it' ? 'Nuova vendita' : 'Nouvelle vente'}
          </button>
        </div>
      </div>
    </div>
  )
}
