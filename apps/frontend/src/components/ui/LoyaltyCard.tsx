import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { loyaltyApi } from '@/lib/api'
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
  const [points, setPoints] = useState(customer.loyaltyPoints ?? 0)
  const [tier,   setTier]   = useState<'Bronze'|'Silver'|'Gold'>('Bronze')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loyaltyApi.get(customer.id)
      .then(d => { setPoints(d.points); setTier(d.tier as any) })
      .catch(() => {
        const p = customer.loyaltyPoints ?? 0
        setPoints(p)
        setTier(p >= 5000 ? 'Gold' : p >= 2000 ? 'Silver' : 'Bronze')
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
    toast.success('ID copié !')
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>🎁 Carte Fidélité</h3>
          <button className="mini-btn" onClick={onClose}><X size={14} /></button>
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
                title="Cliquer pour copier"
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
              ⏳ Chargement...
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: cfg.color, fontFamily: 'var(--mono)', letterSpacing: '-2px' }}>
                  {points.toLocaleString()}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>pts</span>
                <span style={{
                  marginLeft: 8, fontSize: 12, fontWeight: 800, padding: '3px 10px',
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
                    {(nextThreshold - points).toLocaleString()} pts pour passer {tier === 'Bronze' ? 'Silver' : 'Gold'} {tier === 'Bronze' ? '🥈' : '🥇'}
                  </div>
                </>
              )}
              {!nextThreshold && (
                <div style={{ fontSize: 12, color: cfg.color, fontWeight: 700 }}>
                  🎉 Niveau maximum atteint !
                </div>
              )}
            </>
          )}
        </div>

        {/* Avantages tier */}
        <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 10 }}>
            Avantages {tier}
          </div>
          {tier === 'Bronze' && (
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
              ✅ 1 point par tranche de 1 000 FCFA<br/>
              ✅ Offres exclusives réservées aux membres<br/>
              🔒 Silver à partir de 2 000 pts · Gold à 5 000 pts
            </div>
          )}
          {tier === 'Silver' && (
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
              ✅ 1,5 points par tranche de 1 000 FCFA<br/>
              ✅ Remise de 5 % sur les achats &gt; 10 000 FCFA<br/>
              ✅ Accès aux promotions avant tout le monde<br/>
              🔒 Gold à partir de 5 000 pts
            </div>
          )}
          {tier === 'Gold' && (
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
              ✅ 2 points par tranche de 1 000 FCFA<br/>
              ✅ Remise de 10 % sur tous les achats<br/>
              ✅ Livraison prioritaire offerte<br/>
              ✅ Accès aux ventes privées
            </div>
          )}
        </div>

        <button className="topbar-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  )
}
