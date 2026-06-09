import { useMemo, useState, useEffect } from 'react'
import {
  View, Text, Modal, Pressable, StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import QRCode from 'qrcode'
import * as Print from 'expo-print'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { customersApi } from '@/services/api'
import type { LoyaltyCardData } from '@/types'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'
import { logger } from '@/lib/logger'
import type { LoyaltyTier } from '@/lib/loyalty'

// Design carte = web (zone haute sombre par palier / zone basse fond thème).
// Bronze = specs web ; Silver/Gold déclinés sur le même schéma dark/mid/accent.
const TIER_CFG: Record<string, { dark: string; mid: string; accent: string; icon: string }> = {
  Bronze: { dark: '#1C1007', mid: '#3D2010', accent: '#F5A623', icon: '🥉' },
  Silver: { dark: '#121216', mid: '#2B2B33', accent: '#C8CAD3', icon: '🥈' },
  Gold:   { dark: '#1A1402', mid: '#3D3200', accent: '#FFD700', icon: '🥇' },
}

interface Props { customerId: string; onClose: () => void }

/**
 * Carte fidélité numérique — 100% OTA-safe (qrcode pur JS pour le QR, expo-print pour
 * le partage PDF). Montée ON-DEMAND (anti-crash Fabric).
 */
export default function LoyaltyCardDigital({ customerId, onClose }: Props) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const [qrUri, setQrUri] = useState<string>('')
  const [sharing, setSharing] = useState(false)

  const { data, isLoading } = useQuery<LoyaltyCardData>({
    queryKey: ['loyalty-card', customerId],
    queryFn: () => customersApi.loyaltyCard(customerId),
    staleTime: 60 * 1000,
  })

  const tier = (data?.tier ?? 'Bronze') as LoyaltyTier
  const cfg = TIER_CFG[tier] ?? TIER_CFG.Bronze
  const qrValue = `HABA-${customerId.slice(0, 8).toUpperCase()}`

  // QR code : pur JS via qrcode (data URL PNG) — pas de module natif, OTA-safe.
  // Rendu dans un cadre blanc → modules sombres (couleur du palier) pour rester scannable.
  useEffect(() => {
    QRCode.toDataURL(qrValue, { width: 160, margin: 0, color: { dark: cfg.dark, light: '#FFFFFF' } })
      .then(setQrUri)
      .catch(() => {})
  }, [qrValue, cfg.dark])

  const nextThreshold = tier === 'Bronze' ? (data?.bronzeThreshold ?? 2000)
    : tier === 'Silver' ? (data?.silverThreshold ?? 5000) : null
  const progress = nextThreshold && data
    ? Math.min(100, Math.round((data.points / nextThreshold) * 100)) : 100

  // Partage : génère un PDF via expo-print (déjà installé).
  const handleShare = async () => {
    if (!data) return
    setSharing(true)
    try {
      const html = buildCardHtml(data, qrUri, i)
      await Print.printAsync({ html })
    } catch (e: any) {
      // Annulation print = normale (utilisateur a fermé) → on ne logue qu'en erreur vraie.
      if (!String(e?.message).toLowerCase().includes('cancel')) {
        logger.warn('LoyaltyCardDigital share failed:', e)
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.box}>
          <View style={s.head}>
            <Text style={s.headTitle}>🎴 {i('Carte fidélité', 'Loyalty card', 'Tarjeta de fidelidad', 'Carta fedeltà')}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button"
              accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
              <Ionicons name="close" size={24} color={C.text3} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={s.loadingBox}><ActivityIndicator color={C.primary} /></View>
          ) : !data ? (
            <Text style={s.errorTxt}>⚠ {i('Erreur de chargement', 'Load error', 'Error de carga', 'Errore')}</Text>
          ) : (
            <View style={{ gap: Spacing.md }}>
              {/* ── Carte deux zones (design web) ── */}
              <View style={[s.card, { borderColor: withAlpha(cfg.accent, 0.35) }]}>

                {/* Zone haute — fond sombre du palier */}
                <View style={[s.cardTop, { backgroundColor: cfg.dark }]}>
                  <Text style={s.watermark}>{cfg.icon}</Text>

                  <View style={s.cardRow}>
                    <View style={{ flex: 1 }}>
                      <View style={[s.tierBadge, { backgroundColor: cfg.mid, borderColor: withAlpha(cfg.accent, 0.4) }]}>
                        <Text style={[s.tierTxt, { color: cfg.accent }]}>{cfg.icon} {tier}</Text>
                      </View>
                      <Text style={s.cardName} numberOfLines={1}>{data.customerName}</Text>
                      <Text style={[s.cardId, { color: cfg.accent }]}>{qrValue}</Text>
                    </View>
                    {/* QR dans un cadre blanc 64×64 */}
                    <View style={s.qrBox}>
                      {qrUri ? <Image source={{ uri: qrUri }} style={s.qrImg} /> : null}
                    </View>
                  </View>

                  <View style={s.ptsRow}>
                    <Text style={s.ptsVal}>{data.points.toLocaleString()}</Text>
                    <Text style={s.ptsUnit}>pts</Text>
                  </View>

                  <Text style={s.shopName}>{data.shopName} · habashop</Text>
                </View>

                {/* Zone basse — fond thème */}
                <View style={s.cardBottom}>
                  {data.nextTier ? (
                    <View style={{ gap: 4 }}>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { width: `${progress}%` as any, backgroundColor: cfg.accent }]} />
                      </View>
                      <Text style={s.progressTxt}>{data.pointsToNext.toLocaleString()} pts → {data.nextTier}</Text>
                    </View>
                  ) : (
                    <Text style={[s.maxTxt, { color: cfg.accent }]}>🎉 {i('Niveau maximum !', 'Max level!', '¡Nivel máximo!', 'Livello massimo!')}</Text>
                  )}

                  {/* Stats 2 colonnes */}
                  <View style={s.statsRow}>
                    <View style={s.statCell}>
                      <Text style={s.statLabel}>{i('Prochain palier', 'Next tier', 'Próximo nivel', 'Prossimo livello')}</Text>
                      <Text style={s.statValue}>{data.nextTier ?? i('Maximum', 'Maximum', 'Máximo', 'Massimo')}</Text>
                    </View>
                    <View style={s.statSep} />
                    <View style={s.statCell}>
                      <Text style={s.statLabel}>{i('Points restants', 'Points to go', 'Puntos restantes', 'Punti mancanti')}</Text>
                      <Text style={s.statValue}>{data.nextTier ? data.pointsToNext.toLocaleString() : '—'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Action : partager (PDF via expo-print) */}
              <Pressable
                style={[s.shareBtn, sharing && s.shareBtnBusy]}
                onPress={handleShare} disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel={i('Partager', 'Share', 'Compartir', 'Condividi')}>
                {sharing
                  ? <ActivityIndicator color={C.primary} />
                  : <><Ionicons name="share-outline" size={18} color={C.primary} />
                    <Text style={s.shareBtnTxt}>{i('Partager', 'Share', 'Compartir', 'Condividi')}</Text></>
                }
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

function buildCardHtml(
  data: LoyaltyCardData,
  qrUri: string,
  i: (fr: string, en: string, es: string, it: string) => string,
): string {
  const cfg = TIER_CFG[data.tier] ?? TIER_CFG.Bronze
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
  const nextThreshold = data.tier === 'Bronze' ? data.bronzeThreshold : data.tier === 'Silver' ? data.silverThreshold : null
  const progress = nextThreshold ? Math.min(100, Math.round((data.points / nextThreshold) * 100)) : 100
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    body{font-family:-apple-system,sans-serif;background:#f4f4f8;margin:0;padding:20px;display:flex;align-items:center;justify-content:center}
    .card{width:340px;border:2px solid ${cfg.accent}59;border-radius:18px;overflow:hidden;background:#fff}
    .top{background:${cfg.dark};padding:18px 20px;position:relative;overflow:hidden;color:#fff}
    .wm{position:absolute;top:-10px;right:-10px;font-size:110px;opacity:0.06;line-height:1}
    .row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
    .badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 10px;background:${cfg.mid};border:1px solid ${cfg.accent}66;border-radius:20px;color:${cfg.accent};margin-bottom:6px}
    .name{font-size:18px;font-weight:900;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .id{font-size:10px;font-family:monospace;color:${cfg.accent};margin-top:2px}
    .qr{width:64px;height:64px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center}
    .pts-row{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}
    .pts{font-size:28px;font-weight:900;color:#fff;font-family:monospace;letter-spacing:-1px}
    .shop{font-size:10px;color:#fff8;text-transform:uppercase;letter-spacing:1px}
    .bottom{padding:14px 20px;background:#fff;color:#222}
    .bar-track{height:6px;background:#00000014;border-radius:99px;overflow:hidden;margin-bottom:4px}
    .bar-fill{height:100%;background:${cfg.accent};border-radius:99px;width:${progress}%}
    .progress{font-size:10px;color:#0008;margin-bottom:10px}
    .stats{display:flex}
    .stat{flex:1}
    .stat+.stat{border-left:1px solid #00000014;padding-left:14px}
    .stat-label{font-size:9px;color:#0007;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
    .stat-value{font-size:14px;font-weight:800;color:#222}
  </style></head><body>
  <div class="card">
    <div class="top">
      <div class="wm">${cfg.icon}</div>
      <div class="row">
        <div>
          <div class="badge">${cfg.icon} ${esc(data.tier)}</div>
          <div class="name">${esc(data.customerName)}</div>
          <div class="id">HABA-${data.customerId.slice(0, 8).toUpperCase()}</div>
        </div>
        <div class="qr">${qrUri ? `<img src="${qrUri}" width="56" height="56" alt="QR"/>` : ''}</div>
      </div>
      <div class="pts-row">
        <span class="pts">${data.points.toLocaleString()}</span>
        <span style="font-size:13px;color:#fff9">pts</span>
      </div>
      <div class="shop">${esc(data.shopName)} · habashop</div>
    </div>
    <div class="bottom">
      ${data.nextTier
        ? `<div class="bar-track"><div class="bar-fill"></div></div><div class="progress">${data.pointsToNext.toLocaleString()} pts → ${data.nextTier}</div>`
        : `<div class="progress" style="color:${cfg.accent};font-weight:700">🎉 ${i('Niveau maximum !', 'Max level!', '¡Nivel máximo!', 'Livello massimo!')}</div>`}
      <div class="stats">
        <div class="stat">
          <div class="stat-label">${i('Prochain palier', 'Next tier', 'Próximo nivel', 'Prossimo livello')}</div>
          <div class="stat-value">${data.nextTier ? esc(data.nextTier) : i('Maximum', 'Maximum', 'Máximo', 'Massimo')}</div>
        </div>
        <div class="stat">
          <div class="stat-label">${i('Points restants', 'Points to go', 'Puntos restantes', 'Punti mancanti')}</div>
          <div class="stat-value">${data.nextTier ? data.pointsToNext.toLocaleString() : '—'}</div>
        </div>
      </div>
    </div>
  </div>
  </body></html>`
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: withAlpha('#000000', 0.6), justifyContent: 'center', padding: Spacing.lg },
  box: { backgroundColor: C.bg, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  headTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  loadingBox: { height: 100, alignItems: 'center', justifyContent: 'center' },
  errorTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.danger, textAlign: 'center' },

  card: { borderRadius: 18, borderWidth: 2, overflow: 'hidden' },
  cardTop: { padding: Spacing.lg, gap: Spacing.sm, overflow: 'hidden' },
  watermark: { position: 'absolute', top: -10, right: -10, fontSize: 96, opacity: 0.06, lineHeight: 100 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  tierBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, marginBottom: 6 },
  tierTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_800ExtraBold' },
  cardName: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: '#FFFFFF', maxWidth: 200 },
  cardId: { fontSize: FontSize.xs, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  qrBox: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  qrImg: { width: 56, height: 56 },
  ptsRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  ptsVal: { fontSize: FontSize.xxxl, fontFamily: 'JetBrainsMono_700Bold', color: '#FFFFFF' },
  ptsUnit: { fontSize: FontSize.md, fontFamily: 'Outfit_600SemiBold', color: withAlpha('#FFFFFF', 0.6) },
  shopName: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: withAlpha('#FFFFFF', 0.5), textTransform: 'uppercase', letterSpacing: 1 },

  cardBottom: { backgroundColor: C.bg, padding: Spacing.md, gap: Spacing.md },
  barTrack: { height: 7, backgroundColor: C.bg3, borderRadius: BorderRadius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: BorderRadius.full },
  progressTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3 },
  maxTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold' },
  statsRow: { flexDirection: 'row', alignItems: 'stretch' },
  statCell: { flex: 1, gap: 2 },
  statSep: { width: 1, backgroundColor: C.border, marginHorizontal: Spacing.md },
  statLabel: { fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.text },

  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 50, backgroundColor: withAlpha(C.primary, 0.12), borderWidth: 1, borderColor: withAlpha(C.primary, 0.3), borderRadius: BorderRadius.md },
  shareBtnBusy: { opacity: 0.6 },
  shareBtnTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.primary },
})
