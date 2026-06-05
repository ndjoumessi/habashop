import { useState, useEffect, useRef } from 'react'
import { X, Download, Share2 } from 'lucide-react'
import QRCode from 'qrcode'
import html2canvas from 'html2canvas'
import { loyaltyApi } from '@/lib/api'
import { useI18n } from '@/hooks/useI18n'

interface Props { customerId: string; onClose: () => void }

const TIER_CFG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  Bronze: { color: '#CD7F32', bg: 'linear-gradient(135deg,#3D2B0A,#1a1207)', border: '#CD7F32', icon: '🥉' },
  Silver: { color: '#A8A9AD', bg: 'linear-gradient(135deg,#2B2B2B,#111111)', border: '#A8A9AD', icon: '🥈' },
  Gold:   { color: '#FFD700', bg: 'linear-gradient(135deg,#3D3200,#1a1500)', border: '#FFD700', icon: '🥇' },
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
        const url = await QRCode.toDataURL(`HABA-${d.customerId.slice(0, 8).toUpperCase()}`, {
          width: 100, margin: 1, color: { dark: TIER_CFG[d.tier]?.color ?? '#fff', light: '#00000000' },
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

  const cfg = TIER_CFG[data?.tier ?? 'Bronze'] ?? TIER_CFG.Bronze
  const progress = data?.nextTier && data.bronzeThreshold
    ? Math.min(100, Math.round((data.points / (data.nextTier === 'Gold' ? data.silverThreshold : data.bronzeThreshold)) * 100))
    : 100

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 400, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 16 }}>🎴 {i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà')}</span>
          <button onClick={onClose} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>

        {loading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>⏳ {i('Chargement…', 'Loading…', 'Cargando…', 'Caricamento…')}</div>
        ) : !data ? (
          <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>⚠ {i('Erreur de chargement', 'Load error', 'Error de carga', 'Errore di caricamento')}</div>
        ) : (
          <>
            {/* ── Carte (340×200 px) ── */}
            <div ref={cardRef} style={{
              width: 340, height: 200,
              background: cfg.bg, border: `2px solid ${cfg.border}44`,
              borderRadius: 18, padding: '18px 20px',
              position: 'relative', overflow: 'hidden', userSelect: 'none',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              {/* Watermark */}
              <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 120, opacity: 0.06, lineHeight: 1 }}>{cfg.icon}</div>

              {/* Row 1 : nom + QR */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.customerName}</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: cfg.color }}>HABA-{data.customerId.slice(0, 8).toUpperCase()}</div>
                </div>
                {qrUrl && <img src={qrUrl} alt="QR" style={{ width: 64, height: 64, borderRadius: 8, border: `1px solid ${cfg.color}44` }} />}
              </div>

              {/* Row 2 : points + badge */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 34, fontWeight: 900, color: cfg.color, fontFamily: 'var(--mono)', letterSpacing: -1 }}>{data.points.toLocaleString()}</span>
                  <span style={{ fontSize: 13, color: '#fff9' }}>pts</span>
                  <span style={{ fontSize: 12, fontWeight: 'var(--fw-bold)', padding: '2px 10px', background: `${cfg.color}22`, border: `1px solid ${cfg.color}44`, borderRadius: 20, color: cfg.color }}>{cfg.icon} {data.tier}</span>
                </div>
                {/* Progression */}
                {data.nextTier && (
                  <div>
                    <div style={{ height: 6, background: '#ffffff18', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ height: '100%', background: cfg.color, borderRadius: 99, width: `${progress}%`, transition: 'width .6s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#fff7' }}>{data.pointsToNext.toLocaleString()} pts → {data.nextTier}</div>
                  </div>
                )}
              </div>

              {/* Row 3 : boutique */}
              <div style={{ fontSize: 10, color: '#fff6', textTransform: 'uppercase', letterSpacing: 1 }}>{data.shopName} · habashop</div>
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
