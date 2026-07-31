import { useEffect, useState } from 'react'
import IconButton from '@/components/ui/IconButton'
import { X, Gift, Award, Medal, Crown, Star, Copy, Loader2, Sparkles } from 'lucide-react'
import { loyaltyApi } from '@/lib/api'
import { useI18n } from '@/hooks/useI18n'
import { useModalFocus } from '@/hooks/useModalFocus'
import { formatInCurrency, useAppStore } from '@/stores/appStore'
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

// Icônes Lucide (cohérence design system) + couleurs lisibles AA en Mode Soleil :
// Silver → var(--text2) (gris lisible clair+sombre), Gold → var(--acc) (theme-aware),
// remplacent les #A8A9AD / #FFD700 illisibles sur fond clair.
const TIER_CFG = {
  Bronze: { color: '#CD7F32',     tint: 'rgba(205,127,50,.14)', border: 'rgba(205,127,50,.35)', Icon: Award },
  Silver: { color: 'var(--text2)', tint: 'var(--bg4)',          border: 'var(--border2)',        Icon: Medal },
  Gold:   { color: 'var(--acc)',   tint: 'var(--c-orange-bg)',  border: 'var(--c-orange-border)', Icon: Crown },
} as const

export default function LoyaltyCard({ customer, onClose }: Props) {
  const { i, lang } = useI18n()
  const boxRef = useModalFocus<HTMLDivElement>()
  const dloc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  // pointsPerAmount est DÉJÀ exprimé dans la devise du tenant → on le formate tel quel,
  // SANS conversion de change (useFormatAmount convertirait depuis XOF → 1000 = 1,52 €, faux).
  const currency = useAppStore(s => s.tenant?.currency ?? s.currency)
  const tfmt = (amount: number) => formatInCurrency(amount, currency)
  const [points, setPoints] = useState(customer.loyaltyPoints ?? 0)
  const [tier,   setTier]   = useState<'Bronze'|'Silver'|'Gold'>('Bronze')
  const [history, setHistory] = useState<any[]>([])
  // Config fidélité du tenant (renvoyée par l'API ; défauts v1 en secours).
  const [bronze, setBronze] = useState(2000)
  const [silver, setSilver] = useState(5000)
  const [perAmount, setPerAmount] = useState(1000)
  // Loyalty v2 : remises par palier (0 = non configuré → afficher "à venir").
  const [bronzeDisc, setBronzeDisc] = useState(0)
  const [silverDisc, setSilverDisc] = useState(0)
  const [goldDisc,   setGoldDisc]   = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loyaltyApi.get(customer.id)
      .then(d => {
        setPoints(d.points); setTier(d.tier as any); setHistory(Array.isArray(d.history) ? d.history : [])
        if ((d as any).bronzeThreshold) setBronze((d as any).bronzeThreshold)
        if ((d as any).silverThreshold) setSilver((d as any).silverThreshold)
        if ((d as any).pointsPerAmount) setPerAmount((d as any).pointsPerAmount)
        setBronzeDisc((d as any).bronzeDiscount ?? 0)
        setSilverDisc((d as any).silverDiscount ?? 0)
        setGoldDisc((d as any).goldDiscount ?? 0)
      })
      .catch(() => {
        const p = customer.loyaltyPoints ?? 0
        setPoints(p)
        setTier(p >= 5000 ? 'Gold' : p >= 2000 ? 'Silver' : 'Bronze')
        setHistory([])
      })
      .finally(() => setLoading(false))
  }, [customer.id, customer.loyaltyPoints])

  const cfg = TIER_CFG[tier]
  const TierIcon = cfg.Icon
  // Prochain seuil basé sur la config TENANT (plus les 2000/5000 de TIER_CFG).
  const nextThreshold = tier === 'Bronze' ? bronze : tier === 'Silver' ? silver : null
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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={i('Carte Fidélité', 'Loyalty Card', 'Tarjeta Fidelidad', 'Carta Fedeltà')} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth: 420 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}><Gift size={16} style={{ color: 'var(--p2)' }} /> {i('Carte Fidélité', 'Loyalty Card', 'Tarjeta Fidelidad', 'Carta Fedeltà')}</h3>
          <IconButton label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} icon={<X size={14} />} onClick={onClose} variant="surface" />
        </div>

        {/* Card */}
        <div style={{
          background: `linear-gradient(135deg, ${cfg.tint}, var(--card))`,
          border: `2px solid ${cfg.border}`,
          borderRadius: 16, padding: 20, marginBottom: 16,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -16, right: -16, opacity: .08, color: cfg.color }}>
            <TierIcon size={104} />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--text)', marginBottom: 2 }}>
                {customer.name}
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                aria-label={i('Copier le code fidélité', 'Copy loyalty code', 'Copiar el código de fidelidad', 'Copia il codice fedeltà')}
                title={i('Cliquer pour copier', 'Click to copy', 'Clic para copiar', 'Clicca per copiare')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-caption)', fontFamily: 'var(--mono)', color: 'var(--text3)', background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer' }}
              >
                HABA-{customer.id.slice(0, 8).toUpperCase()} <Copy size={11} />
              </button>
            </div>
            {/* QR code SVG */}
            <div style={{
              background: '#fff', border: '2px solid var(--border)',
              borderRadius: 10, padding: 6, lineHeight: 0,
            }}>
              {/* color via style → currentColor (résout var() de cfg.color, contrairement à un attribut fill="var(--…)") */}
              <svg viewBox="0 0 70 70" width={70} height={70} style={{ color: cfg.color }}>
                <rect width="70" height="70" fill="white" />
                {/* Finder patterns */}
                <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
                <rect x="7" y="7" width="10" height="10" fill="currentColor" />
                <rect x="49" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
                <rect x="53" y="7" width="10" height="10" fill="currentColor" />
                <rect x="3" y="49" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="3" />
                <rect x="7" y="53" width="10" height="10" fill="currentColor" />
                {/* Data cells */}
                {qrCells.map((row, r) =>
                  row.map((cell, c) =>
                    cell ? <rect key={`${r}-${c}`} x={26 + c * 6} y={26 + r * 6} width={5} height={5} rx={1} fill="currentColor" /> : null
                  )
                )}
              </svg>
            </div>
          </div>

          {/* Points */}
          {loading ? (
            <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text3)', fontSize: 'var(--fs-sm)' }}>
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {i('Chargement...', 'Loading...', 'Cargando...', 'Caricamento...')}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 36, fontWeight: 'var(--fw-semibold)', color: cfg.color, fontFamily: 'var(--mono)', letterSpacing: '-2px' }}>
                  {points.toLocaleString()}
                </span>
                <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text2)' }}>pts</span>
                <span style={{
                  marginLeft: 8, fontSize: 'var(--fs-label)', fontWeight: 'var(--fw-bold)', padding: '3px 10px',
                  background: cfg.tint, border: `1px solid ${cfg.border}`,
                  borderRadius: 20, color: cfg.color,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <TierIcon size={12} /> {tier}
                </span>
              </div>

              {nextThreshold && (
                <>
                  <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      background: cfg.color,
                      width: `${progress}%`, transition: 'width .6s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text3)' }}>
                    {(nextThreshold - points).toLocaleString()} {i('pts pour passer', 'pts to reach', 'pts para alcanzar', 'pts per raggiungere')} {tier === 'Bronze' ? 'Silver' : 'Gold'}
                  </div>
                </>
              )}
              {!nextThreshold && (
                <div style={{ fontSize: 'var(--fs-label)', color: cfg.color, fontWeight: 'var(--fw-semibold)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Sparkles size={13} /> {i('Niveau maximum atteint !', 'Maximum level reached!', '¡Nivel máximo alcanzado!', 'Livello massimo raggiunto!')}
                </div>
              )}
            </>
          )}
        </div>

        {/* Fonctionnement — v1 : STATUT seulement (gain identique tous paliers, pas de remise) */}
        <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 10 }}>
            {i('Comment ça marche', 'How it works', 'Cómo funciona', 'Come funziona')}
          </div>
          <div style={{ fontSize: 'var(--fs-label)', color: 'var(--text2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Star size={13} style={{ color: 'var(--warn)', flexShrink: 0 }} /> {i(`1 point par tranche de ${tfmt(perAmount)} dépensé`, `1 point per ${tfmt(perAmount)} spent`, `1 punto por cada ${tfmt(perAmount)} gastado`, `1 punto ogni ${tfmt(perAmount)} speso`)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Award size={13} style={{ color: 'var(--p3)', flexShrink: 0 }} /> {i(`Paliers : Bronze · Silver (${bronze.toLocaleString()} pts) · Gold (${silver.toLocaleString()} pts)`, `Tiers: Bronze · Silver (${bronze.toLocaleString()} pts) · Gold (${silver.toLocaleString()} pts)`, `Niveles: Bronze · Silver (${bronze.toLocaleString()} pts) · Gold (${silver.toLocaleString()} pts)`, `Livelli: Bronze · Silver (${bronze.toLocaleString()} pts) · Gold (${silver.toLocaleString()} pts)`)}</span>
            {/* Loyalty v2 : remise du palier actuel si configurée, sinon « à venir » */}
            {(() => {
              const disc = tier === 'Gold' ? goldDisc : tier === 'Silver' ? silverDisc : bronzeDisc
              return disc > 0
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--acc2)', fontWeight: 'var(--fw-semibold)' }}>
                    <Gift size={13} style={{ flexShrink: 0 }} />
                    {i(`Remise ${disc} % sur vos achats`, `${disc}% discount on your purchases`, `Descuento del ${disc} % en sus compras`, `Sconto del ${disc}% sugli acquisti`)}
                  </span>
                : <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text3)', fontStyle: 'italic' }}><Gift size={13} style={{ flexShrink: 0 }} /> {i('Récompenses & remises : à venir', 'Rewards & discounts: coming soon', 'Recompensas y descuentos: próximamente', 'Premi e sconti: in arrivo')}</span>
            })()}
          </div>
        </div>

        {/* Historique des points (gains / retraits) */}
        {history.length > 0 && (
          <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 10 }}>
              {i('Historique', 'History', 'Historial', 'Cronologia')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {history.slice(0, 6).map((h, idx) => {
                const earn = (h.points ?? 0) >= 0
                return (
                  <div key={h.id ?? idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-label)' }}>
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
