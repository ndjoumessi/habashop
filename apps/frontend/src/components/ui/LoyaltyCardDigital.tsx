import { useState, useEffect, useRef } from 'react'
import { X, Download, Share2, CreditCard } from 'lucide-react'
import QRCode from 'qrcode'
import html2canvas from 'html2canvas'
import { loyaltyApi } from '@/lib/api'
import { useI18n } from '@/hooks/useI18n'
import { useModalFocus } from '@/hooks/useModalFocus'
import { useFormatAmount } from '@/stores/appStore'

interface Props { customerId: string; onClose: () => void }

/**
 * Carte fidélité — 1:1 maquette 04-fidelite-carte.view.html :
 * carte hero teintée par palier (QR HABA-CUST:<id>, points or, progression),
 * cartes « Palier actuel / Prochain palier », « Activité récente » (points serveur).
 * Couleurs FIXES par palier sur la carte hero (artefact « carte physique »
 * exporté en PNG — pas du chrome thémé) ; le reste = tokens.
 */
const TIER_CFG: Record<string, { bg: string; border: string; badgeBg: string; badgeTxt: string }> = {
  Bronze: { bg: 'linear-gradient(135deg,#33220F,#1A140B)', border: 'rgba(205,127,50,.35)',  badgeBg: 'rgba(205,127,50,.2)',   badgeTxt: '#E8A664' },
  Silver: { bg: 'linear-gradient(135deg,#2A2340,#141A2A)', border: 'rgba(168,156,245,.3)',  badgeBg: 'rgba(200,200,220,.15)', badgeTxt: '#D2D6E4' },
  Gold:   { bg: 'linear-gradient(135deg,#3A2C10,#1A1408)', border: 'rgba(255,176,32,.35)',  badgeBg: 'rgba(255,176,32,.18)',  badgeTxt: '#FFD060' },
}

// Valeur API (Bronze/Silver/Gold) = clé ; seul l'affichage est traduit.
const TIER_NAMES: Record<string, [string, string, string, string]> = {
  Bronze: ['Bronze', 'Bronze', 'Bronce', 'Bronzo'],
  Silver: ['Argent', 'Silver', 'Plata', 'Argento'],
  Gold:   ['Or', 'Gold', 'Oro', 'Oro'],
}

