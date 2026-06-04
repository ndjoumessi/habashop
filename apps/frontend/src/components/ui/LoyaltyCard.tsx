import { useEffect, useState } from 'react'
import IconButton from '@/components/ui/IconButton'
import { X } from 'lucide-react'
import { loyaltyApi } from '@/lib/api'
import { useI18n } from '@/hooks/useI18n'
import { useFormatAmount } from '@/stores/appStore'
import toast from 'react-hot-toast'

interface Customer {
  id: string
  name: string
  phone?: string
  loyaltyPoints?: number
}

interface Props {
  customer: Customer
  onClose: () => void
}

const TIER_CFG = {
  Bronze: { color: '#CD7F32', bg: 'rgba(205,127,50,.12)', border: 'rgba(205,127,50,.3)', icon: '🥉', next: 2000 },
  Silver: { color: '#A8A9AD', bg: 'rgba(168,169,173,.12)', border: 'rgba(168,169,173,.3)', icon: '🥈', next: 5000 },
  Gold:   { color: '#FFD700', bg: 'rgba(255,215,0,.12)',   border: 'rgba(255,215,0,.3)',   icon: '🥇', next: null },
}

export default function LoyaltyCard({ customer, onClose }: Props) {
  const { i, lang } = useI18n()
  const dloc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  // Seuils de fidélité formatés dans la devise du tenant (1 000 / 10 000 XOF en base).
  const fmt = useFormatAmount()
  const [points, setPoints] = useState(customer.loyaltyPoints ?? 0)
  const [tier,   setTier]   = useState<'Bronze'|'Silver'|'Gold'>('Bronze')
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loyaltyApi.get(customer.id)
      .then(d => { setPoints(d.points); setTier(d.tier as any); setHistory(Array.isArray(d.history) ? d.history : []) })
      .catch(() => {
        const p = customer.loyaltyPoints ?? 0
        setPoints(p)
        setTier(p >= 5000 ? 'Gold' : p >= 2000 ? 'Silver' : 'Bronze')
        setHistory([])
      })
      .finally(() => setLoading(false))
  }, [customer.id, customer.loyaltyPoints])

  const cfg = TIER_CFG[tier]
  const nextThreshold = cfg.next
  const progress = nextThreshold
    ? Math.min(100, Math.round((points / nextThreshold) * 100))
    : 100

  // Simple QR-like SVG encoded from customer id
  const qrSeed = customer.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const qrCells = Array.from({ length: 7 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => ((qrSeed * (r + 1) * (c + 3)) % 3) === 0)
  )

  const handleCopyId = () => {
    navigator.clipboard.writeText(`HABA-${customer.id.slice(0, 8).toUpperCase()}`).catch(() => {})
    toast.success(i('ID copié !', 'ID copied!', '¡ID copiado!', 'ID copiato!'))
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 'var(--fw-bold)', color: 'var(--text)' }}>🎁 {i('Carte Fidélité', 'Loyalty Card', 'Tarjeta Fidelidad', 'Carta Fedeltà')}</h3>
          <IconButton label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} icon={<X size={14} />} onClick={onClose} variant="surface" />
        </div>

        {/* Card */}
        <div style={{
          background: `linear-gradient(135deg, ${cfg.bg.replace('.12)', '.2)')}, var(--card))`,
          border: `2px solid ${cfg.border}`,
          borderRadius: 16, padding: 20, marginBottom: 16,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: .06 }}>
            {cfg.icon}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginBottom: 2 }}>
                {customer.name}
              </div>
              <div
                style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', cursor: 'pointer' }}
                onClick={handleCopyId}
                title={i('Cliquer pour copier', 'Click to copy', 'Clic para copiar', 'Clicca per copiare')}
              >
                HABA-{customer.id.slice(0, 8).toUpperCase()} 📋
              </div>
            </div>
            {/* QR code SVG */}
            <div style={{
              background: '#fff', border: '2px solid var(--border)',
              borderRadius: 10, padding: 6, lineHeight: 0,
            }}>
              <svg viewBox="0 0 70 70" width={70} height={70}>
                <rect width="70" height="70" fill="white" />
                {/* Finder patterns */}
                <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke={cfg.color} strokeWidth="3" />
                <rect x="7" y="7" width="10" height="10" fill={cfg.color} />
                <rect x="49" y="3" width="18" height="18" rx="2" fill="none" stroke={cfg.color} strokeWidth="3" />
                <rect x="53" y="7" width="10" height="10" fill={cfg.color} />
                <rect x="3" y="49" width="18" height="18" rx="2" fill="none" stroke={cfg.color} strokeWidth="3" />
                <rect x="7" y="53" width="10" height="10" fill={cfg.color} />
                {/* Data cells */}
                {qrCells.map((row, r) =>
                  row.map((cell, c) =>
                    cell ? <rect key={`${r}-${c}`} x={26 + c * 6} y={26 + r * 6} width={5} height={5} rx={1} fill={cfg.color} /> : null
                  )
                )}
              </svg>
            </div>
          </div>

          {/* Points */}
          {loading ? (
            <div style={{ height: 40, display: 'flex', alignItems: 'center', color: 'var(--text3)', fontSize: 13 }}>
              ⏳ {i('Chargement...', 'Loading...', 'Cargando...', 'Caricamento...')}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: cfg.color, fontFamily: 'var(--mono)', letterSpacing: '-2px' }}>
                  {points.toLocaleString()}
                </span>
                <span style={{ fontSize: 14, fontWeight: 'var(--fw-semibold)', color: 'var(--text2)' }}>pts</span>
                <span style={{
                  marginLeft: 8, fontSize: 12, fontWeight: 'var(--fw-bold)', padding: '3px 10px',
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  borderRadius: 20, color: cfg.color,
                }}>
                  {cfg.icon} {tier}
                </span>
              </div>

              {nextThreshold && (
                <>
                  <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}aa)`,
                      width: `${progress}%`, transition: 'width .6s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {(nextThreshold - points).toLocaleString()} {i('pts pour passer', 'pts to reach', 'pts para alcanzar', 'pts per raggiungere')} {tier === 'Bronze' ? 'Silver' : 'Gold'} {tier === 'Bronze' ? '🥈' : '🥇'}
                  </div>
                </>
              )}
              {!nextThreshold && (
                <div style={{ fontSize: 12, color: cfg.color, fontWeight: 'var(--fw-semibold)' }}>
                  🎉 {i('Niveau maximum atteint !', 'Maximum level reached!', '¡Nivel máximo alcanzado!', 'Livello massimo raggiunto!')}
                </div>
              )}
            </>
          )}
        </div>

        {/* Fonctionnement — v1 : STATUT seulement (gain identique tous paliers, pas de remise) */}
        <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 10 }}>
            {i('Comment ça marche', 'How it works', 'Cómo funciona', 'Come funziona')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
            ⭐ {i(`1 point par tranche de ${fmt(1000)} dépensé`, `1 point per ${fmt(1000)} spent`, `1 punto por cada ${fmt(1000)} gastado`, `1 punto ogni ${fmt(1000)} speso`)}<br/>
            🏅 {i('Paliers : Bronze · Silver (2 000 pts) · Gold (5 000 pts)', 'Tiers: Bronze · Silver (2,000 pts) · Gold (5,000 pts)', 'Niveles: Bronze · Silver (2 000 pts) · Gold (5 000 pts)', 'Livelli: Bronze · Silver (2.000 pts) · Gold (5.000 pts)')}<br/>
            <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>🎁 {i('Récompenses & remises : à venir', 'Rewards & discounts: coming soon', 'Recompensas y descuentos: próximamente', 'Premi e sconti: in arrivo')}</span>
          </div>
        </div>

        {/* Historique des points (gains / retraits) */}
        {history.length > 0 && (
          <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 10 }}>
              {i('Historique', 'History', 'Historial', 'Cronologia')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {history.slice(0, 6).map((h, idx) => {
                const earn = (h.points ?? 0) >= 0
                return (
                  <div key={h.id ?? idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: 'var(--text3)' }}>
                      {earn ? i('Vente', 'Sale', 'Venta', 'Vendita') : i('Remboursement', 'Refund', 'Reembolso', 'Rimborso')}
                      {h.createdAt ? ` · ${new Date(h.createdAt).toLocaleDateString(dloc, { day: '2-digit', month: 'short' })}` : ''}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 'var(--fw-bold)', color: earn ? 'var(--acc2)' : 'var(--danger)' }}>
                      {earn ? '+' : ''}{h.points} pts
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button className="topbar-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
          {i('Fermer', 'Close', 'Cerrar', 'Chiudi')}
        </button>
      </div>
    </div>
  )
}
