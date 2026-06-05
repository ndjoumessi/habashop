import { CheckCircle2, Printer, Plus } from 'lucide-react'

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
  if (!show) return null
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onNewSale()}>
      <div className="modal-box" style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--c-green-bg)', border: '1px solid var(--c-green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px auto 14px' }}>
          <CheckCircle2 size={34} style={{ color: 'var(--acc2)' }} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 'var(--fw-bold)', color: 'var(--text)', marginBottom: 4 }}>
          {lang === 'en' ? 'Sale completed!' : lang === 'es' ? '¡Venta cobrada!' : lang === 'it' ? 'Vendita incassata!' : 'Vente encaissée !'}
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--acc2)', fontFamily: 'var(--mono)', marginBottom: showChange && monnaie > 0 ? 6 : 18 }}>
          {fmt(total)}
        </div>
        {showChange && monnaie > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18 }}>
            {lang === 'en' ? 'Change' : lang === 'es' ? 'Cambio' : lang === 'it' ? 'Resto' : 'Monnaie à rendre'} :{' '}
            <span style={{ fontWeight: 'var(--fw-bold)', fontFamily: 'var(--mono)', color: 'var(--text)' }}>{fmt(monnaie)}</span>
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
