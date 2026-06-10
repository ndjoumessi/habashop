import { useState, useEffect, useRef } from 'react'
import { X, Download, Share2, CreditCard } from 'lucide-react'
import QRCode from 'qrcode'
import html2canvas from 'html2canvas'
import { loyaltyApi } from '@/lib/api'
import { useI18n } from '@/hooks/useI18n'
import { convertAmount, formatInCurrency } from '@/stores/appStore'

interface Props { customerId: string; onClose: () => void }

// Couleurs FIXES par palier (artefact « carte physique » exporté en PNG — pas du chrome thémé).
const TIER_CFG: Record<string, { bg: string; badgeBg: string; badgeTxt: string; bar: string }> = {
  Bronze: { bg: '#1C1007', badgeBg: '#3D2010', badgeTxt: '#F5A623', bar: '#CD7F32' },
  Silver: { bg: '#0D1117', badgeBg: '#1A2332', badgeTxt: '#A8C0D6', bar: '#8A9BB0' },
  Gold:   { bg: '#1A1205', badgeBg: '#2D2010', badgeTxt: '#FFD060', bar: '#D4A017' },
}

// Valeur API (Bronze/Silver/Gold) = clé ; seul l'affichage est traduit.
const TIER_NAMES: Record<string, [string, string, string, string]> = {
  Bronze: ['Bronze', 'Bronze', 'Bronce', 'Bronzo'],
  Silver: ['Argent', 'Silver', 'Plata', 'Argento'],
  Gold:   ['Or', 'Gold', 'Oro', 'Oro'],
}

export default function LoyaltyCardDigital({ customerId, onClose }: Props) {
  const { i } = useI18n()
  const cardRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Awaited<ReturnType<typeof loyaltyApi.getCard>> | null>(null)
  const [qrUrl, setQrUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    loyaltyApi.getCard(customerId)
      .then(async (d) => {
        setData(d)
        // QR = ID client COMPLET (résolu par le scan POS → GET /api/customers/:id).
        // ⚠️ Pas la forme tronquée `HS-XXXXXXXX` (irréversible) ; celle-ci ne sert qu'à l'affichage.
        // Noir sur blanc opaque (scannable quel que soit le thème).
        const url = await QRCode.toDataURL(`HABA-CUST:${d.customerId}`, {
          width: 128, margin: 0, color: { dark: '#000000', light: '#FFFFFF' },
        })
        setQrUrl(url)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId])

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: null })
      const a = document.createElement('a')
      a.download = `carte-fidelite-${customerId.slice(0, 8)}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    } catch { /* non-bloquant */ }
    setDownloading(false)
  }

  const handleShare = async () => {
    if (!cardRef.current) return
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: null })
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], 'carte-fidelite.png', { type: 'image/png' })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà') })
        } else {
          handleDownload()
        }
      })
    } catch { /* non-bloquant */ }
  }

  const tier = data?.tier ?? 'Bronze'
  const cfg = TIER_CFG[tier] ?? TIER_CFG.Bronze
  const tierName = (t: string) => { const n = TIER_NAMES[t]; return n ? i(n[0], n[1], n[2], n[3]) : t }

  const nextThreshold = data?.nextTier ? (data.nextTier === 'Gold' ? data.silverThreshold : data.bronzeThreshold) : null
  const progress = data && nextThreshold ? Math.min(100, Math.round((data.points / nextThreshold) * 100)) : 100

  // Valeur dispo. = points × (bronzeDiscount/100) × pointsPerAmount — déjà en devise tenant (PAS de conversion).
  const availableValue = data ? Math.round(data.points * ((data.bronzeDiscount ?? 5) / 100) * (data.pointsPerAmount ?? 1000)) : 0
  // Total achats = base XOF → devise tenant.
  const totalPurchases = data ? convertAmount(data.totalRevenue ?? 0, 'XOF', data.currency) : 0

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 400, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--fw-bold)', fontSize: 16 }}>
            <CreditCard size={16} style={{ color: 'var(--p2)' }} />
            {i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà')}
          </span>
          <button onClick={onClose} aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>

        {loading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>{i('Chargement…', 'Loading…', 'Cargando…', 'Caricamento…')}</div>
        ) : !data ? (
          <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>{i('Erreur de chargement', 'Load error', 'Error de carga', 'Errore di caricamento')}</div>
        ) : (
          <>
            {/* ── Carte 2 zones ── */}
            <div ref={cardRef} style={{ width: 340, borderRadius: 18, overflow: 'hidden', userSelect: 'none', border: '1px solid var(--border)' }}>

              {/* Zone haute — fond sombre par palier */}
              <div style={{ background: cfg.bg, padding: '18px 20px 16px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: '#fff', opacity: 0.7, marginBottom: 4 }}>
                      {i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà')}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 'var(--fw-bold)', color: '#fff', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.shopName}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 'var(--fw-bold)', padding: '4px 12px', borderRadius: 99, background: cfg.badgeBg, color: cfg.badgeTxt }}>{tierName(tier)}</span>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 'var(--fw-semibold)', color: '#fff', maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.customerName}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,.65)' }}>HABA-{data.customerId.slice(0, 8).toUpperCase()}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 'var(--fw-bold)', color: '#fff', fontFamily: 'var(--mono)', letterSpacing: -1, lineHeight: 1.1 }}>{data.points.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)' }}>{i('points', 'points', 'puntos', 'punti')}</div>
                  </div>
                  {qrUrl && (
                    <div style={{ background: '#FFFFFF', borderRadius: 8, padding: 6, lineHeight: 0 }}>
                      <img src={qrUrl} alt="QR" style={{ width: 64, height: 64, display: 'block' }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Zone basse — fond thémé */}
              <div style={{ background: 'var(--card)', borderTop: '1px solid var(--border)', padding: '14px 16px 16px' }}>
                {/* Progression */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 'var(--fw-semibold)', color: 'var(--text3)' }}>
                      {data.nextTier
                        ? `${tierName(tier)} → ${tierName(data.nextTier)}`
                        : i('Palier maximum atteint', 'Top tier reached', 'Nivel máximo alcanzado', 'Livello massimo raggiunto')}
                    </span>
                    {nextThreshold && (
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
                        {data.points.toLocaleString()} / {nextThreshold.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: cfg.bar, borderRadius: 99, transition: 'width .6s' }} />
                  </div>
                </div>

                {/* Stats 2 colonnes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text3)', marginBottom: 3 }}>{i('Total achats', 'Total purchases', 'Compras totales', 'Acquisti totali')}</div>
                    <div style={{ fontSize: 13, fontWeight: 'var(--fw-bold)', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{formatInCurrency(totalPurchases, data.currency)}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text3)', marginBottom: 3 }}>{i('Valeur dispo.', 'Available value', 'Valor disp.', 'Valore disp.')}</div>
                    <div style={{ fontSize: 13, fontWeight: 'var(--fw-bold)', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{formatInCurrency(availableValue, data.currency)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={handleDownload} disabled={downloading}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 'var(--fw-semibold)', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                <Download size={14} /> {downloading ? '…' : i('Télécharger PNG', 'Download PNG', 'Descargar PNG', 'Scarica PNG')}
              </button>
              <button type="button" onClick={handleShare}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 'var(--fw-semibold)', fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                <Share2 size={14} /> {i('Partager', 'Share', 'Compartir', 'Condividi')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
