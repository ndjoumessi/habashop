import { useEffect, useState } from 'react'
import { X, FileText, Loader2, RefreshCw, TrendingUp, RotateCcw, Wallet, Smartphone, CreditCard, Users, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import { ticketZApi } from '@/lib/api'
import { useI18n } from '@/hooks/useI18n'
import { useModalFocus } from '@/hooks/useModalFocus'
import { useFormatAmount } from '@/stores/appStore'

interface Props { onClose: () => void }

export default function TicketZModal({ onClose }: Props) {
  const { i, lang } = useI18n()
  const fmt = useFormatAmount()
  const dloc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  const [today, setToday] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const load = () => Promise.all([ticketZApi.today(), ticketZApi.history()])
    .then(([t, h]) => { setToday(t); setHistory(Array.isArray(h) ? h : []) })
    .catch(() => {})
    .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      const tz = await ticketZApi.generate()
      setToday(tz)
      const h = await ticketZApi.history()
      setHistory(Array.isArray(h) ? h : [])
      toast.success(i('Journée clôturée', 'Day closed', 'Día cerrado', 'Giornata chiusa'))
    } catch {
      toast.error(i('Erreur de clôture', 'Closing error', 'Error de cierre', 'Errore di chiusura'))
    } finally { setGenerating(false) }
  }

  const Stat = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text2)' }}>{icon} {label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 'var(--fw-bold)', fontSize: 13, color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )

  const boxRef = useModalFocus<HTMLDivElement>()

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true"
      aria-label={i('Clôture journalière', 'Daily closing', 'Cierre diario', 'Chiusura giornaliera')}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 'var(--fw-bold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={16} style={{ color: 'var(--p2)' }} /> {i('Clôture journalière', 'Daily closing', 'Cierre diario', 'Chiusura giornaliera')}
          </h3>
          <button aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} className="mini-btn" style={{ minWidth: 44, minHeight: 44 }} onClick={onClose}><X size={14} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <>
            {/* Résumé du jour */}
            {today ? (
              <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <Stat icon={<TrendingUp size={14} style={{ color: 'var(--acc2)' }} />} label={i('CA brut', 'Gross revenue', 'Ingreso bruto', 'Incasso lordo')} value={fmt(today.caVentes)} />
                <Stat icon={<FileText size={14} style={{ color: 'var(--text3)' }} />} label={i('Transactions', 'Transactions', 'Transacciones', 'Transazioni')} value={String(today.nbVentes)} />
                <Stat icon={<Wallet size={14} style={{ color: 'var(--text3)' }} />} label={i('Panier moyen', 'Avg. basket', 'Cesta media', 'Scontrino medio')} value={fmt(today.panierMoyen)} />
                <Stat icon={<RotateCcw size={14} style={{ color: 'var(--danger)' }} />} label={i('Remboursements', 'Refunds', 'Reembolsos', 'Rimborsi')} value={`- ${fmt(today.totalRemboursements)}`} color="var(--danger)" />
                <Stat icon={<TrendingUp size={14} style={{ color: 'var(--p2)' }} />} label={i('CA NET', 'NET revenue', 'Ingreso NETO', 'Incasso NETTO')} value={fmt(today.caNets)} color="var(--p2)" />
                <div style={{ height: 8 }} />
                <Stat icon={<Wallet size={14} style={{ color: 'var(--text3)' }} />} label={i('Espèces', 'Cash', 'Efectivo', 'Contanti')} value={fmt(today.cashAmount)} />
                <Stat icon={<Smartphone size={14} style={{ color: 'var(--text3)' }} />} label="Mobile Money" value={fmt(today.mobileMoneyAmount)} />
                <Stat icon={<CreditCard size={14} style={{ color: 'var(--text3)' }} />} label={i('Carte', 'Card', 'Tarjeta', 'Carta')} value={fmt(today.cardAmount)} />
                <Stat icon={<Users size={14} style={{ color: 'var(--text3)' }} />} label={i('Clients', 'Customers', 'Clientes', 'Clienti')} value={String(today.nbClients)} />
                <button type="button" onClick={() => ticketZApi.openPdf(today.id).catch(() => toast.error('PDF'))}
                  style={{ width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44,
                    background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--r-md)',
                    fontSize: 13, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)', cursor: 'pointer' }}>
                  <FileText size={15} /> {i('Télécharger le PDF', 'Download PDF', 'Descargar PDF', 'Scarica PDF')}
                </button>
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                {i('Aucune clôture aujourd\'hui. Générez le Ticket Z.', 'No closing today. Generate the Z ticket.', 'Sin cierre hoy. Genere el ticket Z.', 'Nessuna chiusura oggi. Genera il ticket Z.')}
              </div>
            )}

            {/* Générer / regénérer */}
            <button type="button" onClick={generate} disabled={generating}
              style={{ width: '100%', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44,
                background: 'linear-gradient(135deg, var(--p), var(--p2))', border: 'none', color: '#fff', borderRadius: 'var(--r-md)',
                fontSize: 13, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--font)', cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1 }}>
              {generating ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={15} />}
              {today ? i('Regénérer', 'Regenerate', 'Regenerar', 'Rigenera') : i('Clôturer la journée', 'Close the day', 'Cerrar el día', 'Chiudi la giornata')}
            </button>

            {/* Historique */}
            {history.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
                  {i('Historique (30 jours)', 'History (30 days)', 'Historial (30 días)', 'Cronologia (30 giorni)')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {history.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 'var(--r-sm)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--text)' }}>{new Date(h.date).toLocaleDateString(dloc, { weekday: 'short', day: '2-digit', month: 'short' })}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{h.nbVentes} {i('ventes', 'sales', 'ventas', 'vendite')}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 'var(--fw-bold)', fontSize: 12, color: 'var(--p2)', marginLeft: 'auto' }}>{fmt(h.caNets)}</span>
                      <button type="button" aria-label="PDF" onClick={() => ticketZApi.openPdf(h.id).catch(() => toast.error('PDF'))}
                        style={{ flexShrink: 0, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}>
                        <FileText size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