export default function LoyaltyCardDigital({ customerId, onClose }: Props) {
  const { i, lang } = useI18n()
  const fmt = useFormatAmount()
  const boxRef = useModalFocus<HTMLDivElement>()
  const cardRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Awaited<ReturnType<typeof loyaltyApi.getCard>> | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [qrUrl, setQrUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const dloc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'

  useEffect(() => {
    Promise.all([
      loyaltyApi.getCard(customerId),
      loyaltyApi.get(customerId).catch(() => null),   // activité points (serveur)
    ])
      .then(async ([d, l]) => {
        setData(d)
        setHistory(Array.isArray(l?.history) ? l!.history : [])
        // QR = ID client COMPLET (résolu par le scan POS → GET /api/customers/:id).
        // Simple sélecteur, AUCUNE crypto/HMAC (spec). Noir sur blanc opaque (scannable
        // quel que soit le thème).
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

  // Seuil du prochain palier (configurable tenant) + progression.
  const nextThreshold = data?.nextTier ? (data.nextTier === 'Gold' ? data.silverThreshold : data.bronzeThreshold) : null
  const progress = data && nextThreshold ? Math.min(100, Math.round((data.points / nextThreshold) * 100)) : 100
  const ptsToNext = data && nextThreshold ? Math.max(0, nextThreshold - data.points) : 0
  // Remise du palier courant / suivant (configurables tenant).
  const discountOf = (t: string | null | undefined) =>
    t === 'Gold' ? (data?.goldDiscount ?? 10) : t === 'Silver' ? (data?.silverDiscount ?? 5) : (data?.bronzeDiscount ?? 5)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={i('Carte fidélité numérique', 'Digital loyalty card', 'Tarjeta de fidelidad digital', 'Carta fedeltà digitale')} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="modal-box" style={{ maxWidth: 420, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-md)', minWidth: 0 }}>
            <CreditCard size={16} style={{ color: 'var(--p2)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà')}{data?.shopName ? ` · ${data.shopName}` : ''}
            </span>
          </span>
          <button onClick={onClose} aria-label={i('Fermer', 'Close', 'Cerrar', 'Chiudi')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={14} /></button>
        </div>

        {loading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>{i('Chargement…', 'Loading…', 'Cargando…', 'Caricamento…')}</div>
        ) : !data ? (
          <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>{i('Erreur de chargement', 'Load error', 'Error de carga', 'Errore di caricamento')}</div>
        ) : (
          <>
            {/* ── Carte hero teintée palier (maquette) ── */}
            <div ref={cardRef} style={{
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              borderRadius: 18, padding: 18, marginBottom: 14, userSelect: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ color: '#AAB2C4', fontSize: 'var(--fs-label)' }}>{i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà')}</span>
                <span style={{
                  background: cfg.badgeBg, color: cfg.badgeTxt, fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)',
                  padding: '4px 11px', borderRadius: 20, letterSpacing: '.5px', textTransform: 'uppercase',
                }}>{tierName(tier)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#EAEEF6', fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.customerName}</div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ color: '#FFB020', fontSize: 30, fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)', letterSpacing: '-.5px' }}>{data.points.toLocaleString()}</span>{' '}
                    <span style={{ color: '#AAB2C4', fontSize: 'var(--fs-sm)' }}>{i('points', 'points', 'puntos', 'punti')}</span>
                  </div>
                </div>
                {qrUrl && (
                  <div style={{ background: '#fff', borderRadius: 10, padding: 7, width: 70, height: 70, flexShrink: 0, lineHeight: 0 }}>
                    <img src={qrUrl} alt={i('QR carte fidélité', 'Loyalty QR', 'QR de fidelidad', 'QR fedeltà')} style={{ width: 56, height: 56, display: 'block' }} />
                  </div>
                )}
              </div>
              {/* Progression vers le palier suivant */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#AAB2C4', fontSize: 'var(--fs-caption)', marginBottom: 6 }}>
                  <span>
                    {data.nextTier
                      ? `${ptsToNext.toLocaleString()} pts ${i('jusqu’à', 'to', 'hasta', 'fino a')} ${tierName(data.nextTier)}`
                      : i('Palier maximum atteint', 'Top tier reached', 'Nivel máximo alcanzado', 'Livello massimo raggiunto')}
                  </span>
                  {nextThreshold && <span style={{ fontFamily: 'var(--mono)' }}>{data.points.toLocaleString()} / {nextThreshold.toLocaleString()}</span>}
                </div>
                <div style={{ height: 7, background: 'rgba(0,0,0,.35)', borderRadius: 20, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#A991FF,#FFB020)', transition: 'width .6s' }} />
                </div>
              </div>
            </div>

            {/* ── Palier actuel / Prochain palier (remises configurables tenant) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 12, padding: 12 }}>
                <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-caption)' }}>{i('Palier actuel', 'Current tier', 'Nivel actual', 'Livello attuale')}</div>
                <div style={{ color: 'var(--text)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', marginTop: 3 }}>{tierName(tier)} · {discountOf(tier)}%</div>
                <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-caption)', marginTop: 2 }}>{i('de remise', 'discount', 'de descuento', 'di sconto')}</div>
              </div>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 12, padding: 12 }}>
                <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-caption)' }}>{i('Prochain palier', 'Next tier', 'Próximo nivel', 'Prossimo livello')}</div>
                {data.nextTier ? (
                  <>
                    <div style={{ color: 'var(--acc)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', marginTop: 3 }}>{tierName(data.nextTier)} · {discountOf(data.nextTier)}%</div>
                    <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-caption)', marginTop: 2 }}>{i('à', 'at', 'a', 'a')} {nextThreshold?.toLocaleString()} pts</div>
                  </>
                ) : (
                  <div style={{ color: 'var(--acc)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', marginTop: 3 }}>{i('Maximum atteint', 'Top reached', 'Máximo alcanzado', 'Massimo raggiunto')}</div>
                )}
              </div>
            </div>

            {/* ── Activité récente (points gagnés / dépensés — serveur) ── */}
            {history.length > 0 && (
              <>
                <div style={{ color: 'var(--text3)', fontSize: 'var(--fs-caption)', letterSpacing: '.5px', textTransform: 'uppercase', fontWeight: 'var(--fw-semibold)', marginBottom: 9 }}>
                  {i('Activité récente', 'Recent activity', 'Actividad reciente', 'Attività recente')}
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 12, padding: '4px 14px', marginBottom: 2 }}>
                  {history.slice(0, 5).map((h, idx, arr) => {
                    const pts = Number(h.points) || 0
                    const label = h.reason
                      || (h.saleId
                        ? i('Vente', 'Sale', 'Venta', 'Vendita')
                        : pts >= 0 ? i('Points ajoutés', 'Points added', 'Puntos añadidos', 'Punti aggiunti') : i('Remise utilisée', 'Discount used', 'Descuento usado', 'Sconto usato'))
                    return (
                      <div key={h.id ?? idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '9px 0',
                        borderBottom: idx < arr.length - 1 ? '1px solid color-mix(in srgb, var(--border) 55%, transparent)' : 'none',
                      }}>
                        <span style={{ color: 'var(--text)', fontSize: 'var(--fs-sm)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                          {h.amount != null && <span style={{ color: 'var(--text3)' }}> · {fmt(Number(h.amount) || 0)}</span>}
                          {h.createdAt && <span style={{ color: 'var(--text3)', fontSize: 'var(--fs-caption)' }}> · {new Date(h.createdAt).toLocaleDateString(dloc, { day: '2-digit', month: 'short' })}</span>}
                        </span>
                        <span style={{ color: pts >= 0 ? 'var(--acc2)' : 'var(--danger)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                          {pts >= 0 ? '+' : '−'}{Math.abs(pts).toLocaleString()} pts
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={handleDownload} disabled={downloading}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', minHeight: 44, borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-sm)', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                <Download size={14} /> {downloading ? '…' : i('Télécharger PNG', 'Download PNG', 'Descargar PNG', 'Scarica PNG')}
              </button>
              <button type="button" onClick={handleShare}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', minHeight: 44, borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-sm)', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
                <Share2 size={14} /> {i('Partager', 'Share', 'Compartir', 'Condividi')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
