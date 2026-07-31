import { Loader2, CheckCircle, AlertTriangle, ExternalLink, X } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'

export type PaydunyaStatus = 'idle' | 'requesting' | 'polling' | 'success' | 'failed' | 'timeout'

interface Props {
  status:      PaydunyaStatus
  method:      'wave' | 'orange'
  qrDataUrl:   string | null
  paymentUrl:  string | null
  amountLabel: string
  lang:        string
  onCancel:    () => void
  onRetry:     () => void
}

// Overlay PayDunya (Wave / Orange Money Sénégal & UEMOA) : QR + lien hébergé + polling.
// La vente est finalisée par le parent (confirmSale) quand status='success'.
export default function POSPaydunyaOverlay({ status, method, qrDataUrl, paymentUrl, amountLabel, lang, onCancel, onRetry }: Props) {
  const boxRef = useModalFocus<HTMLDivElement>(status !== 'idle')
  const label = method === 'wave' ? 'Wave' : 'Orange Money'
  const accent = method === 'wave' ? '#1B9AF5' : '#FF6600'
  const i = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr

  const failed = status === 'failed' || status === 'timeout'

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true"
      aria-label={i('Paiement PayDunya', 'PayDunya payment', 'Pago PayDunya', 'Pagamento PayDunya')}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>
            {label} <span style={{ color: 'var(--text3)', fontWeight: 'var(--fw-regular)' }}>· PayDunya</span>
          </h3>
          <button type="button" onClick={onCancel} aria-label={i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', color: accent, fontFamily: 'var(--mono)', marginBottom: 16 }}>
          {amountLabel}
        </div>

        {(status === 'requesting') && (
          <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 0', color: 'var(--text3)' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: accent, flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-sm)' }}>{i('Création du paiement…', 'Creating payment…', 'Creando el pago…', 'Creazione pagamento…')}</span>
          </div>
        )}

        {status === 'polling' && (
          <>
            {qrDataUrl && (
              // QR noir/blanc opaque (scannable) — taille naturelle, jamais var(--text)/transparent.
              <img src={qrDataUrl} alt="QR PayDunya" width={180} height={180}
                style={{ margin: '0 auto 12px', display: 'block', borderRadius: 8, background: '#fff', padding: 6 }} />
            )}
            {paymentUrl && (
              <a href={paymentUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: accent, textDecoration: 'none', marginBottom: 14 }}>
                <ExternalLink size={14} /> {i('Ouvrir la page de paiement', 'Open payment page', 'Abrir página de pago', 'Apri pagina di pagamento')}
              </a>
            )}
            <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text2)', fontSize: 'var(--fs-sm)', marginTop: 4 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              {i(`En attente du paiement ${label}…`, `Waiting for ${label} payment…`, `Esperando el pago ${label}…`, `In attesa del pagamento ${label}…`)}
            </div>
          </>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 0', color: 'var(--acc2)' }}>
            <CheckCircle size={32} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)' }}>{i('Paiement confirmé', 'Payment confirmed', 'Pago confirmado', 'Pagamento confermato')}</span>
          </div>
        )}

        {failed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
              <AlertTriangle size={22} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--fs-sm)' }}>
                {status === 'timeout'
                  ? i('Délai dépassé — paiement non confirmé', 'Timed out — payment not confirmed', 'Tiempo agotado — pago no confirmado', 'Tempo scaduto — pagamento non confermato')
                  : i('Paiement échoué ou annulé', 'Payment failed or cancelled', 'Pago fallido o cancelado', 'Pagamento fallito o annullato')}
              </span>
            </div>
            <button type="button" onClick={onRetry} className="topbar-btn" style={{ justifyContent: 'center' }}>
              {i('Réessayer', 'Retry', 'Reintentar', 'Riprova')}
            </button>
          </div>
        )}

        {status !== 'success' && (
          <button type="button" onClick={onCancel} className="mini-btn"
            style={{ marginTop: 14, padding: '8px 16px' }}>
            {i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
          </button>
        )}
      </div>
    </div>
  )
}
